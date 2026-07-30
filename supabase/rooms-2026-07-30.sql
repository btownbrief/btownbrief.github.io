-- BTOWN GAME ROOMS — shared online-multiplayer layer for the Btown arcade.
-- Paste this WHOLE file into the Supabase SQL Editor (same btown-games
-- project as the scores leaderboard) and click Run. Safe to re-run.
--
-- One table serves every turn-based game (Four in a Rowboat, Maple Mancala,
-- Crazy Eights, Kings Corner, Cribbage, Checkers, Battle on the Lake,
-- Crossings, Sugarbush Squares, Peak Foliage, and any future sibling).
-- Games self-register: the first room created for a new slug just works,
-- zero setup — same philosophy as the leaderboard.
--
-- How it referees: a room holds the game's entire engine state as opaque
-- JSON plus a version number. A player may only write through room_push(),
-- which requires their secret token AND the version they last saw — two
-- phones can never trample each other (the loser gets 'version_conflict'
-- and refetches). Rule legality itself is enforced by the game's engine on
-- both phones, which both run the identical pure engine.js. A tampered
-- client could push an illegal state — accepted for friendly games; the
-- honest phone still sees exactly what happened.
--
-- Security model matches caption-this / the scores schema: RLS locks the
-- table completely; the public anon key can ONLY go through the
-- security-definer functions below. Tokens are stored hashed (sha256), so
-- even a leaked table row can't be used to impersonate a player.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- table

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{4}$'),
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'over')),
  max_seats int not null default 2 check (max_seats between 2 and 4),
  -- [{seat, name, player_id, token_hash, last_seen, left}] — token_hash is
  -- NEVER returned to clients; last_seen is unix seconds.
  seats jsonb not null default '[]'::jsonb,
  state jsonb not null,             -- the game engine's state, opaque here
  version int not null default 0,   -- bumps on every accepted push
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_updated_at on public.game_rooms (updated_at);

alter table public.game_rooms enable row level security;
revoke all on table public.game_rooms from anon, authenticated;

-- --------------------------------------------------------------- helpers

create or replace function public.br_token_hash(p_token text) returns text
language sql immutable as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Seats as clients may see them (token_hash stripped).
create or replace function public.br_public_seats(p_seats jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_agg(s - 'token_hash' order by (s->>'seat')::int), '[]'::jsonb)
  from jsonb_array_elements(p_seats) s;
$$;

-- Which seat does this token own? -1 if none.
create or replace function public.br_seat_of(p_seats jsonb, p_token text) returns int
language sql immutable as $$
  select coalesce(
    (select (s->>'seat')::int from jsonb_array_elements(p_seats) s
      where s->>'token_hash' = public.br_token_hash(p_token) limit 1),
    -1);
$$;

-- Rooms are ephemeral: sweep finished/stale ones so the table stays tiny.
-- Called opportunistically from room_create — zero maintenance.
create or replace function public.br_sweep_rooms() returns void
language sql security definer set search_path = public as $$
  delete from public.game_rooms
  where updated_at < now() - interval '24 hours'
     or (status = 'waiting' and created_at < now() - interval '2 hours');
$$;

create or replace function public.br_check_state(p_state jsonb) returns void
language plpgsql immutable as $$
begin
  if p_state is null then
    raise exception using message = 'bad_state';
  end if;
  if pg_column_size(p_state) > 131072 then   -- 128 KB is plenty for any board
    raise exception using message = 'state_too_big';
  end if;
end;
$$;

create or replace function public.br_clean_name(p_name text) returns text
language plpgsql immutable as $$
declare v text := left(btrim(coalesce(p_name, '')), 24);
begin
  if v = '' then v := 'Player'; end if;
  return v;
end;
$$;

-- ------------------------------------------------------------------ RPCs

-- Host opens a room. The host's phone builds the initial engine state
-- (including any shuffle/deal) and sits in seat 0. Returns the 4-letter
-- code to read to a friend.
create or replace function public.room_create(
  p_game text, p_name text, p_player text, p_token text,
  p_state jsonb, p_seats int default 2
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_try int := 0;
begin
  if p_game is null or p_game !~ '^[a-z0-9-]{1,40}$' then
    raise exception using message = 'bad_game';
  end if;
  if coalesce(length(p_token), 0) not between 8 and 64
     or coalesce(length(p_player), 0) not between 1 and 64 then
    raise exception using message = 'bad_identity';
  end if;
  if p_seats is null or p_seats not between 2 and 4 then
    raise exception using message = 'bad_seats';
  end if;
  perform public.br_check_state(p_state);
  perform public.br_sweep_rooms();

  -- One open room per device per game — creating again replaces it. Both
  -- player_id AND the device token must match, so nobody can sweep away a
  -- stranger's open room just by knowing their (semi-public) player id.
  delete from public.game_rooms
  where game = p_game and status = 'waiting'
    and seats @> jsonb_build_array(jsonb_build_object(
          'player_id', p_player,
          'token_hash', public.br_token_hash(p_token)));

  loop
    v_try := v_try + 1;
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet,
        1 + (get_byte(extensions.gen_random_bytes(1), 0) % 31), 1);
    end loop;
    begin
      insert into public.game_rooms (code, game, max_seats, seats, state)
      values (
        v_code, p_game, p_seats,
        jsonb_build_array(jsonb_build_object(
          'seat', 0,
          'name', public.br_clean_name(p_name),
          'player_id', p_player,
          'token_hash', public.br_token_hash(p_token),
          'last_seen', extract(epoch from now())::bigint,
          'left', false)),
        p_state)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_try >= 20 then
        raise exception using message = 'no_codes_left';
      end if;
    end;
  end loop;

  return jsonb_build_object('room_id', v_id, 'code', v_code, 'seat', 0);
