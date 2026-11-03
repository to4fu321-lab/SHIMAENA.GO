-- シマエナGO のデータベース（Neon / Postgres）。仕様は docs/spec.md。
-- 個人情報を最小にするため、氏名ではなく呼び名（nickname）だけを持つ。

create table if not exists teams (
  id text primary key,            -- salvia / marigold / lupinus
  name text not null,
  color text not null
);

create table if not exists participants (
  id text primary key,
  nickname text not null,
  role text not null check (role in ('requester', 'helper')),
  lat double precision not null,
  lng double precision not null,
  line_user_id text unique,
  team_id text references teams(id),
  solo_minutes text,              -- 15 / 30 / 60 / unknown
  clear_area text,                -- entrance / garage / road
  level smallint check (level between 1 and 3),
  morning_minutes smallint,
  has_tools boolean,
  registered_by_family_id text,
  created_at timestamptz not null default now()
);

create table if not exists family_links (
  family_line_user_id text not null,
  requester_id text not null references participants(id),
  link_code text not null unique,
  primary key (family_line_user_id, requester_id)
);

-- 拠点 = 依頼者の家。地図には 50m マスと番号だけを出すので、建物との結びつきは持たない。
create table if not exists bases (
  id text primary key,
  number smallint not null unique,
  requester_id text not null references participants(id)
);

-- 点呼・ミッション・出撃・得点は morning_state の JSON の中（1朝ぶんをまとめて読み書きするため）。

create table if not exists cards (
  id text primary key,
  recipient_id text not null references participants(id),
  rollcall_id text not null,
  mission_id text not null,
  serial integer not null,
  issued_count integer not null,
  design_name text not null,
  design_name_en text not null,
  rarity_label text not null,
  stars smallint not null,
  style text not null,
  snow_kg integer not null,
  snow_kg_comparison text not null,
  member_names jsonb not null,
  team_ids jsonb not null,
  svg text,
  back_svg text,
  created_at timestamptz not null default now()
);

-- 「今朝の状態」（点呼・回答・ミッション・出撃・得点・文面）をまるごと JSON で1行に持つ。
-- Vercel はリクエストごとに別のサーバーになるので、メモリではなくここに置く。
create table if not exists morning_state (
  key text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- LINE の登録会話の途中経過（役割→位置→2問）。終わったら消す。
create table if not exists line_sessions (
  line_user_id text primary key,
  session jsonb not null,
  updated_at timestamptz not null default now()
);

insert into teams (id, name, color) values
  ('salvia', 'サルビア', '#2F6FE4'),
  ('marigold', 'マリーゴールド', '#FF8A3D'),
  ('lupinus', 'ルピナス', '#9B5DE5')
on conflict (id) do nothing;
