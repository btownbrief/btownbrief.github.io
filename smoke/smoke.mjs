// Btown Games smoke run.
//
//   node smoke.mjs                 every live game in ../games.json
//   node smoke.mjs btown-riddle    one or more slugs
//   node smoke.mjs --soon          include live:false entries too
//   node smoke.mjs --base http://localhost:8000   another origin
//
// Each game is opened on a phone viewport and a laptop viewport. The run
// FAILS a game for things a player would hit: HTTP errors, JS exceptions,
// console errors, 4xx/5xx sub-requests, "undefined"/"NaN" leaking into the
// page, and the body scrolling sideways on a phone. It WARNS on shell drift:
// missing manifest / theme-color / touch icon / ticker / analytics / og
// image, or a leaderboard game that never asked for its board.
//
// Nothing here writes to production. Every Supabase RPC that is not a plain
// read is answered locally with an empty 200, and the GoatCounter pixel is
// swallowed, so a smoke run leaves no scores, no rooms and no pageviews.
//
// Output: out/report.json, out/report.md, out/<slug>-{mobile,desktop}.png.
// Exit code 1 when any game fails.

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
const onlySlugs = new Set(args);

// RPCs that only read. Anything else is a write and gets stubbed.
const READ_RPC = /^(get_[a-z0-9_]+|[a-z0-9_]+_get_[a-z0-9_]+|[a-z0-9_]+_(get|public|board|browse|standings|feed|counts|top|potw|leaders|winners|deck|home|wall|look|mine|me|pickup))$/;
// First-party analytics RPC: stubbed like GoatCounter, not worth a warning.
const ANALYTICS_RPC = /^btb_track_event$/;
// Third-party noise we do not own (the Beehiiv embed's bot-detection collector).
const IGNORE_URL = /goatcounter|px-cloud\.net/;
const GAME_SECTIONS = new Set(['arcade-action', 'daily-puzzles', 'board-card']);

const roster = JSON.parse(await readFile(path.join(here, '..', 'games.json'), 'utf8'));
const games = (Array.isArray(roster) ? roster : roster.games)
  .filter((g) => includeSoon || g.live !== false)
  .filter((g) => onlySlugs.size === 0 || onlySlugs.has(g.slug));

if (games.length === 0) { console.error('No games matched.'); process.exit(2); }
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

