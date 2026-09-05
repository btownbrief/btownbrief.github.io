// Btown Games smoke run.
//
//   node smoke.mjs                 every live game in ../games.json
//   node smoke.mjs btown-riddle    one or more slugs
//   node smoke.mjs --soon          include live:false entries too
//   node smoke.mjs --base http://127.0.0.1:8000   another origin (local checkouts)
//   node smoke.mjs --jobs 2        parallel browser contexts (default 4)
//
// Each game is opened on a phone viewport and a laptop viewport. The run
// FAILS a game for things a player would hit: HTTP errors, a redirect away
// from the game, JS exceptions, console errors, 4xx/5xx or failed
// sub-requests, "undefined"/"NaN" leaking into the page, a broken manifest
// or touch icon, and the body scrolling sideways on a phone. It WARNS on
// shell drift: missing manifest / theme-color / touch icon / og:image /
// ticker / analytics / "More games" footer, or a write RPC fired on load.
// Whether a leaderboard game asked for its board on load is recorded as
// info only (boards usually load on tap).
//
// NETWORK POLICY: deny by default. Only GET/HEAD requests to the game's own
// origin, play.btownbrief.com and a short list of static CDNs go out. Every
// Supabase call is answered locally with an empty 200 (so nothing is read
// or written there, not even a leaderboard), the GoatCounter script and
// pixel are swallowed, service workers are blocked and WebSockets never
// connect. A run therefore leaves no scores, rooms, heartbeats or pageviews
// behind. The cost: a missing RPC (SQL not yet applied) is NOT detected
// here. PostgREST offers no read-only existence probe on this project, so
// that stays a manual check.
//
// Output: out/report.json, out/report.md, out/<slug>-{mobile,desktop}.png.
// Exit code 1 when any game fails, 2 on a runner problem.

import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args.splice(i, 1), true) : false; };
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const includeSoon = flag('--soon');
const BASE = opt('--base', 'https://play.btownbrief.com').replace(/\/+$/, '');
const CONCURRENCY = Number(opt('--jobs', 4));
const PER_GAME_MS = 150_000;
const onlySlugs = new Set(args);

const fatal = async (msg) => {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'report.md'), `# Btown smoke — ${new Date().toISOString()}\n\nRunner problem: ${msg}\n`);
  console.error(msg);
  process.exit(2);
};

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || CONCURRENCY > 16) await fatal(`--jobs must be an integer 1–16, got ${CONCURRENCY}`);
for (const s of onlySlugs) if (!/^[a-z0-9-]+$/.test(s)) await fatal(`not a slug: ${JSON.stringify(s)}`);

let baseOrigin;
try { baseOrigin = new URL(BASE).origin; } catch { await fatal(`--base is not a URL: ${BASE}`); }

// Hosts a game may fetch static assets from, GET/HEAD only.
const ALLOW_HOSTS = new Set([
  new URL(BASE).host, 'play.btownbrief.com', 'www.btownbrief.com', 'guide.btownbrief.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'esm.sh',
  'raw.githubusercontent.com', 'tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org',
  'a.basemaps.cartocdn.com', 'b.basemaps.cartocdn.com', 'c.basemaps.cartocdn.com', 'd.basemaps.cartocdn.com',
]);
const GAME_SECTIONS = new Set(['arcade-action', 'daily-puzzles', 'board-card']);
const ANALYTICS_RPC = new Set(['btb_track_event']);
// Names that look like reads. Only used to decide whether to WARN: every RPC is stubbed regardless.
const READ_LOOKING = /^get_|_(get|public|board|browse|standings|feed|counts|top|potw|leaders|winners|deck|home|wall|pickup|mine|me)$|_get_/;

const rosterRaw = JSON.parse(await readFile(path.join(here, '..', 'games.json'), 'utf8'));
const roster = Array.isArray(rosterRaw) ? rosterRaw : rosterRaw.games;
const games = roster
  .filter((g) => includeSoon || g.live !== false)
  .filter((g) => onlySlugs.size === 0 || onlySlugs.has(g.slug));
