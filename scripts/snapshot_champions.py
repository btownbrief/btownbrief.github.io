#!/usr/bin/env python3
"""Snapshot the month's leaderboard champions into one small JSON file.

The leaderboards have no static endpoint — reading them means one
get_leaderboard RPC per game (29 and counting), which is fine for the
leaderboards page but far too chatty for anything that just wants to say
"who's winning?" (the Pulse Live board, the newsletter, a ticker).

This script does the fan-out once, on a schedule, and writes
data/champions.json: per-game champion + player count, plus the Arcade
Royalty ranking (same crowns > podiums > boards math as the leaderboards
page). The champions workflow force-pushes it to the `champions-data`
branch, mirroring btown-brief's pulse-data pattern, so consumers fetch
raw.githubusercontent.com and no Pages deploy ever queues.

Scores are raw leaderboard numbers and DON'T compare across games; some
games encode times or margins. scoreText is only set where the encoding
is known (maple-scramble: score = 36000 - deciseconds).

Usage: snapshot_champions.py --out /tmp/out/data/champions.json
"""

import argparse
import datetime
import json
import pathlib
import sys
import urllib.request
from zoneinfo import ZoneInfo

REPO = pathlib.Path(__file__).resolve().parent.parent
SUPABASE_URL = "https://jnouvwxomrcffqwilqkq.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_RkMJQopffWlV6DSwCRkndQ_Xw6GJMf3"
TZ = ZoneInfo("America/New_York")

# Below this many populated boards, assume Supabase (not the arcade) is
# having a bad day and keep the last good snapshot.
MIN_BOARDS = 3


def rpc(fn: str, args: dict):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
        data=json.dumps(args).encode(),
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        body = res.read().decode()
    return json.loads(body) if body else []


def score_text(slug: str, score: int):
    if slug == "maple-scramble":
        # leaderboard scores are 36000 - deciseconds elapsed
        ds = 36000 - score
        if 0 < ds < 36000:
            return f"{ds / 10:.1f}s"
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    games = json.loads((REPO / "games.json").read_text())["games"]
    games = [g for g in games if g.get("live") and g.get("leaderboard")]

    now = datetime.datetime.now(TZ)
    month = f"{now.year}-{now.month:02d}"

    boards = []
    players: dict = {}  # player_id -> royalty tally
    for g in games:
        try:
            rows = rpc("get_leaderboard", {"p_game": g["slug"], "p_month": month}) or []
        except Exception as e:  # noqa: BLE001 — a single dead board shouldn't kill the run
            print(f"warn: {g['slug']}: {e}", file=sys.stderr)
            rows = []
        if not rows:
            continue
        top = rows[0]
        seen: dict = {}  # first appearance per player on this board
        for i, r in enumerate(rows[:10]):
            pid = r.get("player_id")
            if pid and pid not in seen:
                seen[pid] = i
        for pid, pos in seen.items():
            p = players.setdefault(pid, {"name": "", "crowns": 0, "podiums": 0, "boards": 0})
            p["boards"] += 1
            if pos == 0:
                p["crowns"] += 1
                p["name"] = top.get("name") or p["name"]
            if pos < 3:
                p["podiums"] += 1
            if not p["name"]:
                p["name"] = next((r.get("name") for r in rows[:10]
                                  if r.get("player_id") == pid and r.get("name")), "")
        board = {
            "slug": g["slug"],
            "name": g["name"],
            "emoji": g.get("emoji", ""),
            "champ": top.get("name") or "Anonymous",
            "score": top.get("score"),
            "players": len(seen),
        }
        st = score_text(g["slug"], top.get("score") or 0)
        if st:
            board["scoreText"] = st
        boards.append(board)

    if len(boards) < MIN_BOARDS:
        print(f"only {len(boards)} populated boards — refusing to overwrite "
              "the snapshot with a probably-broken read", file=sys.stderr)
        return 1

    royalty = sorted(
        (p for p in players.values() if p["podiums"] > 0 and p["name"]),
        key=lambda p: (-p["crowns"], -p["podiums"], -p["boards"]),
    )[:5]

    out = {
        "updated": datetime.datetime.now(datetime.timezone.utc)
                   .strftime("%Y-%m-%dT%H:%M:%SZ"),
        "month": month,
        "monthLabel": now.strftime("%B"),
        "games": boards,
        "royalty": royalty,
    }
    dest = pathlib.Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {dest}: {len(boards)} boards, {len(royalty)} royalty")
    return 0


if __name__ == "__main__":
    sys.exit(main())
