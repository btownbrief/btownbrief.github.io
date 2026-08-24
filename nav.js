/*
 * BTown Brief — shared top nav, and the closing "about" band.
 *
 * One bar across every property: the newsletter, the city guide, the arcade,
 * the merch shop. Include it with a single line and it stays in sync forever:
 *
 *   <script src="https://play.btownbrief.com/nav.js" defer></script>
 *
 * Edit THIS file to change the nav everywhere. Don't copy it into pages.
 *
 * Renders in normal document flow (not fixed/sticky) so it can never overlap
 * a host page's own header, whatever that page's CSS does.
 *
 * Since v2 this file also appends the ABOUT BAND to the foot of every page —
 * the "one local guy builds all of this" note and the link to the about page.
 * Same deal: it's here so it's written once and appears everywhere, and so it
 * reads identically on the guide, the hub, the arcade and the merch shop.
 * See ABOUT below for how it decides which pages can carry it.
 *
 * Since v3 the bar also carries NETWORK SEARCH — a ⌘K / Ctrl-K palette that
 * jumps to any page or game across every property. The index is two files on
 * this host: search-index.json (curated pages — edit that, not this) and
 * games.json (the arcade's own list, so new games appear in search the moment
 * they're live). See SEARCH below.
 */
(function () {
  'use strict';

  if (window.__btownNav) return;
  window.__btownNav = true;

  /*
   * The bar matches the hub front door's header: four verbs, then Subscribe.
   * The wordmark is the fifth link — it goes to the hub, the one front door
   * (guide.btownbrief.com/ now redirects there too). Merch and Everything left
   * the bar: the hub's A-Z, search and footer carry them.
   * `on` lists every place a link counts as "you are here".
   */
  var LINKS = [
    {
      label: 'Eat',
      href: 'https://guide.btownbrief.com/restaurants.html',
      on: [{ host: /^guide\.btownbrief\.com$/, path: /^\/(restaurants|deals|small-bites|openings)\.html$/ }]
    },
    {
      label: 'Do',
      href: 'https://guide.btownbrief.com/events.html',
      on: [{ host: /^guide\.btownbrief\.com$/, path: /^\/events\.html$/ }]
    },
    {
      label: 'Things To Do',
      href: 'https://guide.btownbrief.com/things-to-do.html',
      on: [{ host: /^guide\.btownbrief\.com$/, path: /^\/things-to-do\.html$/ }]
    },
    {
      label: 'Play',
      href: 'https://play.btownbrief.com/',
      on: [{ host: /^play\.btownbrief\.com$/ }]
    },
    {
      label: 'Read',
      href: 'https://www.btownbrief.com?utm_source=nav&utm_medium=referral&utm_campaign=site_capture',
      on: [{ host: /^(www\.)?btownbrief\.com$/ }]
    }
  ];

  var host = window.location.hostname;
  var path = window.location.pathname;

  function isCurrent(link) {
    return link.on.some(function (m) {
      if (!m.host.test(host)) return false;
      return m.path ? m.path.test(path) : true;
    });
  }

  var css = [
    '.btnav{--btnav-bg:#0E2230;--btnav-fg:#9DB6C2;--btnav-on:#FFFFFF;--btnav-accent:#E8A33D;',
    'background:var(--btnav-bg);color:var(--btnav-fg);width:100%;box-sizing:border-box;',
    "font-family:'Avenir Next Condensed','Futura','Helvetica Neue',Helvetica,sans-serif;",
    'font-size:15px;letter-spacing:.09em;text-transform:uppercase;line-height:1;}',

    '.btnav *{box-sizing:border-box;}',
    /* The links space themselves evenly via their own padding, so the flex gap
       stays 0 — a gap PLUS padding double-counts and makes the run look ragged. */
    '.btnav-in{max-width:1120px;margin:0 auto;padding:0 20px;display:flex;align-items:center;',
    'gap:0;min-height:52px;flex-wrap:wrap;}',

    /* The wordmark was 13px — exactly the same as the links, so it never actually
       read as bigger. Now it genuinely leads. */
    '.btnav-mark{font-weight:700;color:var(--btnav-on);letter-spacing:.14em;font-size:19px;',
    'margin-right:22px;white-space:nowrap;text-decoration:none;display:flex;align-items:center;gap:7px;}',
    '.btnav-mark span{color:var(--btnav-accent);}',

    '.btnav a.btnav-l{color:var(--btnav-fg);text-decoration:none;padding:16px 15px;',
    'font-weight:500;white-space:nowrap;border-bottom:2px solid transparent;transition:color .15s ease;}',
    '.btnav a.btnav-l:hover{color:var(--btnav-on);}',
    '.btnav a.btnav-l:focus-visible{outline:2px solid var(--btnav-accent);outline-offset:-2px;}',
    '.btnav a.btnav-cur{color:var(--btnav-on);border-bottom-color:var(--btnav-accent);cursor:default;}',

    /* Subscribe is the bar's one loud thing — the hub header's yellow pill. */
    '.btnav-sub{margin-left:auto;background:var(--btnav-accent);color:#0E2230;',
    'border-radius:999px;padding:7px 14px;font-weight:700;text-decoration:none;',
    'white-space:nowrap;font-size:12px;letter-spacing:.09em;}',
    '.btnav-sub:hover{filter:brightness(1.08);}',
    '.btnav-sub:focus-visible{outline:2px solid var(--btnav-on);outline-offset:2px;}',

    /* The search control sits at the far right of the bar — a quiet pill, not
       another link, so the run of links still reads as one family. */
    '.btnav-s{margin-left:10px;display:inline-flex;align-items:center;gap:7px;',
    'background:none;border:1px solid rgba(255,255,255,.22);border-radius:999px;',
    'color:var(--btnav-fg);padding:6px 13px;font:inherit;font-size:12px;letter-spacing:.09em;',
    'text-transform:uppercase;cursor:pointer;transition:color .15s ease,border-color .15s ease;}',
    '.btnav-s:hover{color:var(--btnav-on);border-color:rgba(255,255,255,.45);}',
    '.btnav-s:focus-visible{outline:2px solid var(--btnav-accent);outline-offset:2px;}',
    '.btnav-s svg{flex:none;}',
    '.btnav-s-k{font-size:10px;opacity:.55;letter-spacing:.05em;text-transform:none;}',

    /* Phones: four verbs plus the wordmark fit one row; Subscribe and search
       tighten up rather than wrap. */
    '@media (max-width:560px){.btnav{font-size:12px;letter-spacing:.06em;}',
    '.btnav-mark{font-size:15px;margin-right:9px;}',
    '.btnav-in{padding:0 10px;min-height:46px;}.btnav a.btnav-l{padding:12px 6px;}',
    '.btnav-sub{padding:6px 11px;font-size:11px;}',
    '.btnav-s{padding:5px 10px;margin-left:7px;}.btnav-s-k{display:none;}}'
  ].join('');

  function build() {
    if (document.querySelector('.btnav')) return;

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('nav');
    bar.className = 'btnav';
    bar.setAttribute('aria-label', 'BTown Brief network');

    var inner = document.createElement('div');
    inner.className = 'btnav-in';

    var mark = document.createElement('a');
    mark.className = 'btnav-mark';
    mark.href = 'https://hub.btownbrief.com/';
    mark.innerHTML = 'BTown<span>Brief</span>';
    inner.appendChild(mark);

    LINKS.forEach(function (link) {
      var current = isCurrent(link);
      var a = document.createElement('a');
      a.className = 'btnav-l' + (current ? ' btnav-cur' : '');
      a.textContent = link.label;
      if (current) {
        a.setAttribute('aria-current', 'page');
        a.removeAttribute('href');
        a.href = link.href;
      } else {
        a.href = link.href;
      }
      inner.appendChild(a);
    });

    var sub = document.createElement('a');
    sub.className = 'btnav-sub';
    sub.href = 'https://hub.btownbrief.com/#subscribe';
    sub.textContent = 'Subscribe';
    inner.appendChild(sub);

    /* Search rides in the bar but must never be able to break it. */
    try {
      var sbtn = document.createElement('button');
      sbtn.type = 'button';
      sbtn.className = 'btnav-s';
      sbtn.setAttribute('aria-label', 'Search every Btown page and game');
      sbtn.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.2" y2="16.2"/></svg>' +
        'Search <span class="btnav-s-k">' + (IS_MAC ? '⌘K' : 'Ctrl K') + '</span>';
      sbtn.addEventListener('click', function () { openSearch(sbtn); });
      inner.appendChild(sbtn);
    } catch (e) { /* search is optional; the bar is not */ }

    bar.appendChild(inner);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ============================================================
     THE ABOUT BAND

     The quiet closing note on every page: who made this, and where to read
     more. Deliberately typographic — black ground, a serif line, a warm glow
     behind it like a lamp — because it has to sit at the foot of the guide's
     photographs AND the arcade's night-blue without looking bolted on to
     either. Restraint travels; decoration doesn't.

     WHICH PAGES GET IT: the two long-form, sit-and-read properties — the city
     guide and the Everything hub. Explicitly NOT the arcade games. Two reasons:
     most of them pin their body with `overflow:hidden` or `position:fixed`, so
     anything appended to the end of the document is invisible or breaks the
     layout; and a credit band at the foot of a reflex game is just noise. The
     arcade keeps its own footer note instead.

     To switch it on somewhere new, add a host to ABOUT_ON. A page can opt out
     with `<body data-btown-about="off">`.
  ============================================================ */

  var ABOUT_ON = [
    { host: /^guide\.btownbrief\.com$/ },     // the city guide, all 17 pages
    { host: /^hub\.btownbrief\.com$/ },       // Everything
    { host: /^(localhost|127\.0\.0\.1)$/ }    // so this band can be worked on locally
  ];

  function wantsAbout() {
    if (document.body.getAttribute('data-btown-about') === 'off') return false;
    return ABOUT_ON.some(function (m) {
      if (!m.host.test(host)) return false;
      return m.path ? m.path.test(path) : true;
    });
  }

  var ABOUT = {
    eyebrow: 'The Burlington Brief',
    heading: 'One local guy builds all of this',
    body: 'The newsletter, the city guide, the arcade, the sunset forecast, the ' +
          'photographs — it’s one person, at a laptop in Burlington. No team, no ' +
          'investors, no boss.',
    read:    { label: 'Read about me',      href: 'https://www.btownbrief.com/about-me', ev: 'about-read' },
    kofi:    { label: 'Buy me a coffee',    href: 'https://ko-fi.com/btownbrief',        ev: 'about-kofi' },
    upgrade: { label: 'Upgrade the Brief',  href: 'https://www.btownbrief.com/upgrade',  ev: 'about-upgrade' },
    sign: 'Steve Davis · Burlington, Vermont'
  };

  var SUPABASE_URL = 'https://jnouvwxomrcffqwilqkq.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_RkMJQopffWlV6DSwCRkndQ_Xw6GJMf3';

  /* Which of these three actually gets clicked, and from where. Fire-and-forget:
     if quick-wins.sql hasn't run, this 404s and nobody notices. */
  function trackAbout(ev) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/rpc/btb_track_event', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_event: ev,
          p_page: (window.location.hostname + window.location.pathname).slice(0, 128),
          p_variant: ''
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) { /* analytics must never break a page */ }
  }

  var aboutCss = [
    '.btabout{--a-bg:#06080A;--a-ink:#F2F0EA;--a-soft:rgba(242,240,234,.62);',
    '--a-faint:rgba(242,240,234,.34);--a-accent:#E8A33D;--a-edge:rgba(255,255,255,.12);',
    'position:relative;display:block;width:100%;box-sizing:border-box;',
    'background:var(--a-bg);color:var(--a-ink);overflow:hidden;',
    'border-top:1px solid var(--a-edge);padding:64px 20px 52px;text-align:center;',
    "font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Helvetica,sans-serif;}",

    '.btabout *{box-sizing:border-box;}',

    /* The lamp: a soft warm pool behind the line, so the band has a centre. */
    '.btabout::before{content:"";position:absolute;left:50%;top:-30%;',
    'width:min(760px,120%);height:200%;transform:translateX(-50%);pointer-events:none;',
    'background:radial-gradient(closest-side,rgba(232,163,61,.11),transparent 72%);}',

    '.btabout-in{position:relative;max-width:620px;margin:0 auto;}',

    '.btabout-eyebrow{margin:0 0 18px;font-size:10px;font-weight:600;letter-spacing:.2em;',
    'text-transform:uppercase;color:var(--a-faint);}',

    ".btabout-h{margin:0;font-family:'Instrument Serif',Georgia,'Times New Roman',serif;",
    'font-weight:400;font-size:clamp(27px,4.4vw,38px);line-height:1.15;letter-spacing:-.01em;',
    'color:var(--a-ink);}',

    '.btabout-p{margin:16px auto 0;max-width:46ch;font-size:15px;font-weight:300;',
    'line-height:1.62;color:var(--a-soft);}',

    '.btabout-cta{display:inline-flex;align-items:center;gap:8px;margin-top:28px;',
    'padding:12px 26px;border-radius:999px;border:1px solid rgba(255,255,255,.28);',
    'background:rgba(255,255,255,.06);color:var(--a-ink);text-decoration:none;',
    'font-size:14px;font-weight:500;letter-spacing:.01em;',
    'transition:background .2s ease,border-color .2s ease,transform .2s ease;}',
    '.btabout-cta:hover{background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.5);',
    'transform:translateY(-1px);}',
    '.btabout-cta:focus-visible{outline:2px solid var(--a-accent);outline-offset:3px;}',

    /* Support links sit quietly under the main one — offered, never begged. */
    '.btabout-more{margin:20px 0 0;display:flex;justify-content:center;align-items:center;',
    'gap:14px;flex-wrap:wrap;font-size:13px;color:var(--a-faint);}',
    '.btabout-more a{color:var(--a-soft);text-decoration:none;',
    'border-bottom:1px solid rgba(255,255,255,.18);padding-bottom:1px;',
    'transition:color .2s ease,border-color .2s ease;}',
    '.btabout-more a:hover{color:var(--a-accent);border-bottom-color:var(--a-accent);}',
    '.btabout-more a:focus-visible{outline:2px solid var(--a-accent);outline-offset:2px;}',
    '.btabout-dot{color:rgba(255,255,255,.2);}',

    '.btabout-sign{margin:30px 0 0;font-size:11px;letter-spacing:.13em;text-transform:uppercase;',
    'color:var(--a-faint);}',

    '@media (max-width:520px){.btabout{padding:48px 18px 40px;}',
    '.btabout-p{font-size:14px;}.btabout-more{gap:10px;}}'
  ].join('');

  /* Instrument Serif is already loaded by the guide, the hub and Stay Awhile.
     The arcade and the merch shop don't load it — so pull it in, once, only if
     nobody else has. Falls back to Georgia if the request never lands. */
  function ensureSerif() {
    var have = [].some.call(document.querySelectorAll('link[href]'), function (l) {
      return l.href.indexOf('Instrument+Serif') !== -1;
    });
    if (have) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap';
    document.head.appendChild(l);
  }

  function link(spec) {
    var a = document.createElement('a');
    a.href = spec.href;
    a.textContent = spec.label;
    a.rel = 'noopener';
    a.addEventListener('click', function () { trackAbout(spec.ev); });
    return a;
  }

  function buildAbout() {
    if (document.querySelector('.btabout')) return;
    if (!wantsAbout()) return;

    ensureSerif();

    var style = document.createElement('style');
    style.textContent = aboutCss;
    document.head.appendChild(style);

    // <aside>, not <footer>: most of these pages already have a footer, and two
    // contentinfo landmarks is a screen-reader papercut.
    var band = document.createElement('aside');
    band.className = 'btabout';
    band.setAttribute('aria-label', 'About the Burlington Brief');

    var inner = document.createElement('div');
    inner.className = 'btabout-in';

    var eyebrow = document.createElement('p');
    eyebrow.className = 'btabout-eyebrow';
    eyebrow.textContent = ABOUT.eyebrow;

    var h = document.createElement('p');
    h.className = 'btabout-h';
    h.textContent = ABOUT.heading;

    var p = document.createElement('p');
    p.className = 'btabout-p';
    p.textContent = ABOUT.body;

    var cta = link(ABOUT.read);
    cta.className = 'btabout-cta';
    cta.textContent = ABOUT.read.label + ' →';

    var more = document.createElement('p');
    more.className = 'btabout-more';
    more.appendChild(link(ABOUT.kofi));
    var dot = document.createElement('span');
    dot.className = 'btabout-dot';
    dot.textContent = '·';
    more.appendChild(dot);
    more.appendChild(link(ABOUT.upgrade));

    var sign = document.createElement('p');
    sign.className = 'btabout-sign';
    sign.textContent = ABOUT.sign;

    inner.appendChild(eyebrow);
    inner.appendChild(h);
    inner.appendChild(p);
    inner.appendChild(cta);
    inner.appendChild(more);
    inner.appendChild(sign);
    band.appendChild(inner);

    document.body.appendChild(band);
  }

  /* ============================================================
     NETWORK SEARCH

     One palette, every property: type a few letters, land on any page or
     game in the network. Opened from the bar's Search pill, ⌘K / Ctrl-K,
     or plain `/` when you're not typing in something.

     The index is deliberately split in two, both living on this host:
       search-index.json — the curated pages (EDIT THAT FILE to add a page)
       games.json        — the arcade's own source of truth, read live, so a
                           new game shows up in search the moment it's live
     Both fetches are lazy (first open) and both are allowed to fail: the
     palette degrades to whichever half arrived, or a quiet "can't search
     right now" line. Search must never cost a page anything.
  ============================================================ */

  var SEARCH_HOME = 'https://play.btownbrief.com';
  var IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');

  var searchItems = null;     // null until loaded; [] if both halves failed
  var searchFetch = null;
  var searchUi = null;
  var searchResults = [];
  var searchActive = 0;
  var searchPrevFocus = null;

  function loadSearchIndex() {
    if (searchFetch) return searchFetch;
    function grab(url) {
      return fetch(url).then(function (r) { return r.ok ? r.json() : null; })
                       .catch(function () { return null; });
    }
    searchFetch = Promise.all([
      grab(SEARCH_HOME + '/search-index.json'),
      grab(SEARCH_HOME + '/games.json')
    ]).then(function (got) {
      var items = ((got[0] && got[0].pages) || []).slice();
      ((got[1] && got[1].games) || []).forEach(function (g) {
        if (!g || g.live === false || !g.slug) return;
        items.push({
          title: (g.emoji ? g.emoji + ' ' : '') + (g.name || g.slug),
          url: SEARCH_HOME + '/' + g.slug + '/',
          section: 'Games',
          keywords: g.pitch || ''
        });
      });
      searchItems = items;
      return items;
    });
    return searchFetch;
  }

  /* Every typed word has to land somewhere; where it lands sets the rank.
     Title beginnings beat title words beat title fragments beat keywords. */
  function searchScore(item, words) {
    var title = item._t || (item._t = String(item.title || '').toLowerCase());
    var hay = item._h ||
      (item._h = (item.title + ' ' + (item.keywords || '') + ' ' + (item.section || '')).toLowerCase());
    var score = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (title.indexOf(w) === 0) score += 40;
      else if (title.indexOf(' ' + w) !== -1) score += 25;
      else if (title.indexOf(w) !== -1) score += 15;
      else if (hay.indexOf(w) !== -1) score += 6;
      else return 0;
    }
    return score;
  }

  var searchCss = [
    '.btsearch{position:fixed;inset:0;z-index:2147483000;display:flex;',
    'align-items:flex-start;justify-content:center;padding:12vh 16px 16px;}',
    '.btsearch[hidden]{display:none;}',
    '.btsearch-bd{position:absolute;inset:0;background:rgba(4,10,15,.62);}',

    /* The panel wears the bar's own night-navy and amber, on every property —
       the palette belongs to the network, not to the page underneath it. */
    '.btsearch-p{position:relative;width:min(600px,100%);background:#0E2230;color:#E8EEF2;',
    'border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;',
    'box-shadow:0 24px 64px rgba(0,0,0,.5);',
    "font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Helvetica,sans-serif;}",
    '.btsearch-p *{box-sizing:border-box;}',

    /* 16px input: anything smaller makes iOS zoom the page on focus. */
    '.btsearch-in{width:100%;border:none;outline:none;background:transparent;color:#fff;',
    'font:inherit;font-size:16px;padding:16px 18px;',
    'border-bottom:1px solid rgba(255,255,255,.12);}',
    '.btsearch-in::placeholder{color:rgba(232,238,242,.45);}',

    '.btsearch-ls{list-style:none;margin:0;padding:6px;overflow-y:auto;',
    'max-height:min(48vh,420px);overscroll-behavior:contain;}',
    '.btsearch-ls a{display:flex;align-items:baseline;gap:12px;justify-content:space-between;',
    'padding:10px 12px;border-radius:8px;color:#DCE6EC;text-decoration:none;font-size:15px;}',
    '.btsearch-ls li.on a{background:rgba(232,163,61,.16);color:#fff;}',
    '.btsearch-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.btsearch-sec{flex:none;font-size:10px;letter-spacing:.12em;text-transform:uppercase;',
    'color:rgba(232,163,61,.85);}',
    '.btsearch-none{padding:18px;color:rgba(232,238,242,.55);font-size:14px;}',

    '.btsearch-hint{padding:9px 14px;border-top:1px solid rgba(255,255,255,.1);',
    'font-size:11px;letter-spacing:.08em;text-transform:uppercase;',
    'color:rgba(232,238,242,.4);display:flex;gap:16px;}',

    '@media (max-width:560px){.btsearch{padding:6vh 10px 10px;}',
    '.btsearch-hint{display:none;}}'
  ].join('');

  function buildSearchUi() {
    if (searchUi) return searchUi;

    var style = document.createElement('style');
    style.textContent = searchCss;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'btsearch';
    wrap.hidden = true;

    var bd = document.createElement('div');
    bd.className = 'btsearch-bd';
    bd.addEventListener('click', closeSearch);

    var panel = document.createElement('div');
    panel.className = 'btsearch-p';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Search the Btown network');

    var input = document.createElement('input');
    input.className = 'btsearch-in';
    input.type = 'text';
    input.placeholder = 'Search pages & games…';
    input.setAttribute('aria-label', 'Search every Btown page and game');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'btsearch-list');

    var list = document.createElement('ul');
    list.className = 'btsearch-ls';
    list.id = 'btsearch-list';
    list.setAttribute('role', 'listbox');

    var hint = document.createElement('div');
    hint.className = 'btsearch-hint';
    hint.innerHTML = '<span>↑↓ move</span><span>↩ open</span><span>esc close</span>';

    input.addEventListener('input', function () { renderSearch(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
      else if (e.key === 'Enter') {
        var hit = searchResults[searchActive];
        if (hit) { trackAbout('search-go'); window.location.href = hit.url; }
      } else if (e.key === 'Escape') { e.stopPropagation(); closeSearch(); }
    });

    panel.appendChild(input);
    panel.appendChild(list);
    panel.appendChild(hint);
    wrap.appendChild(bd);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    searchUi = { wrap: wrap, input: input, list: list };
    return searchUi;
  }

  function renderSearch(query) {
    var ui = searchUi;
    if (!ui) return;

    if (searchItems === null) {
      ui.list.innerHTML = '<li class="btsearch-none">Loading the map of everything…</li>';
      searchResults = [];
      return;
    }
    if (!searchItems.length) {
      ui.list.innerHTML = '<li class="btsearch-none">Can’t search right now — try the nav links above.</li>';
      searchResults = [];
      return;
    }

    var words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      /* Empty box: the index's own opening order is a decent "jump anywhere" menu. */
      searchResults = searchItems.slice(0, 9);
    } else {
      searchResults = searchItems
        .map(function (it) { return { it: it, s: searchScore(it, words) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 10)
        .map(function (r) { return r.it; });
    }
    searchActive = 0;

    if (!searchResults.length) {
      ui.list.innerHTML = '<li class="btsearch-none">Nothing called “' +
        String(query).replace(/</g, '‹') + '” yet.</li>';
      return;
    }

    ui.list.innerHTML = '';
    searchResults.forEach(function (item, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = 'btsearch-o' + i;
      li.setAttribute('aria-selected', i === searchActive ? 'true' : 'false');
      if (i === searchActive) li.className = 'on';

      var a = document.createElement('a');
      a.href = item.url;
      a.addEventListener('click', function () { trackAbout('search-go'); });

      var t = document.createElement('span');
      t.className = 'btsearch-t';
      t.textContent = item.title;

      var sec = document.createElement('span');
      sec.className = 'btsearch-sec';
      sec.textContent = item.section || '';

      a.appendChild(t);
      a.appendChild(sec);
      li.appendChild(a);
      li.addEventListener('mouseenter', function () { setSearchActive(i); });
      ui.list.appendChild(li);
    });
    ui.input.setAttribute('aria-activedescendant', 'btsearch-o0');
  }

  function setSearchActive(i) {
    if (!searchUi || !searchResults.length) return;
    searchActive = (i + searchResults.length) % searchResults.length;
    [].forEach.call(searchUi.list.children, function (li, j) {
      li.className = j === searchActive ? 'on' : '';
      li.setAttribute('aria-selected', j === searchActive ? 'true' : 'false');
    });
    searchUi.input.setAttribute('aria-activedescendant', 'btsearch-o' + searchActive);
    var el = searchUi.list.children[searchActive];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function moveSearch(dir) { setSearchActive(searchActive + dir); }

  function openSearch(fromEl) {
    try {
      var ui = buildSearchUi();
      searchPrevFocus = fromEl || document.activeElement;
      ui.wrap.hidden = false;
      ui.input.value = '';
      renderSearch('');
      ui.input.focus();
      trackAbout('search-open');
      loadSearchIndex().then(function () {
        if (!ui.wrap.hidden) renderSearch(ui.input.value);
      });
    } catch (e) { /* never let search take a page down */ }
  }

  function closeSearch() {
    if (!searchUi || searchUi.wrap.hidden) return;
    searchUi.wrap.hidden = true;
    if (searchPrevFocus && searchPrevFocus.focus) {
      try { searchPrevFocus.focus(); } catch (e) {}
    }
  }

  function searchIsOpen() {
    return !!(searchUi && !searchUi.wrap.hidden);
  }

  function initSearchKeys() {
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey &&
          (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchIsOpen() ? closeSearch() : openSearch();
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !searchIsOpen()) {
        var t = e.target;
        var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (!typing) { e.preventDefault(); openSearch(); }
      }
    });
  }

  function start() {
    build();
    buildAbout();
    try { initSearchKeys(); } catch (e) { /* shortcuts are sugar, not structure */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
