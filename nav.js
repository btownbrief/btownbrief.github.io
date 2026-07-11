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
 */
(function () {
  'use strict';

  if (window.__btownNav) return;
  window.__btownNav = true;

  /*
   * `on` lists every place a link counts as "you are here". The city guide has two,
   * because it answers on its own subdomain AND still answers on the old
   * play.btownbrief.com/btown-brief/ path that older newsletter issues link to.
   */
  var LINKS = [
    {
      label: 'The Brief',
      href: 'https://www.btownbrief.com',
      on: [{ host: /^(www\.)?btownbrief\.com$/ }]
    },
    {
      label: 'Things To Do',
      href: 'https://guide.btownbrief.com/things-to-do.html',
      on: [{ host: /^guide\.btownbrief\.com$/, path: /^\/things-to-do\.html$/ }]
    },
    {
      // The guide's other 14 pages. Things To Do stands on its own above.
      label: 'City Guide',
      href: 'https://guide.btownbrief.com/',
      on: [
        { host: /^guide\.btownbrief\.com$/, path: /^\/(?!things-to-do\.html)/ },
        { host: /^play\.btownbrief\.com$/, path: /^\/btown-brief\// }
      ]
    },
    {
      label: 'Arcade',
      href: 'https://play.btownbrief.com/',
      on: [{ host: /^play\.btownbrief\.com$/, path: /^\/$/ }]
    },
    {
      label: 'Merch',
      href: 'https://stephenvdavis-jpg.github.io/t-shirts/',
      on: [{ host: /stephenvdavis-jpg\.github\.io$/, path: /^\/t-shirts\// }]
    },
    {
      label: 'Everything',
      href: 'https://hub.btownbrief.com/',
      on: [
        { host: /^hub\.btownbrief\.com$/ },
        { host: /^play\.btownbrief\.com$/, path: /^\/everything\// }   // the old address, still redirecting
      ]
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
    'font-size:13px;letter-spacing:.09em;text-transform:uppercase;line-height:1;}',

    '.btnav *{box-sizing:border-box;}',
    '.btnav-in{max-width:1120px;margin:0 auto;padding:0 16px;display:flex;align-items:center;',
    'gap:4px;min-height:38px;flex-wrap:wrap;}',

    '.btnav-mark{font-weight:700;color:var(--btnav-on);letter-spacing:.12em;',
    'margin-right:10px;white-space:nowrap;text-decoration:none;display:flex;align-items:center;gap:6px;}',
    '.btnav-mark span{color:var(--btnav-accent);}',

    '.btnav a.btnav-l{color:var(--btnav-fg);text-decoration:none;padding:11px 10px;',
    'font-weight:500;white-space:nowrap;border-bottom:2px solid transparent;transition:color .15s ease;}',
    '.btnav a.btnav-l:hover{color:var(--btnav-on);}',
    '.btnav a.btnav-l:focus-visible{outline:2px solid var(--btnav-accent);outline-offset:-2px;}',
    '.btnav a.btnav-cur{color:var(--btnav-on);border-bottom-color:var(--btnav-accent);cursor:default;}',

    '@media (max-width:420px){.btnav{font-size:12px;}.btnav-in{gap:0;}',
    '.btnav a.btnav-l{padding:10px 7px;}.btnav-mark{margin-right:6px;}}'
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
    mark.href = 'https://www.btownbrief.com';
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

  function start() {
    build();
    buildAbout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
