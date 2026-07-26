-- Btown Games shared leaderboard — hardening patch (2026-07-26)
-- =========================================================================
-- Paste this whole file into the Supabase SQL Editor (btown-games project)
-- and click Run once. Safe to re-run any time.
--
-- What it fixes (from the July 2026 fleet code review):
--
--  1) submit_score accepted ANY positive integer for any game slug, so
--     anyone holding the public browser key could pin absurd scores
--     (e.g. 2147483647) to the top of a board for a month. This patch adds
--     per-game score caps with a generous default, WITHOUT breaking the
--     "new games self-register on first score" behavior the fleet relies on.
--
--  2) Belt-and-braces: PostgreSQL grants EXECUTE on new functions to PUBLIC
--     by default. Our API doesn't expose claim_player anyway (verified),
--     but this makes the intent explicit so a future change can't
--     accidentally open it.
--
-- Known caps seeded below:
--   maple-scramble  36000  (score = 36000 - deciseconds, so 36000 is the
--                           mathematical ceiling)
-- Every other game gets the 10,000,000 default — far above any real score,
-- low enough to stop integer-max vandalism. To cap another game later:
--   insert into public.game_limits values ('game-slug', 123456)
--   on conflict (game) do update set max_score = excluded.max_score;

create table if not exists public.game_limits (
  game      text    primary key,
  max_score integer not null check (max_score > 0)
);

alter table public.game_limits enable row level security;
revoke all on public.game_limits from public, anon, authenticated;

insert into public.game_limits (game, max_score) values
  ('maple-scramble', 36000)
on conflict (game) do update set max_score = excluded.max_score;

-- Same submit_score as before, plus the cap check.
create or replace function public.submit_score(
  p_game text, p_player uuid, p_token text, p_name text, p_score integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
begin
  -- ignore junk submissions rather than error out
  if p_score is null or p_score <= 0 or coalesce(p_name, '') = '' then
    return;
  end if;

  -- per-game cap, generous default for games without an entry
  select max_score into v_cap from game_limits where game = p_game;
  if p_score > coalesce(v_cap, 10000000) then
    return;  -- silently drop impossible scores, same spirit as the junk guard
  end if;

  perform claim_player(p_player, p_token, p_name);

  insert into scores (game, player_id, month_key, score)
  values (
    p_game,
    p_player,
    to_char(now() at time zone 'America/New_York', 'YYYY-MM'),
    p_score
  )
  on conflict (game, player_id, month_key) do update
    set score      = greatest(scores.score, excluded.score),
        updated_at = now();
end;
$$;

-- Explicit grants: clear the default PUBLIC execute, re-grant only the
-- three intended public RPCs.
revoke all on function public.claim_player(uuid, text, text)                    from public, anon, authenticated;
revoke all on function public.submit_score(text, uuid, text, text, integer)     from public;
revoke all on function public.rename_player(uuid, text, text)                   from public;
revoke all on function public.get_leaderboard(text, text)                       from public;

grant execute on function public.submit_score(text, uuid, text, text, integer)  to anon, authenticated;
grant execute on function public.rename_player(uuid, text, text)                to anon, authenticated;
grant execute on function public.get_leaderboard(text, text)                    to anon, authenticated;
