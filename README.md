# Btown Games — Arcade Hub

The front door for the Btown Brief browser arcade at **play.btownbrief.com**
(also served at https://btownbrief.github.io/). Plain static site, no build step.

This repo is the org **root** site (`btownbrief/btownbrief.github.io`), so it serves
at the domain root and every project game (its own repo) serves under it at
`/<slug>/` on both `btownbrief.github.io` and `play.btownbrief.com`.

## Files
- `index.html` / `style.css` — the arcade landing page.
- `games.json` — **edit this** to add/reorder games or flip `live` flags.
  Each entry: `slug`, `name`, `emoji`, `pitch`, `live`.
- `hub.js` — renders cabinet cards, greets a returning player, and loads each
  live game's reigning monthly champ + your personal rank.
- `leaderboard.js` — read-only Supabase client (same project/key as every game).
- `CNAME` — custom domain (`play.btownbrief.com`).

## Adding a game
Add an object to `games.json`. Set `live: false` for a "COMING SOON" cabinet;
flip to `true` once `https://btownbrief.github.io/<slug>/` returns 200. The
champ line uses `slug` as the leaderboard game key (matches each game's `GAME`).

## Deploy
Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) publishes Pages.
