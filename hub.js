import { fetchTop, getName, playerId, monthLabel } from './leaderboard.js';

const grid = document.getElementById('grid');
const greetEl = document.getElementById('greeting');
const modeEl = document.getElementById('mode');

/* Two ways to play, and they are genuinely different errands: the cabinets
   you tap through on the couch, and the five that need you to actually be
   somewhere in Burlington. A game opts into the second with "where": "out"
   in games.json — everything else defaults to the screen side, so adding a
   scavenger hunt is one field, not a refactor.

   The choice is remembered, because someone who came for the outdoor ones
   did not come for Tetris. */
const MODE_KEY = 'btown-arcade-where';
const DEFAULT_MODES = [
  { id: 'screen', title: 'On a screen', blurb: '' },
  { id: 'out', title: 'Out in Burlington', blurb: '' },
];
let MODE = 'screen';
let DATA = null;

function readMode() {
  try { return localStorage.getItem(MODE_KEY) || 'screen'; } catch (e) { return 'screen'; }
}
function writeMode(v) {
  try { localStorage.setItem(MODE_KEY, v); } catch (e) { /* private mode: this session only */ }
}
const whereOf = (g) => (g && g.where === 'out') ? 'out' : 'screen';

const cardEls = {}; // slug -> { champ, rank } element handles

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderGreeting() {
  const name = getName();
  if (!name) {
    greetEl.innerHTML = `<span class="greet-quarter">🪙 Drop in — pick a cabinet and play.</span>`;
    return;
  }
  greetEl.innerHTML = `<span class="greet-playing">Playing as <strong>${escapeHtml(name)}</strong></span>
    <span class="greet-sub">Your monthly ranks light up below as they load</span>`;
}

function cardHtml(g) {
  if (!g.live) {
    return `
      <article class="cab coming" aria-label="${escapeHtml(g.name)} — coming soon">
        <div class="cab-marquee soon">COMING SOON</div>
        <div class="cab-screen">
          <div class="cab-emoji">${g.emoji}</div>
          <h3 class="cab-name">${escapeHtml(g.name)}</h3>
          <p class="cab-pitch">${escapeHtml(g.pitch)}</p>
        </div>
        <div class="cab-foot">
          <span class="btn btn-soon" aria-disabled="true">SOON</span>
        </div>
      </article>`;
  }
  return `
    <article class="cab" aria-label="${escapeHtml(g.name)}">
      <div class="cab-marquee">${g.emoji} ${escapeHtml(g.name.toUpperCase())}</div>
      <div class="cab-screen">
        <div class="cab-emoji">${g.emoji}</div>
        <p class="cab-pitch">${escapeHtml(g.pitch)}</p>
        <div class="cab-champ" data-champ="${g.slug}" hidden></div>
        <div class="cab-rank" data-rank="${g.slug}" hidden></div>
      </div>
      <div class="cab-foot">
        <a class="btn btn-play" href="/${g.slug}/">▶ PLAY</a>
      </div>
    </article>`;
}

function sectionHtml(section, games) {
  const headingId = `section-${section.id}`;
  return `
    <section class="game-section" aria-labelledby="${escapeHtml(headingId)}">
      <div class="game-section-head">
        <h2 id="${escapeHtml(headingId)}">${escapeHtml(section.title)}</h2>
        ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ''}
      </div>
      <div class="grid">${games.map(cardHtml).join('')}</div>
    </section>`;
}

async function loadStats(g) {
  const champEl = grid.querySelector(`[data-champ="${g.slug}"]`);
  const rankEl = grid.querySelector(`[data-rank="${g.slug}"]`);
  const me = playerId();
  try {
    const top = await fetchTop(g.slug, 0);
    if (Array.isArray(top) && top.length && top[0] && top[0].name) {
      champEl.innerHTML =
        `<span class="champ-crown">👑</span> <span class="champ-name">${escapeHtml(top[0].name)}</span>` +
        ` <span class="champ-score">${Number(top[0].score).toLocaleString()}</span>`;
      champEl.hidden = false;
    }
    if (me) {
      const idx = top.findIndex((r) => r.player_id === me);
      if (idx > -1 && idx < 25) {
        rankEl.innerHTML = `<span class="rank-badge">You're #${idx + 1} in ${escapeHtml(g.name)}!</span>`;
        rankEl.hidden = false;
      }
    }
  } catch (e) {
    // Degrade gracefully — leave champ/rank lines hidden.
  }
}

function renderModes() {
  if (!modeEl || !DATA) return;
  const modes = Array.isArray(DATA.modes) && DATA.modes.length ? DATA.modes : DEFAULT_MODES;
  const counts = {};
  (DATA.games || []).forEach((g) => {
    const k = whereOf(g);
    counts[k] = (counts[k] || 0) + 1;
  });
  const active = modes.find((m) => m.id === MODE) || modes[0];
  modeEl.innerHTML =
    `<div class="mode-bar" role="tablist" aria-label="Where you want to play">` +
    modes.map((m) => (
      `<button class="mode-btn${m.id === MODE ? ' on' : ''}" role="tab" data-mode="${escapeHtml(m.id)}"` +
      ` aria-selected="${m.id === MODE ? 'true' : 'false'}">` +
      `<span class="mode-title">${escapeHtml(m.title)}</span>` +
      `<span class="mode-count">${counts[m.id] || 0}</span></button>`
    )).join('') +
    `</div>` +
    (active && active.blurb ? `<p class="mode-blurb">${escapeHtml(active.blurb)}</p>` : '');
}

function renderGrid() {
  const games = (DATA.games || []).filter((g) => whereOf(g) === MODE);
  const sections = Array.isArray(DATA.sections) ? DATA.sections.filter((s) => s && s.id) : [];
  const knownSections = new Set(sections.map((s) => s.id));
  /* A section with nothing on this side of the toggle is not rendered at all —
     an empty "Daily Puzzles" heading under Out in Burlington would read as a
     loading failure. */
  const live = sections
    .map((section) => [section, games.filter((g) => g.section === section.id)])
    .filter(([, list]) => list.length);
  /* When a side has only one section, its heading just says again what the lit
     button and the blurb above already said — and worse, a description written
     for the whole section can be half-wrong about the half being shown. Drop
     it and let the cabinets start. */
  const sectionBlocks = live.map(([section, list]) => (
    live.length === 1 ? `<div class="grid">${list.map(cardHtml).join('')}</div>`
                      : sectionHtml(section, list)
  ));
  const ungrouped = games.filter((g) => !knownSections.has(g.section));
  if (ungrouped.length) {
    sectionBlocks.push(sectionHtml({ id: 'more', title: 'More Games' }, ungrouped));
  }
  grid.innerHTML = sectionBlocks.join('') ||
    `<p class="load-error">Nothing on this side yet — try the other one.</p>`;
  // Fetch live champs / ranks in parallel; each degrades on its own.
  games.filter((g) => g.live).forEach(loadStats);
}

function setMode(next) {
  if (next === MODE) return;
  MODE = next;
  writeMode(next);
  renderModes();
  renderGrid();
}

async function init() {
  renderGreeting();
  MODE = readMode();
  try {
    const res = await fetch('./games.json', { cache: 'no-cache' });
    DATA = await res.json();
  } catch (e) {
    grid.innerHTML = `<p class="load-error">Couldn't load the game list. Refresh to try again.</p>`;
    return;
  }
  document.getElementById('month-label').textContent = monthLabel(0);
  renderModes();
  renderGrid();
  if (modeEl) {
    modeEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) setMode(b.dataset.mode);
    });
  }
}

init();
