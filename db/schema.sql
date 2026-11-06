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

-- 先に作った表に後から足した列（create table if not exists では足されないので、ここで足す。何度流しても安全）
alter table cards add column if not exists back_svg text;

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

-- ソロ出動の台帳（v1.3）。羽ポイントはチーム得点（morning_state の scores）とは別の個人の記録。
-- 同じ人・同じ日・同じ種類は1回だけ（家の完了は mission_id ごと）。
create table if not exists solo_logs (
  id text primary key,
  participant_id text not null references participants(id),
  date text not null,             -- YYYY-MM-DD（アプリの「今日」）
  kind text not null,
  onsite boolean not null,
  feathers integer not null,
  note text,
  hitokoto text,
  photo_checked boolean,
  cell_key text,                  -- 50m マス（本人の家のマス）。家の正確な位置は持たない
  mission_id text,
  at timestamptz not null default now()
);
create unique index if not exists solo_logs_once on solo_logs (participant_id, date, kind, coalesce(mission_id, ''));

-- SNS 閲覧者の「町を応援する」の数（日付ごと）。得点にも羽にも入れない。
create table if not exists town_cheers (
  date text primary key,
  count integer not null default 0
);

-- 運用（11/4 精査 P0）: LINE の同じイベントを2回処理しないための印（7日で消す）
create table if not exists line_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

-- 運用（11/4 精査 P0）: 今朝の状態を1つずつ書き換えるための鍵（期限つき）
create table if not exists state_locks (
  key text primary key,
  holder text not null,
  until timestamptz not null
);

-- 道の危険の報告（11/4 本人の指示）。写真の場所にピンを立てる（道なので家とちがい丸めない）。報告した人の名前は出さない。
create table if not exists road_reports (
  id text primary key,
  participant_id text not null references participants(id),
  hazard text not null,           -- no_plow / narrow / no_sidewalk / slush / ice
  lat double precision not null,
  lng double precision not null,
  note text,
  photo text,                     -- 小さく縮めた JPEG（base64）
  date text not null,             -- YYYY-MM-DD（日本時間）
  at timestamptz not null,
  notified_at timestamptz         -- 近くの人へ知らせた時刻（夜は朝まで空）
);

-- 道の報告を LINE で受け取るか（本人が選ぶ。コンシェルジュが登録のあとに聞く）
create table if not exists road_alert_prefs (
  participant_id text primary key references participants(id),
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

-- 道の報告の通知を、1人に1日何回送ったか（1日3回まで）
create table if not exists road_alert_sends (
  participant_id text not null,
  date text not null,
  count integer not null default 0,
  primary key (participant_id, date)
);

-- なかま機能（spec v1.13: ゆるく合流・雪かきバトン・再会）。足すだけで今の表には触らない。最初に使うときにも自動で作る
-- 交流の希望（今日のスタイル・次は？）。選ばなければ行はなく、いつもどおり自由参加
create table if not exists nakama_prefs (
  participant_id text primary key,
  next_wish text,                 -- reunion / new / solo / none
  today_mode text,                -- solo / together / reunion / new
  today_date text,
  today_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 合流の提案。誘った人と誘われた人の両方の同意（accepted）でだけ成立。家の場所は持たない（地図の家の番号だけ）
create table if not exists meetups (
  id text primary key,
  date text not null,
  from_id text not null,
  to_id text not null,
  kind text not null,             -- reunion / welcome / senior / new / nearby
  win text not null,              -- now10 / today
  base_number smallint,
  mission_id text,
  status text not null,           -- proposed / accepted / declined
  message text not null,
  created_at timestamptz not null,
  responded_at timestamptz
);
create index if not exists meetups_date on meetups (date);

-- 雪かきバトン。地域は約250m四方。書いた人は画面に出さない。写真は保存しない（確認済みの印だけ）
create table if not exists batons (
  id text primary key,
  participant_id text not null,
  date text not null,
  area text not null,
  source text not null,           -- own_house / help_house / road
  status text not null,           -- done / partial
  message text not null,
  photo_checked boolean not null default false,
  story text,
  at timestamptz not null
);
create index if not exists batons_area on batons (date, area);

-- バトンへの「前の人ありがとう」「続きをやります」（1人1回）
create table if not exists baton_reactions (
  baton_id text not null,
  participant_id text not null,
  reaction text not null,         -- thanks / continue
  at timestamptz not null default now(),
  primary key (baton_id, participant_id)
);

-- 隊長トーク（spec v1.17）: 隊長から届く文面（out）と本人が送った文・写真の印（in）。文面の形は LINE のときの JSON のまま。
create table if not exists inbox_messages (
  id text primary key,
  inbox_key text not null,         -- LINE のアカウント ID（ログインの ID）、または demo:<参加者 ID>
  direction text not null,         -- out / in
  body jsonb not null,
  at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists inbox_messages_key on inbox_messages (inbox_key, at);

-- 端末への通知（Web Push、spec v1.17）の購読。1つの端末＝1行。鍵は inbox_messages と同じ
create table if not exists push_subscriptions (
  endpoint text primary key,
  inbox_key text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_key on push_subscriptions (inbox_key);

-- その人が求めている方向（spec v1.17: connect / exercise / community / game）と要約（40字）。原文は残さない
create table if not exists participant_profiles (
  participant_id text primary key,
  motives jsonb not null default '[]'::jsonb,
  summary text not null default '',
  updated_at timestamptz not null default now()
);

-- 声（spec v1.17）: 相談から読み取った「求められていること」。種類・要約40字・方向だけ（原文は残さない）
create table if not exists voice_logs (
  id text primary key,
  participant_id text not null,
  date text not null,
  category text not null,          -- feature / confusion / trouble / praise
  summary text not null,
  motives jsonb not null default '[]'::jsonb,
  picked text,
  created_at timestamptz not null default now()
);
create index if not exists voice_logs_date on voice_logs (date);

insert into teams (id, name, color) values
  ('salvia', 'サルビア', '#2F6FE4'),
  ('marigold', 'マリーゴールド', '#FF8A3D'),
  ('lupinus', 'ルピナス', '#9B5DE5')
on conflict (id) do nothing;