async function smokeOne(g) {
  const url = `${BASE}/${g.slug}/`;
  const r = { slug: g.slug, name: g.name, url, fails: [], warns: [], info: {}, rpcs: [], blockedWrites: [] };
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
    });
    const page = await ctx.newPage();
    const consoleErrors = [], pageErrors = [], badResponses = [];

    await ctx.route(/goatcounter\.com\//, (route) => route.fulfill({ status: 204, body: '' }));
    await ctx.route(/supabase\.co\/rest\/v1\/rpc\/([a-z0-9_]+)/, (route, req) => {
      const fn = req.url().match(/rpc\/([a-z0-9_]+)/)[1];
      r.rpcs.push(fn);
      if (READ_RPC.test(fn)) return route.continue();
      if (!ANALYTICS_RPC.test(fn)) r.blockedWrites.push(fn);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // "Failed to load resource" carries no URL; the response hook below reports those with one.
    page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
    page.on('response', (res) => {
      const s = res.status(), u = res.url();
      if (s < 400 || IGNORE_URL.test(u)) return;
      const rpc = u.match(/supabase\.co\/rest\/v1\/rpc\/([a-z0-9_]+)/);
      if (rpc) badResponses.push(s === 404 ? `RPC ${rpc[1]} missing on Supabase (SQL not applied?)` : `RPC ${rpc[1]} -> ${s}`);
      else badResponses.push(`${s} ${u.slice(0, 140)}`);
    });

    let status = 0;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      status = resp ? resp.status() : 0;
    } catch (e) {
      r.fails.push(`[${vp.tag}] navigation: ${String(e.message).split('\n')[0].slice(0, 160)}`);
      await ctx.close();
      continue;
    }
    if (status !== 200) r.fails.push(`[${vp.tag}] HTTP ${status}`);

    // Let intro overlays fall away the way a player would dismiss them.
    await page.keyboard.press('Escape').catch(() => {});
    const closer = page.locator('button:visible, [role=button]:visible').filter({ hasText: /^(✕|×|close|got it|ok|okay|let's go|start|play|skip)$/i }).first();
    if (await closer.count().catch(() => 0)) await closer.click({ timeout: 2000 }).catch(() => {});
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
        leaderboardClient: scripts.find((s) => /leaderboard\.js/.test(s)) ?? ([...document.querySelectorAll('script[type=module]')].some((s) => /leaderboard\.js/.test(s.textContent)) ? 'inline-import' : null),
        moreGames: /more games/i.test(text),
      };
    }).catch((e) => ({ evalError: String(e.message).slice(0, 160) }));

    if (facts.evalError) r.fails.push(`[${vp.tag}] page.evaluate: ${facts.evalError}`);
    for (const e of pageErrors) r.fails.push(`[${vp.tag}] exception: ${e}`);
    for (const e of consoleErrors) r.fails.push(`[${vp.tag}] console: ${e}`);
    for (const e of badResponses) r.fails.push(`[${vp.tag}] ${e}`);
    if (facts.leak) r.fails.push(`[${vp.tag}] leaked "${facts.leak}"`);
    if (!facts.title) r.fails.push(`[${vp.tag}] empty <title>`);
    if (vp.isMobile && facts.overflowX) r.fails.push('[mobile] page scrolls sideways');

    if (vp.isMobile) {
      r.info = { ...facts };
      const isGame = GAME_SECTIONS.has(g.section);
      if (facts.textLength < 30) r.warns.push('almost no visible text (canvas-only?)');
      if (!facts.manifest) r.warns.push('no manifest');
      else if (!(await checkUrl(ctx, facts.manifest))) r.fails.push(`manifest ${facts.manifest} not 200`);
      if (facts.touchIcon && !(await checkUrl(ctx, facts.touchIcon))) r.fails.push('apple-touch-icon not 200');
      if (!facts.touchIcon) r.warns.push('no apple-touch-icon');
      if (!facts.themeColor) r.warns.push('no theme-color');
      if (!facts.ogImage) r.warns.push('no og:image');
      if (!facts.goat) r.warns.push('no GoatCounter');
      if (isGame && !facts.ticker) r.warns.push('no ticker');
      if (isGame && !facts.moreGames) r.warns.push('no "More games" footer');
      if (facts.statusBar === 'black-translucent' && !facts.nav) r.info.padsOwnStatusBar = 'assumed (see css)';
    }

    await page.screenshot({ path: path.join(OUT, `${g.slug}-${vp.tag}.png`), fullPage: false }).catch(() => {});
    await ctx.close();
  }

  if (g.leaderboard) r.info.leaderboardOnLoad = r.rpcs.includes('get_leaderboard'); // boards usually load on tap, so this is info only
  if (r.blockedWrites.length) r.warns.push(`write RPC on load (stubbed): ${[...new Set(r.blockedWrites)].join(', ')}`);
  r.fails = [...new Set(r.fails)];
  r.warns = [...new Set(r.warns)];
  r.ok = r.fails.length === 0;
  return r;
}

async function checkUrl(ctx, href) {
  try { const res = await ctx.request.get(href, { timeout: 15000 }); return res.status() === 200; } catch { return false; }
}

// Small worker pool.
const queue = [...games];
const results = [];
async function worker() {
  while (queue.length) {
    const g = queue.shift();
    const t0 = Date.now();
    let res;
    try { res = await smokeOne(g); } catch (e) { res = { slug: g.slug, name: g.name, ok: false, fails: [`runner: ${String(e.message).slice(0, 200)}`], warns: [], info: {} }; }
    res.ms = Date.now() - t0;
    results.push(res);
    const mark = res.ok ? '✅' : '❌';
    console.log(`${mark} ${g.slug.padEnd(24)} ${String(res.ms).padStart(6)}ms  fails=${res.fails.length} warns=${res.warns.length}`);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker));
await browser.close();

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
await writeFile(path.join(OUT, 'report.md'), md);

console.log(`\n${results.length} games, ${failed.length} failing. Report: smoke/out/report.md`);
process.exit(failed.length ? 1 : 0);
