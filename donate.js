// Donate card for the arcade — same Ko-fi A/B copy test as the main site.
// The sticky variant key is shared across play.btownbrief.com, so a visitor
// sees one consistent pitch everywhere; clicks land in btb_events (see the
// btown-brief repo's db/quick-wins.sql — until that runs, tracking no-ops).
(function () {
  'use strict';

  var KOFI_URL = 'https://ko-fi.com/btownbrief';
  var SUPABASE_URL = 'https://jnouvwxomrcffqwilqkq.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_RkMJQopffWlV6DSwCRkndQ_Xw6GJMf3';

  var DONATE_COPY = {
    A: { // personal
      heading: 'One local guy builds all of this',
      body: 'The newsletter, the guides, every cabinet in this arcade — it’s just me, Steve, at a laptop in Burlington. If a game ever ate your lunch break, a coffee keeps the machines running.',
      button: '☕ Buy me a coffee',
    },
    B: { // civic
      heading: 'Keep Burlington’s arcade free',
      body: 'No paywall, no ads, no coin slot — just free local games and info for everyone who loves this city. Chip in to keep it that way.',
      button: '❤️ Chip in on Ko-fi',
    },
  };
  var ACTIVE_DONATE_VARIANT = 'AB'; // 'A'/'B' pins a variant; 'AB' = sticky 50/50

  function donateVariant() {
    if (ACTIVE_DONATE_VARIANT !== 'AB') return ACTIVE_DONATE_VARIANT;
    var v = null;
    try { v = localStorage.getItem('btb-donate-variant'); } catch (e) {}
    if (v !== 'A' && v !== 'B') {
      v = Math.random() < 0.5 ? 'A' : 'B';
      try { localStorage.setItem('btb-donate-variant', v); } catch (e) {}
    }
    return v;
  }

  function track(variant) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/rpc/btb_track_event', {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event: 'strip-donate', p_page: 'arcade-hub', p_variant: variant }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) { /* analytics must never break the arcade */ }
  }

  var slot = document.getElementById('donate-slot');
  if (!slot) return;
  var variant = donateVariant();
  var copy = DONATE_COPY[variant];

  slot.innerHTML =
    '<div class="donate-inner">' +
      '<span class="donate-badge">🪙 INSERT COIN (OPTIONAL)</span>' +
      '<h2 class="donate-head"></h2>' +
      '<p class="donate-body"></p>' +
      '<a class="donate-cta" href="' + KOFI_URL + '" target="_blank" rel="noopener"></a>' +
    '</div>';
  slot.querySelector('.donate-head').textContent = copy.heading;
  slot.querySelector('.donate-body').textContent = copy.body;
  slot.querySelector('.donate-cta').textContent = copy.button;
  slot.querySelector('.donate-cta').addEventListener('click', function () { track(variant); });
})();
