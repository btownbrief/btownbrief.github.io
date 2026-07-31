/*
 * BTown Brief — the games news ticker.
 *
 * A slim, old-TV-news crawl pinned to the bottom of every arcade game: two
 * months of Btown Brief headlines mixed with this week's picks and upcoming
 * Burlington events. Include it with a single line and it stays in sync
 * forever:
 *
 *   <script src="https://play.btownbrief.com/ticker.js" defer></script>
 *
 * Edit THIS file to change the ticker everywhere. Don't copy it into games.
 *
 * The feed is data/ticker.json on the city guide (built hourly by the guide
 * repo's refresh-data workflow):
 *   { headlines: [...], week: [{label,text}...], upcoming: [{label,text,note}...],
 *     latest: {title,url}, updated }
 *
 * Behavior contract with the games:
 *   - It's an overlay. It never resizes or reflows the host page, so it can't
 *     break a game's layout; it's kept slim so it can't hide much either.
 *   - ✕ collapses it to a small 📰 tab in the corner; tapping the tab brings
 *     it back — a two-way toggle that works any time, mid-game included.
 *     The choice persists across visits (localStorage, shared by all games
 *     on play.btownbrief.com).
 *   - If the feed can't be fetched, the bar simply never appears.
 *   - <script ... data-position="top"> pins it to the top instead, for games
 *     whose bottom edge is part of the play surface.
 *   - window.BtownTicker.hide()/show() lets a game tuck it away during play
 *     and bring it back on the menu / game-over screen.
 *
 * Each load starts the crawl at a random spot in the headline pile, so the
 * ticker reads fresh every visit even though the loop is long. Headlines
 * click through to the latest edition; events click through to the guide's
 * things-to-do page. prefers-reduced-motion gets a static item that swaps
 * every few seconds instead of a crawl.
 */
