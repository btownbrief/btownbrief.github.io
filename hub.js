import { fetchTop, getName, playerId, monthLabel } from './leaderboard.js';

const grid = document.getElementById('grid');
const greetEl = document.getElementById('greeting');

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

async function init() {
  renderGreeting();
  let data;
  try {
    const res = await fetch('./games.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (e) {
    grid.innerHTML = `<p class="load-error">Couldn't load the game list. Refresh to try again.</p>`;
    return;
  }
  const games = data.games || [];
  const sections = Array.isArray(data.sections) ? data.sections.filter((s) => s && s.id) : [];
  const knownSections = new Set(sections.map((s) => s.id));
  const sectionBlocks = sections.map((section) => (
    sectionHtml(section, games.filter((g) => g.section === section.id))
  ));
  const ungrouped = games.filter((g) => !knownSections.has(g.section));
  if (ungrouped.length) {
    sectionBlocks.push(sectionHtml({ id: 'more', title: 'More Games' }, ungrouped));
  }
  document.getElementById('month-label').textContent = monthLabel(0);
  grid.innerHTML = sectionBlocks.join('') || '<p class="load-error">No games are listed right now.</p>';
  // Fetch live champs / ranks in parallel; each degrades on its own.
  games.filter((g) => g.live).forEach(loadStats);
}

init();
