/*
 * BTown Brief — shared top nav.
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
      label: 'City Guide',
      href: 'https://guide.btownbrief.com/',
      on: [
        { host: /^guide\.btownbrief\.com$/ },
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
      href: 'https://play.btownbrief.com/everything/',
      on: [{ host: /^play\.btownbrief\.com$/, path: /^\/everything\// }]
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
