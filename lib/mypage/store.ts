// マイページの保存先（spec v1.32）。DATABASE_URL があれば Neon、なければメモリ（開発用）。
// 表は足すだけ: my_profiles（1人1行）・nakama_waves（「また一緒に」の手ふり。2人の組で1行）。最初に使うときに作る。
import { hasDb, query } from "../db";
import { DEFAULT_BG, DEFAULT_ICON, isIconBgId, isIconId, type MyProfile, type Wave } from "./rules";

const TABLES = [
  `create table if not exists my_profiles (
    participant_id text primary key, icon text not null, icon_bg text not null, intro text not null default '',
    likes jsonb not null default '[]'::jsonb, interests jsonb not null default '[]'::jsonb, talk text not null default '',
    updated_at timestamptz not null default now())`,
  `create table if not exists nakama_waves (
    from_id text not null, to_id text not null, at timestamptz not null default now(), primary key (from_id, to_id))`,
  `create index if not exists nakama_waves_to on nakama_waves (to_id)`,
];
let ready: Promise<void> | undefined;
function ensure(): Promise<void> {
  ready ??= (async () => {
    for (const t of TABLES) await query(t);
  })().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

interface Mem {
  profiles: Map<string, MyProfile>;
  waves: Map<string, Wave>; // `${from}>${to}`
}
const g = globalThis as { __shimaenaMypage?: Mem };
const mem = (): Mem => (g.__shimaenaMypage ??= { profiles: new Map(), waves: new Map() });

/** テスト用: メモリを空にする */
export function resetMypageMemory(): void {
  g.__shimaenaMypage = undefined;
}

const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);

interface ProfileRow {
  participant_id: string;
  icon: string;
  icon_bg: string;
  intro: string;
  likes: unknown;
  interests: unknown;
  talk: string;
  updated_at: string | Date;
}
const toProfile = (r: ProfileRow): MyProfile => ({
  participantId: r.participant_id,
  icon: isIconId(r.icon) ? r.icon : DEFAULT_ICON,
  iconBg: isIconBgId(r.icon_bg) ? r.icon_bg : DEFAULT_BG,
  intro: r.intro ?? "",
  likes: strings(r.likes),
  interests: strings(r.interests),
  talk: r.talk ?? "",
  updatedAt: iso(r.updated_at),
});

export async function getProfile(participantId: string): Promise<MyProfile | undefined> {
  if (!hasDb()) return mem().profiles.get(participantId);
  await ensure();
  const rows = await query<ProfileRow>("select * from my_profiles where participant_id = $1", [participantId]);
  return rows[0] ? toProfile(rows[0]) : undefined;
}

/** 何人かのプロフィールをまとめて（なかま帳・ホーム用） */
export async function getProfiles(ids: string[]): Promise<Map<string, MyProfile>> {
  const out = new Map<string, MyProfile>();
  if (ids.length === 0) return out;
  if (!hasDb()) {
    for (const id of ids) {
      const p = mem().profiles.get(id);
      if (p) out.set(id, p);
    }
    return out;
  }
  await ensure();
  const rows = await query<ProfileRow>("select * from my_profiles where participant_id = any($1)", [ids]);
  for (const r of rows) out.set(r.participant_id, toProfile(r));
  return out;
}

export async function putProfile(p: MyProfile): Promise<void> {
  if (!hasDb()) {
    mem().profiles.set(p.participantId, p);
    return;
  }
  await ensure();
  await query(
    `insert into my_profiles (participant_id, icon, icon_bg, intro, likes, interests, talk, updated_at)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
     on conflict (participant_id) do update set icon = excluded.icon, icon_bg = excluded.icon_bg, intro = excluded.intro,
       likes = excluded.likes, interests = excluded.interests, talk = excluded.talk, updated_at = excluded.updated_at`,
    [p.participantId, p.icon, p.iconBg, p.intro, JSON.stringify(p.likes), JSON.stringify(p.interests), p.talk, p.updatedAt],
  );
}

// ---- 手ふり ----

export async function putWave(w: Wave): Promise<void> {
  if (!hasDb()) {
    mem().waves.set(`${w.fromId}>${w.toId}`, w);
    return;
  }
  await ensure();
  await query(
    `insert into nakama_waves (from_id, to_id, at) values ($1, $2, $3)
     on conflict (from_id, to_id) do update set at = excluded.at`,
    [w.fromId, w.toId, w.at],
  );
}

/** その人が関わる手ふり（ふった・ふられた） */
export async function listWavesFor(participantId: string): Promise<Wave[]> {
  if (!hasDb()) return [...mem().waves.values()].filter((w) => w.fromId === participantId || w.toId === participantId);
  await ensure();
  const rows = await query<{ from_id: string; to_id: string; at: string | Date }>("select * from nakama_waves where from_id = $1 or to_id = $1", [participantId]);
  return rows.map((r) => ({ fromId: r.from_id, toId: r.to_id, at: iso(r.at) }));
}
