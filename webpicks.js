/* Daily picks from around the web: free puzzles on other sites, link-out only.

   The list lives in ONE place, the All Day app's data/web-games.json, which
   this page reads at runtime. web-games.json next to this file is a bundled
   copy for when that fetch fails (offline, or the app's host is down). Keep
   dailyPicks() identical to the one in the app (btown-brief/all-day/js/modes/
   games.js) so both pages show the same picks on the same day:
     n      = days since 1970-01-01 of the Burlington date (YYYY-MM-DD)
     shown  = the file's "shown" (5), at least one per category, the spare ones
              going to the biggest categories (the first of equals, file order)
     a category with m games and q picks shows games (n*q + k) mod m, k = 0..q-1
     order  = the categories, starting at category (n mod how many there are) */

const REMOTE = 'https://guide.btownbrief.com/all-day/data/web-games.json';
const LOCAL = './web-games.json';
const WAIT_MS = 6000;

const root = document.getElementById('web-picks');
const body = document.getElementById('web-picks-body');
let web = null;
let open = false;

const arr = (v) => (Array.isArray(v) ? v : []);
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
function burlingtonDay(ms = Date.now()) {
  const o = {};
  dayFmt.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  return `${o.year}-${o.month}-${o.day}`;
}
const utcNoon = (date) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };

export function dailyPicks(cfg, date) {
  const games = arr(cfg && cfg.games);
  const cats = arr(cfg && cfg.categories).map((c) => ({ id: c.id, list: games.filter((g) => g.category === c.id) })).filter((c) => c.list.length);
  if (!cats.length) return [];
  const n = Math.round(utcNoon(date) / 86400000);
  const shown = Math.max(1, Math.min(Number(cfg.shown) || 5, games.length));
  const start = n % cats.length;
  const order = cats.map((c, i) => cats[(i + start) % cats.length]);
  if (shown <= cats.length) order.length = shown;
  const q = new Map(order.map((c) => [c.id, 1]));
  let spare = shown - order.length;
  const bySize = cats.filter((c) => q.has(c.id)).sort((a, b) => b.list.length - a.list.length);   // file order, so a category's q never changes with the day
  while (spare > 0) {
    const room = bySize.filter((c) => q.get(c.id) < c.list.length);
    if (!room.length) break;
    room.forEach((c) => { if (spare > 0) { q.set(c.id, q.get(c.id) + 1); spare--; } });
  }
  const out = [];
  order.forEach((c) => {
    const m = c.list.length, per = q.get(c.id);
    for (let k = 0; k < per; k++) out.push(c.list[(n * per + k) % m]);
  });
  return out;
}

/* keep only rows that can be drawn: a name, an https link, a known category */
function shape(j) {
  const cats = arr(j && j.categories).filter((c) => c && c.id && c.title);
  const games = arr(j && j.games).filter((g) => g && g.id && g.name && /^https:\/\//.test(String(g.url || '')) && cats.some((c) => c.id === g.category));
  if (!games.length) throw new Error('bad shape');
  return { shown: j.shown, categories: cats, games };
}
async function getJson(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return shape(await res.json());
  } finally { clearTimeout(t); }
}

const catIndex = (g) => Math.max(0, web.categories.findIndex((c) => c.id === g.category));
const tile = (g) => `<span class="wp-mark wp-c${catIndex(g) % 4}" aria-hidden="true">${escapeHtml(String(g.name).charAt(0).toUpperCase())}</span>`;
const link = (g, inner, cls, label) => (
  `<a class="${cls}" href="${escapeHtml(g.url)}" target="_blank" rel="noopener"${label ? ` aria-label="${escapeHtml(label)}"` : ''}>${inner}</a>`
);

function cardHtml(g) {
  return link(g,
    `${tile(g)}<span class="wp-name">${escapeHtml(g.name)} ↗</span>` +
    `<span class="wp-by">${escapeHtml(g.publisher)} · ${escapeHtml(g.cost)}</span>` +
    `<span class="wp-desc">${escapeHtml(g.description)}</span>`,
    'wp-card', `${g.name}, ${g.cost}, opens in a new tab`);
}
function rowHtml(g) {
  return `<div class="wp-row" data-id="${escapeHtml(g.id)}">${tile(g)}<div class="wp-info">` +
    `<div class="wp-name">${escapeHtml(g.name)}</div>` +
    `<div class="wp-by">${escapeHtml(g.publisher)} · ${escapeHtml(g.cost)}</div>` +
    `<div class="wp-desc">${escapeHtml(g.description)}</div></div>` +
    link(g, 'OPEN ↗', 'wp-open', `Open ${g.name} in a new tab`) + `</div>`;
}

function draw() {
  if (!web) { root.hidden = true; return; }
  const total = web.games.length;
  root.hidden = false;
  if (open) {
    body.innerHTML = `<div class="wp-list" tabindex="-1" role="group" aria-label="All ${total} daily picks" data-list="${total}">` +
      web.categories.map((c) => {
        const list = web.games.filter((g) => g.category === c.id);
        return list.length ? `<h3 class="wp-cat">${escapeHtml(c.title)} <span>${list.length}</span></h3>${list.map(rowHtml).join('')}` : '';
      }).join('') +
      `<div class="wp-collapsebar"><button type="button" class="wp-collapse" data-collapse aria-label="Collapse the daily picks">↑ Collapse</button></div></div>`;
    return;
  }
  const day = burlingtonDay();
  body.innerHTML = `<div class="wp-rail" data-day="${day}">${dailyPicks(web, day).map(cardHtml).join('')}</div>` +
    `<button type="button" class="wp-all" data-all aria-expanded="false">See all ${total}</button>`;
}

root.addEventListener('click', (e) => {
  if (e.target.closest('[data-all]')) {
    open = true; draw();
    const list = body.querySelector('[data-list]');
    if (list) list.focus({ preventScroll: true });
  } else if (e.target.closest('[data-collapse]')) {
    open = false; draw();
    root.scrollIntoView({ block: 'start' });
    const b = body.querySelector('[data-all]');
    if (b) b.focus({ preventScroll: true });
  }
});

(async () => {
  try { web = await getJson(REMOTE, WAIT_MS); } catch (e) {
    try { web = await getJson(LOCAL, WAIT_MS); } catch (e2) { web = null; }
  }
  draw();
})();