end;
$$;

-- Friend joins with the code. Filling the last seat starts the game.
-- Joining a code you already sit in (same token) just returns your seat —
-- refreshing the page never burns a chair.
create or replace function public.room_join(
  p_code text, p_game text, p_name text, p_player text, p_token text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms%rowtype;
  v_seat int;
  v_taken int;
begin
  if coalesce(length(p_token), 0) not between 8 and 64
     or coalesce(length(p_player), 0) not between 1 and 64 then
    raise exception using message = 'bad_identity';
  end if;

  select * into r from public.game_rooms
  where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    raise exception using message = 'not_found';
  end if;
  if r.game <> p_game then
    -- Friendly steer: the code exists, but for a different game.
    raise exception using message = 'wrong_game:' || r.game;
  end if;

  v_seat := public.br_seat_of(r.seats, p_token);
  if v_seat >= 0 then
    return jsonb_build_object(
      'room_id', r.id, 'seat', v_seat, 'status', r.status,
      'state', r.state, 'version', r.version,
      'seats', public.br_public_seats(r.seats), 'max_seats', r.max_seats);
  end if;

  if r.status <> 'waiting' then
    raise exception using message = 'room_started';
  end if;
  v_taken := jsonb_array_length(r.seats);
  if v_taken >= r.max_seats then
    raise exception using message = 'room_full';
  end if;

  r.seats := r.seats || jsonb_build_object(
    'seat', v_taken,
    'name', public.br_clean_name(p_name),
    'player_id', p_player,
    'token_hash', public.br_token_hash(p_token),
    'last_seen', extract(epoch from now())::bigint,
    'left', false);
  if v_taken + 1 >= r.max_seats then
    r.status := 'playing';
  end if;

  update public.game_rooms
  set seats = r.seats, status = r.status, updated_at = now()
  where id = r.id;

  return jsonb_build_object(
    'room_id', r.id, 'seat', v_taken, 'status', r.status,
    'state', r.state, 'version', r.version,
    'seats', public.br_public_seats(r.seats), 'max_seats', r.max_seats);
end;
$$;

-- Poll the room. Any seated token may call this; it also stamps that
-- seat's last_seen (throttled to ~15s) so friends can see who's still
-- aboard.
create or replace function public.room_get(p_room uuid, p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms%rowtype;
  v_seat int;
  v_now bigint := extract(epoch from now())::bigint;
begin
  select * into r from public.game_rooms where id = p_room;
  if not found then
    raise exception using message = 'not_found';
  end if;
  v_seat := public.br_seat_of(r.seats, p_token);
  if v_seat < 0 then
    raise exception using message = 'not_seated';
  end if;

  if v_now - coalesce((r.seats->v_seat->>'last_seen')::bigint, 0) > 15 then
    update public.game_rooms
    set seats = jsonb_set(seats, array[v_seat::text, 'last_seen'], to_jsonb(v_now))
    where id = p_room;
  end if;

  return jsonb_build_object(
    'status', r.status, 'state', r.state, 'version', r.version,
    'seat', v_seat, 'seats', public.br_public_seats(r.seats),
    'max_seats', r.max_seats, 'code', r.code, 'now', v_now);
end;
$$;

-- Push the state after your move. p_version must equal the version you
-- last saw — otherwise 'version_conflict' (refetch and reconcile).
-- p_status 'over' ends the game; pushing to an 'over' room with
-- p_status 'playing' is how a rematch starts (either player may deal).
create or replace function public.room_push(
  p_room uuid, p_token text, p_state jsonb, p_version int,
  p_status text default 'playing'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms%rowtype;
  v_seat int;
begin
  if p_status not in ('playing', 'over') then
    raise exception using message = 'bad_status';
  end if;
  perform public.br_check_state(p_state);

  select * into r from public.game_rooms where id = p_room for update;
  if not found then
    raise exception using message = 'not_found';
  end if;
  v_seat := public.br_seat_of(r.seats, p_token);
  if v_seat < 0 then
    raise exception using message = 'not_seated';
  end if;
  if r.status = 'waiting' then
    raise exception using message = 'not_started';
  end if;
  if r.version <> coalesce(p_version, -1) then
    raise exception using message = 'version_conflict';
  end if;

  update public.game_rooms
  set state = p_state,
      version = version + 1,
      status = p_status,
      seats = jsonb_set(seats, array[v_seat::text, 'last_seen'],
                        to_jsonb(extract(epoch from now())::bigint)),
      updated_at = now()
  where id = r.id;

  return jsonb_build_object('version', r.version + 1);
end;
$$;

-- Leaving on purpose ends the game for everyone (their phones see your
-- 'left' flag and say so). Vanishing without calling this is also fine —
-- last_seen goes stale and the room sweeps away within a day.
create or replace function public.room_leave(p_room uuid, p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms%rowtype;
  v_seat int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found then
    return jsonb_build_object('ok', true);   -- already swept; nothing to do
  end if;
  v_seat := public.br_seat_of(r.seats, p_token);
  if v_seat < 0 then
    raise exception using message = 'not_seated';
  end if;

  update public.game_rooms
  set seats = jsonb_set(seats, array[v_seat::text, 'left'], 'true'::jsonb),
      status = 'over',
      updated_at = now()
  where id = r.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public.br_sweep_rooms() from public, anon, authenticated;

grant execute on function
  public.room_create(text, text, text, text, jsonb, int),
  public.room_join(text, text, text, text, text),
  public.room_get(uuid, text),
  public.room_push(uuid, text, jsonb, int, text),
  public.room_leave(uuid, text)
to anon, authenticated;