const unknown = [...onlySlugs].filter((s) => !roster.some((g) => g.slug === s));
if (unknown.length) await fatal(`not in games.json: ${unknown.join(', ')}`);
if (games.length === 0) await fatal('No games matched.');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function smokeOne(g) {
  const url = `${BASE}/${g.slug}/`;
  const r = { slug: g.slug, name: g.name, url, fails: [], warns: [], info: {}, rpcs: [], writeRpcs: [], blockedHosts: [] };
  const viewports = [
    { tag: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    { tag: 'desktop', viewport: { width: 1280, height: 800 } },
  ];

  for (const vp of viewports) {
    const ctx = await browser.newContext({
      ...vp,
      userAgent: vp.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 BtownSmoke'
        : undefined,
      locale: 'en-US', timezoneId: 'America/New_York',
      serviceWorkers: 'block',
    });
    const consoleErrors = [], pageErrors = [], badResponses = [], failedRequests = [];

    // Deny by default. Routes are installed on the context before the page exists.
    await ctx.route('**/*', (route, req) => {
      const u = new URL(req.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
      if (/supabase\.(co|in)$/.test(u.host)) {
        const rpc = u.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
        const fn = rpc ? decodeURIComponent(rpc[1]) : `${req.method()} ${u.pathname}`;
        r.rpcs.push(fn);
        // Everything is stubbed: we cannot tell a pure read from a heartbeat by name.
        if (rpc && !ANALYTICS_RPC.has(fn) && !READ_LOOKING.test(fn)) r.writeRpcs.push(fn);
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if ((req.method() === 'GET' || req.method() === 'HEAD') && ALLOW_HOSTS.has(u.host)) return route.continue();
      r.blockedHosts.push(u.host);
      return route.fulfill({ status: 204, body: '' });
    });
    await ctx.routeWebSocket('**', () => { /* mocked: never connects */ });

    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
    page.on('requestfailed', (req) => {
      const err = req.failure()?.errorText ?? '';
      if (/net::ERR_ABORTED/.test(err)) return; // navigations and cancelled preloads, not errors
      failedRequests.push(`${err} ${req.url().slice(0, 140)}`);
    });
    page.on('response', (res) => {
      const s = res.status(), u = res.url();
      if (s >= 400) badResponses.push(`${s} ${u.slice(0, 140)}`);
    });

    try {
      let status = 0;
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
        status = resp ? resp.status() : 0;
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      } catch (e) {
        r.fails.push(`[${vp.tag}] navigation: ${String(e.message).split('\n')[0].slice(0, 160)}`);
        continue;
      }
      if (status !== 200) r.fails.push(`[${vp.tag}] HTTP ${status}`);
      const landed = new URL(page.url());
      if (landed.origin !== baseOrigin || landed.pathname.replace(/index\.html$/, '') !== `/${g.slug}/`) {
        r.fails.push(`[${vp.tag}] redirected to ${landed.href.slice(0, 120)}`);
      }

      // Dismiss an intro overlay the way a player would. Only dismissal words:
      // never "start"/"play", which would begin a game.
      await page.keyboard.press('Escape').catch(() => {});
      const closer = page.locator('button:visible, [role=button]:visible').filter({ hasText: /^(✕|×|close|got it|ok|okay|dismiss|skip)$/i }).first();
      if (await closer.count().catch(() => 0)) await closer.click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
      await page.waitForTimeout(1500);

      const facts = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const meta = (n) => q(`meta[name="${n}"]`)?.content ?? null;
        const prop = (n) => q(`meta[property="${n}"]`)?.content ?? null;
        const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
        const text = document.body?.innerText ?? '';
        const leak = text.match(/\b(undefined|NaN|\[object Object\]|null)\b/);
        return {
          title: document.title,
          textLength: text.replace(/\s+/g, ' ').trim().length,
          leak: leak ? text.slice(Math.max(0, leak.index - 40), leak.index + 40).replace(/\s+/g, ' ') : null,
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
          manifest: q('link[rel=manifest]')?.href ?? null,
          touchIcon: q('link[rel="apple-touch-icon"]')?.href ?? null,
          themeColor: meta('theme-color'),
          viewport: meta('viewport'),
          statusBar: meta('apple-mobile-web-app-status-bar-style'),
          ogImage: prop('og:image'),
          ticker: scripts.some((s) => /\/ticker\.js/.test(s)) || !!window.BtownTicker,
          nav: scripts.some((s) => /\/nav\.js/.test(s)),
          goat: !!q('script[data-goatcounter]'),
          moreGames: /more games/i.test(text),
        };
      }).catch((e) => ({ evalError: String(e.message).slice(0, 160) }));

      if (facts.evalError) r.fails.push(`[${vp.tag}] page.evaluate: ${facts.evalError}`);
      if (facts.leak) r.fails.push(`[${vp.tag}] leaked "${facts.leak}"`);
      if (!facts.title) r.fails.push(`[${vp.tag}] empty <title>`);
      if (vp.isMobile && facts.overflowX) r.fails.push('[mobile] page scrolls sideways');

      if (vp.isMobile) {
        r.info = { ...facts };
        const isGame = GAME_SECTIONS.has(g.section);
        if (facts.textLength < 30) r.warns.push('almost no visible text (canvas-only?)');
        if (!facts.manifest) r.warns.push('no manifest');
        else if (!(await sameOriginOk(ctx, facts.manifest))) r.fails.push(`manifest ${facts.manifest} not a 200 on the game's origin`);
        if (!facts.touchIcon) r.warns.push('no apple-touch-icon');
        else if (!(await sameOriginOk(ctx, facts.touchIcon))) r.fails.push(`apple-touch-icon ${facts.touchIcon} not a 200 on the game's origin`);
        if (!facts.themeColor) r.warns.push('no theme-color');
        if (!facts.ogImage) r.warns.push('no og:image');
        if (!facts.goat) r.warns.push('no GoatCounter');
        if (isGame && !facts.ticker) r.warns.push('no ticker');
        if (isGame && !facts.moreGames) r.warns.push('no "More games" footer visible on load');
      }

      await page.screenshot({ path: path.join(OUT, `${g.slug}-${vp.tag}.png`), fullPage: false, timeout: 15000 }).catch(() => {});
    } finally {
      // Collect last so late responses from the click are included.
      for (const e of pageErrors) r.fails.push(`[${vp.tag}] exception: ${e}`);
      for (const e of consoleErrors) r.fails.push(`[${vp.tag}] console: ${e}`);
      for (const e of badResponses) r.fails.push(`[${vp.tag}] ${e}`);
      for (const e of failedRequests) r.fails.push(`[${vp.tag}] request failed: ${e}`);
      await ctx.close().catch(() => {});
    }
  }

  r.info.leaderboardOnLoad = g.leaderboard ? r.rpcs.includes('get_leaderboard') : undefined;
  r.info.rpcsOnLoad = [...new Set(r.rpcs)];
  r.info.blockedHosts = [...new Set(r.blockedHosts)];
  if (r.writeRpcs.length) r.warns.push(`write-looking RPC on load (stubbed): ${[...new Set(r.writeRpcs)].join(', ')}`);
  r.fails = [...new Set(r.fails)];
  r.warns = [...new Set(r.warns)];
  r.ok = r.fails.length === 0;
  return r;
}

