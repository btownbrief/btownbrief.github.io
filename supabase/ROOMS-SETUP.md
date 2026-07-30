# Switching on online multiplayer (one paste, one time)

The board and card games now have a "play a friend online" mode: one phone
gets a 4-letter code, the friend types it in, and the two phones play the
same game live. All of them share ONE backend — this folder's
`rooms-2026-07-30.sql`.

Until you run that file, the games are still fine: the online buttons just
say online play isn't switched on yet. Everything else (bots, pass-and-play)
works as before.

## What to do

1. Open the Supabase dashboard → the **btown-games** project (the same one
   the leaderboard uses).
2. Left sidebar → **SQL Editor** → **New query**.
3. Paste the whole contents of `rooms-2026-07-30.sql` and click **Run**.
4. That's it — every game (and any future game) is now online-enabled.
   Nothing per-game to configure, same as the leaderboard.

Safe to re-run any time; running it twice changes nothing.

## What it creates, in plain language

- One `game_rooms` table. A room = a 4-letter code, which game it's for,
  who's sitting in it, and the full game position as JSON.
- Five little functions the games call: create a room, join by code, poll
  it, push a move, leave. Row Level Security stays locked — the public key
  can ONLY go through these functions, matching how caption-this and the
  leaderboard already work.
- Rooms clean themselves up: anything untouched for 24 hours (or an
  unjoined room after 2 hours) is deleted automatically the next time
  anyone creates a room. No cron, no maintenance, and the table stays tiny
  on the free tier.

## Honest limits (fine for friendly games)

- Moves are checked by the game's own rules on both phones and the server
  referees turn order and simultaneous writes — but a determined cheater
  with devtools could read hidden info (their pal's Battleship fleet) or
  push a rule-breaking move. For strangers-vs-strangers ranked play we'd
  want a server-side referee; for "read this code to your friend" games
  this is the right tradeoff.
- Games poll every ~2.5 seconds rather than holding realtime connections —
  slower by a blink, but it can never exhaust Supabase's free-tier
  realtime connection cap no matter how many people play at once.
