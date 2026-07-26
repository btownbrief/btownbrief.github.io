-- Btown Games shared leaderboard — hardening patch v2 (2026-07-26)
-- =========================================================================
-- Paste this whole file into the Supabase SQL Editor (btown-games project)
-- and click Run once. Safe to re-run any time.
--
-- Why v2: the first version assumed the newer reference schema some repos
-- carry, but the LIVE database runs the original single-table variant
-- (no claim_player helper), so v1 stopped with "function does not exist"
-- and rolled back cleanly. Good news discovered along the way: the live
-- submit_score ALREADY rejects scores over 1,000,000, so the worst-case
-- attack was never possible here.
--
-- What v2 adds: tighter per-game caps for games whose true maximum is far
-- below a million, enforced by a trigger on the scores table itself — no
-- existing function is touched, so nothing else can drift or break.
--
-- Seeded caps:
--   maple-scramble  36000   (score = 36000 - deciseconds; mathematical max)
-- Games without a row keep the existing 1,000,000 global cap.
-- To cap another game later:
--   insert into public.game_limits values ('game-slug', 123456)
--   on conflict (game) do update set max_score = excluded.max_score;

create table if not exists public.game_limits (
  game      text    primary key,
  max_score integer not null check (max_score > 0)
);

alter table public.game_limits enable row level security;
revoke all on public.game_limits from anon, authenticated;

insert into public.game_limits (game, max_score) values
  ('maple-scramble', 36000)
on conflict (game) do update set max_score = excluded.max_score;

-- Reject any write that would exceed the game's cap. Returning null from a
-- BEFORE trigger silently skips that write and keeps the existing row, the
-- same forgiving spirit as submit_score's own junk guard.
create or replace function public.enforce_score_cap() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
begin
  select max_score into v_cap from game_limits where game = new.game;
  if v_cap is not null and new.score > v_cap then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists score_cap on public.scores;
create trigger score_cap
  before insert or update of score on public.scores
  for each row execute function public.enforce_score_cap();