// Manifest / icon fetches go through the API client, which the page routes do
// not cover, so they are pinned to the game's own origin.
async function sameOriginOk(ctx, href) {
  try {
    const u = new URL(href);
    if (u.origin !== baseOrigin) return false;
    const res = await ctx.request.get(u.href, { timeout: 15000, maxRedirects: 0 });
    return res.status() === 200;
  } catch { return false; }
}

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} exceeded ${ms / 1000}s`)), ms))]);

const queue = [...games];
const results = [];
async function worker() {
  while (queue.length) {
    const g = queue.shift();
    const t0 = Date.now();
    let res;
    try { res = await withTimeout(smokeOne(g), PER_GAME_MS, g.slug); }
    catch (e) { res = { slug: g.slug, name: g.name, ok: false, fails: [`runner: ${String(e.message).slice(0, 200)}`], warns: [], info: {} }; }
    res.ms = Date.now() - t0;
    results.push(res);
    console.log(`${res.ok ? '✅' : '❌'} ${g.slug.padEnd(24)} ${String(res.ms).padStart(6)}ms  fails=${res.fails.length} warns=${res.warns.length}`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker));
await browser.close();

if (results.length !== games.length) await fatal(`ran ${results.length} of ${games.length} games`);

results.sort((a, b) => a.slug.localeCompare(b.slug));
const failed = results.filter((r) => !r.ok);
const report = { ranAt: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results };
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

let md = `# Btown smoke — ${report.ranAt}\n\n${results.length} games against ${BASE}. **${failed.length} failing.**\n\n`;
for (const r of results) {
  if (r.fails.length === 0 && r.warns.length === 0) continue;
  md += `## ${r.ok ? '✅' : '❌'} ${r.name} (\`${r.slug}\`)\n`;
  for (const f of r.fails) md += `- FAIL ${f}\n`;
  for (const w of r.warns) md += `- warn ${w}\n`;
  md += '\n';
}
md += `## Clean\n${results.filter((r) => r.ok && r.warns.length === 0).map((r) => `\`${r.slug}\``).join(' · ') || '(none)'}\n`;
const hosts = [...new Set(results.flatMap((r) => r.info?.blockedHosts ?? []))];
if (hosts.length) md += `\n## Blocked hosts seen\n${hosts.map((h) => `\`${h}\``).join(' · ')}\n`;
await writeFile(path.join(OUT, 'report.md'), md);

console.log(`\n${results.length} games, ${failed.length} failing. Report: smoke/out/report.md`);
process.exit(failed.length ? 1 : 0);
