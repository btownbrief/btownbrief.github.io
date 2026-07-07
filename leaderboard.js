// Read-only leaderboard client for the arcade hub.
// Same Supabase project / anon key / RPC as every Btown game
// (see Church Street Runner's src/leaderboard.js). We only ever READ:
// get_leaderboard returns each game's monthly top scores, best-first.

const SUPABASE_URL = 'https://jnouvwxomrcffqwilqkq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RkMJQopffWlV6DSwCRkndQ_Xw6GJMf3';

// Shared per-domain identity keys, reused by every game on this origin.
export function playerId() {
  return localStorage.getItem('btown-player-id') || '';
}
export function getName() {
  return localStorage.getItem('btown-player-name') || '';
}

// offset 0 = this month, -1 = last month — matches the server's month_key.
function monthDate(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d;
}
export function monthKey(offset = 0) {
  const d = monthDate(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function monthLabel(offset = 0) {
  return monthDate(offset).toLocaleString('en-US', { month: 'long' });
}

async function rpc(fn, args) {
  const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Returns [{ name, score, player_id }] best-first for a game this month.
export async function fetchTop(game, monthOffset = 0) {
  return (await rpc('get_leaderboard', { p_game: game, p_month: monthKey(monthOffset) })) || [];
}