(function () {
  'use strict';

  if (window.__btownTicker) return;
  window.__btownTicker = true;

  var FEED = 'https://guide.btownbrief.com/data/ticker.json';
  var EVENTS_URL = 'https://guide.btownbrief.com/things-to-do.html';
  var KEY = 'btown-ticker'; // localStorage: 'off' = collapsed to the 📰 tab
  var MAX_ITEMS = 48;       // items per loop — plenty of variety, light DOM
  var SPEED = 65;           // crawl speed, px/s

  var script = document.currentScript || {};
  var position = (script.dataset && script.dataset.position) === 'top' ? 'top' : 'bottom';

  function pref(v) {
    try {
      if (v === undefined) return localStorage.getItem(KEY);
      localStorage.setItem(KEY, v);
    } catch (e) { /* storage blocked — the toggle just won't persist */ }
  }

  var css = [
    '.bt-ticker{position:fixed;left:0;right:0;', position, ':0;z-index:2147482000;',
    'display:flex;align-items:stretch;height:30px;overflow:hidden;',
    'background:#0d1b2a;border-', position === 'top' ? 'bottom' : 'top', ':1px solid rgba(255,255,255,.14);',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:13px;line-height:30px;',
    'padding-', position === 'top' ? 'top' : 'bottom', ':env(safe-area-inset-', position, ',0px);}',
    '.bt-ticker-brand{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:0 10px;',
    'background:#ffd23f;color:#0d1b2a;font-weight:800;font-size:11px;letter-spacing:.08em;white-space:nowrap;}',
    '.bt-ticker-live{width:7px;height:7px;border-radius:50%;background:#ff5a3c;',
    'animation:bt-ticker-blink 1.6s ease-in-out infinite;}',
    '.bt-ticker-view{flex:1 1 auto;overflow:hidden;position:relative;}',
    '.bt-ticker-track{display:inline-flex;align-items:center;white-space:nowrap;will-change:transform;',
    'animation:bt-ticker-scroll linear infinite;}',
    '.bt-ticker:hover .bt-ticker-track{animation-play-state:paused;}',
    '.bt-ticker-item{color:#eaf2ff;text-decoration:none;padding:0 14px;}',
    '.bt-ticker-item:hover{color:#ffd23f;}',
    '.bt-ticker-tag{color:#ffd23f;font-weight:700;font-size:10.5px;letter-spacing:.06em;margin-right:7px;}',
    '.bt-ticker-item--event .bt-ticker-tag{color:#4cc3ff;}',
    '.bt-ticker-note{color:#9db4d0;}',
    '.bt-ticker-sep{color:rgba(255,255,255,.25);}',
    '.bt-ticker-x{flex:0 0 auto;width:30px;border:0;background:none;color:#9db4d0;font-size:14px;',
    'cursor:pointer;padding:0;line-height:30px;}',
    '.bt-ticker-x:hover{color:#eaf2ff;}',
    '.bt-ticker-tab{position:fixed;left:6px;', position, ':6px;z-index:2147482000;',
    'width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.2);',
    'background:rgba(13,27,42,.82);font-size:15px;line-height:28px;text-align:center;',
    'cursor:pointer;padding:0;opacity:.6;',
    'margin-', position === 'top' ? 'top' : 'bottom', ':env(safe-area-inset-', position, ',0px);}',
    '.bt-ticker-tab:hover{opacity:1;}',
    '@keyframes bt-ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
    '@keyframes bt-ticker-blink{0%,100%{opacity:1}50%{opacity:.35}}',
    '@media (max-width:640px){.bt-ticker{font-size:12px;}.bt-ticker-item{padding:0 10px;}}',
    '@media (prefers-reduced-motion:reduce){',
    '.bt-ticker-track{animation:none !important;display:block;}',
    '.bt-ticker-track .bt-ticker-item,.bt-ticker-track .bt-ticker-sep{display:none;}',
    '.bt-ticker-track .bt-ticker-item.bt-ticker-current{display:inline-block;max-width:100%;',
    'overflow:hidden;text-overflow:ellipsis;}',
    '.bt-ticker-live{animation:none;}}'
  ].join('');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Mix the feed into one crawl: mostly headlines, an event every third slot.
     Headlines start at a random offset so every load reads different. */
  function buildItems(feed) {
    var news = (feed.headlines || []).slice();
    var events = (feed.week || []).map(function (w) {
      return { tag: w.label || 'This week', text: w.text, event: true };
    }).concat((feed.upcoming || []).map(function (u) {
      return { tag: u.label || 'Upcoming', text: u.text + (u.note ? ' \u2014 ' + u.note : ''), event: true };
    }));

    var items = [];
    var n = Math.floor(Math.random() * Math.max(news.length, 1));
    var e = 0;
    for (var i = 0; i < MAX_ITEMS && (news.length || events.length); i++) {
      if (events.length && i % 3 === 2) {
        items.push(events[e++ % events.length]);
      } else if (news.length) {
        items.push({ tag: 'News', text: news[n++ % news.length] });
      }
    }
    return items;
  }

  function render(feed) {
    var items = buildItems(feed);
    if (!items.length) return;

    var latestUrl = (feed.latest && feed.latest.url) || 'https://www.btownbrief.com/';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'bt-ticker';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Btown Brief news and events');

    var html = items.map(function (it) {
      return '<a class="bt-ticker-item' + (it.event ? ' bt-ticker-item--event' : '') + '"' +
        ' href="' + esc(it.event ? EVENTS_URL : latestUrl) + '" target="_blank" rel="noopener">' +
        '<span class="bt-ticker-tag">' + esc(it.tag).toUpperCase() + '</span>' + esc(it.text) + '</a>' +
        '<span class="bt-ticker-sep">\u2022</span>';
    }).join('');

    bar.innerHTML =
      '<span class="bt-ticker-brand"><span class="bt-ticker-live"></span>BTOWN BRIEF</span>' +
      '<div class="bt-ticker-view"><div class="bt-ticker-track">' +
      html + html + // doubled so the -50% translate loops seamlessly
      '</div></div>' +
      '<button class="bt-ticker-x" aria-label="Hide news ticker" title="Hide the ticker">\u2715</button>';

    // The ✕ never kills the ticker outright — it collapses it into a small
    // 📰 tab in the corner, so a player can flip it back on whenever they
    // like, mid-game included. The choice sticks (localStorage) until they
    // flip it again.
    var tab = document.createElement('button');
    tab.className = 'bt-ticker-tab';
    tab.textContent = '\uD83D\uDCF0';
    tab.setAttribute('aria-label', 'Show news ticker');
    tab.title = 'Btown Brief news & events';

    function setOn(on) {
      bar.style.display = on ? '' : 'none';
      tab.style.display = on ? 'none' : '';
      pref(on ? 'on' : 'off');
    }
    bar.querySelector('.bt-ticker-x').addEventListener('click', function () { setOn(false); });
    tab.addEventListener('click', function () { setOn(true); });

    document.body.appendChild(bar);
    document.body.appendChild(tab);

    var track = bar.querySelector('.bt-ticker-track');
    // Duration from real content width so the crawl speed is constant
    // whatever the mix of short and long items. Measured while the bar is
    // still visible — a display:none bar has no width to measure.
    track.style.animationDuration = (track.scrollWidth / 2 / SPEED) + 's';

    if (pref() === 'off') {
      bar.style.display = 'none';
    } else {
      tab.style.display = 'none';
    }

    // Reduced motion: the crawl is disabled by CSS; rotate a single item.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var links = track.querySelectorAll('.bt-ticker-item');
      var cur = 0;
      links[0].classList.add('bt-ticker-current');
      setInterval(function () {
        links[cur].classList.remove('bt-ticker-current');
        cur = (cur + 1) % links.length;
        links[cur].classList.add('bt-ticker-current');
      }, 6000);
    }

    // For games: tuck the whole thing (bar AND tab) away during play, bring
    // it back on the menu. show() restores whichever state the player chose.
    window.BtownTicker = {
      hide: function () { bar.style.display = 'none'; tab.style.display = 'none'; },
      show: function () {
        if (pref() === 'off') tab.style.display = '';
        else bar.style.display = '';
      }
    };
  }

  function start() {
    fetch(FEED)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(render)
      .catch(function () { /* no feed, no ticker — never bother the game */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
