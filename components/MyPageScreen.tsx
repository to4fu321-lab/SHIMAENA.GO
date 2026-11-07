"use client";

// マイページ（spec v1.32）: 1画面・3つのタブ「わたし」「なかま帳」「記録」を横スワイプ。基本はゆるく: 書かなくてもよい、いつでも直せる。
// わたし = アイコン・ひとこと・好きなこと・興味（隊長のインタビューで作る／自分で書く）
// なかま帳 = 一緒に活動した仲間の記録と「👋 また一緒に」（手をふる。返事はいらない。おたがいなら雪の朝の候補で先に）
// 記録 = 仲間・合流・バトン・ありがとう・活動した日・カード
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveProfileAction, waveAction } from "@/app/me/actions";
import type { TidyProfile } from "@/lib/claude/profile";
import type { Companion, MypageView } from "@/lib/mypage/ops";
import { ICON_BGS, ICONS, INTRO_MAX, TAGS_MAX, TALK_MAX, type IconBgId, type IconId } from "@/lib/mypage/rules";
import { play } from "@/lib/sound/engine";
import { teamTheme } from "@/lib/team-theme";
import type { TeamId } from "@/lib/types";
import Avatar from "./Avatar";
import Pager, { PagedList, Screen } from "./Pager";
import ProfileInterview from "./ProfileInterview";
import { squarePhoto } from "./shrink";
import TabBar from "./TabBar";

const card = "rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10";

function TeamChip({ teamId }: { teamId?: TeamId }) {
  if (!teamId) return null;
  const t = teamTheme(teamId);
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ring-1 ring-white" style={{ background: t.team.color, color: t.onColor }}>
      {t.team.name}
    </span>
  );
}

function Chips({ items, tone, max = TAGS_MAX }: { items: string[]; tone: "ice" | "camellia" | "warm"; max?: number }) {
  if (items.length === 0) return null;
  const bg = tone === "ice" ? "bg-ice-soft" : tone === "camellia" ? "bg-camellia-soft" : "bg-warm";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.slice(0, max).map((x) => (
        <li key={x} className={`rounded-full ${bg} px-2.5 py-0.5 text-base font-bold leading-snug`}>
          {x}
        </li>
      ))}
    </ul>
  );
}

interface Draft {
  icon: IconId;
  iconBg: IconBgId;
  /** 自分の写真（data URL）。null = 写真なし（絵文字のアイコン） */
  photo: string | null;
  intro: string;
  likes: string;
  interests: string;
  talk: string;
}

/** 自分で書く・直す（インタビューの下書きもここで直してから保存） */
function ProfileEditor({ draft, by, busy, onChange, onSave, onCancel }: { draft: Draft; by?: "claude" | "program"; busy: boolean; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const field = "w-full rounded-2xl bg-card px-3 py-2 text-lg leading-snug shadow-sm ring-1 ring-ink/15 placeholder:text-ink-soft/60 short:py-1.5 short:text-base";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 short:gap-1">
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto short:gap-1">
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onCancel} className="btn btn-white min-h-10 shrink-0 whitespace-nowrap px-3 text-sm">
          ‹ やめる
        </button>
        <p className="text-sm font-bold leading-snug">{by ? (by === "claude" ? "隊長が整えました。直してから保存できます" : "答えから組み立てました。直してから保存できます") : "自分で書く・直す"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Avatar icon={draft.icon} bg={draft.iconBg} photo={draft.photo ?? undefined} size={64} className="short:!size-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 short:gap-1">
          {/* 基本は自分の写真（顔でなくても、好きな物の写真でも） */}
          <button type="button" onClick={() => file.current?.click()} disabled={reading} className={`btn min-h-11 w-full gap-1.5 px-2 text-base short:min-h-9 ${draft.photo ? "btn-white" : "btn-lamp"}`}>
            <span aria-hidden="true">📷</span>
            {reading ? "写真を読んでいます…" : draft.photo ? "写真を変える" : "自分の写真をアイコンに"}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setReading(true);
              try {
                onChange({ ...draft, photo: await squarePhoto(f) });
              } catch {
                /* 読めない写真は、そのまま絵文字のアイコン */
              }
              setReading(false);
            }}
          />
          <p className="text-xs font-bold text-ink-soft">または絵をえらぶ</p>
          <div className="grid grid-flow-col grid-rows-1 gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]" role="radiogroup" aria-label="アイコン">
            {ICONS.map((ic) => (
              <button
                key={ic.id}
                type="button"
                role="radio"
                aria-checked={!draft.photo && draft.icon === ic.id}
                aria-label={ic.label}
                onClick={() => onChange({ ...draft, icon: ic.id, photo: null })}
                className={`grid size-10 place-items-center rounded-xl text-xl ring-2 ${!draft.photo && draft.icon === ic.id ? "bg-lamp ring-lamp" : "bg-card ring-ink/10"}`}
              >
                {ic.emoji}
              </button>
            ))}
          </div>
          {!draft.photo && (
            <div className="flex gap-1.5" role="radiogroup" aria-label="アイコンの背景色">
              {ICON_BGS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.iconBg === b.id}
                  aria-label={b.label}
                  onClick={() => onChange({ ...draft, iconBg: b.id })}
                  className={`size-7 rounded-full ring-2 ${draft.iconBg === b.id ? "ring-lamp" : "ring-ink/15"}`}
                  style={{ background: b.color }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <label className="block shrink-0">
        <span className="text-sm font-bold text-ink-soft short:text-xs">ひとこと（{INTRO_MAX}字まで）</span>
        <input value={draft.intro} maxLength={INTRO_MAX} onChange={(e) => onChange({ ...draft, intro: e.target.value })} placeholder="例: 朝はゆっくり派。よろしくお願いします" className={field} />
      </label>
      <label className="block shrink-0">
        <span className="text-sm font-bold text-ink-soft short:text-xs">好きなこと（「、」で区切って {TAGS_MAX} つまで）</span>
        <input value={draft.likes} onChange={(e) => onChange({ ...draft, likes: e.target.value })} placeholder="例: 散歩、料理、ラジオ" className={field} />
      </label>
      <label className="block shrink-0">
        <span className="text-sm font-bold text-ink-soft short:text-xs">興味あること（「、」で区切って {TAGS_MAX} つまで）</span>
        <input value={draft.interests} onChange={(e) => onChange({ ...draft, interests: e.target.value })} placeholder="例: パン作り、山歩き" className={field} />
      </label>
      <label className="block shrink-0">
        <span className="text-sm font-bold text-ink-soft short:text-xs">雪かきのあと、こんな話を（{TALK_MAX}字まで）</span>
        <input value={draft.talk} maxLength={TALK_MAX} onChange={(e) => onChange({ ...draft, talk: e.target.value })} placeholder="例: 犬の話、昔の町の話、なんでも" className={field} />
      </label>
    </div>
      {/* 保存ボタンは入力欄のスクロールの外に置く（小さい画面でも見える） */}
      <button type="button" className="btn btn-lamp btn-big w-full shrink-0 short:min-h-12 short:text-lg" disabled={busy} onClick={onSave}>
        {busy ? "保存しています…" : "これで保存する"}
      </button>
    </div>
  );
}

function toDraft(v: MypageView): Draft {
  const p = v.profile;
  return { icon: v.look.icon, iconBg: v.look.iconBg, photo: v.look.photo ?? null, intro: p?.intro ?? "", likes: (p?.likes ?? []).join("、"), interests: (p?.interests ?? []).join("、"), talk: p?.talk ?? "" };
}

export default function MyPageScreen({ viewerId, view, q, initialTab }: { viewerId: string; view: MypageView; q: string; initialTab?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState(initialTab ?? (view.wavesForMe > 0 ? 1 : 0));
  const [mode, setMode] = useState<"view" | "interview" | "edit">("view");
  const [draft, setDraft] = useState<Draft>(() => toDraft(view));
  const [by, setBy] = useState<"claude" | "program" | undefined>();
  const [note, setNote] = useState<string | null>(null);
  const p = view.profile;
  // 「保存しました」などの知らせは数秒で消す（画面の高さを取り続けないように）
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);
  const has = Boolean(p && (p.intro || p.likes.length || p.interests.length || p.talk));

  const save = () =>
    start(async () => {
      try {
        const r = await saveProfileAction(viewerId, { ...draft, likes: draft.likes, interests: draft.interests });
        setNote(r.text);
        if (r.ok) {
          play("cardStamp");
          setMode("view");
          setBy(undefined);
        }
      } catch {
        setNote("うまくいきませんでした。もう一度押してください。");
      }
      router.refresh();
    });

  const wave = (c: Companion) =>
    start(async () => {
      try {
        const r = await waveAction(viewerId, c.participantId);
        setNote(r.text);
        if (r.ok) play(r.mutual ? "thanks" : "flap");
      } catch {
        setNote("うまくいきませんでした。もう一度押してください。");
      }
      router.refresh();
    });

  const fromInterview = (d: TidyProfile) => {
    setDraft({ icon: d.icon, iconBg: draft.iconBg, photo: draft.photo, intro: d.intro, likes: d.likes.join("、"), interests: d.interests.join("、"), talk: d.talk });
    setBy(d.by);
    setMode("edit");
  };

  const header = (
    <div className="flex items-center gap-3 px-4 pb-2 pt-3">
      <Link href={`/${q}`} aria-label="ホームへ戻る" className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-2xl font-bold shadow-md">
        ‹
      </Link>
      <Avatar icon={view.look.icon} bg={view.look.iconBg} photo={view.look.photo} size={44} team={view.teamId} />
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="truncate text-xl font-bold">{view.nickname}さん</h1>
        <p className="truncate text-sm text-ink-soft">マイページ</p>
      </div>
      <TeamChip teamId={view.teamId} />
    </div>
  );

  return (
    <Screen header={header} footer={<TabBar q={q} />}>
      {note && (
        <p className="mx-4 mb-2 shrink-0 rounded-2xl bg-ice-soft px-3 py-2 text-base leading-snug" role="status">
          {note}
        </p>
      )}
      <Pager
        tabs={[
          { key: "me", label: "わたし" },
          { key: "nakama", label: "なかま帳", badge: view.wavesForMe },
          { key: "log", label: "記録" },
        ]}
        initial={tab}
        index={tab}
        onChange={setTab}
      >
        {/* わたし */}
        {mode === "interview" ? (
          <ProfileInterview viewerId={viewerId} nickname={view.nickname} onDone={fromInterview} onCancel={() => setMode("view")} />
        ) : mode === "edit" ? (
          <ProfileEditor draft={draft} by={by} busy={pending} onChange={setDraft} onSave={save} onCancel={() => { setMode("view"); setBy(undefined); setDraft(toDraft(view)); }} />
        ) : (
          <>
            <div className={`${card} flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto`}>
              {/* 写真・名前は横に並べて、紹介文に高さを回す（11/7 本人の指摘「マイページが途切れている」） */}
              <div className="flex shrink-0 items-center gap-3">
                <Avatar icon={view.look.icon} bg={view.look.iconBg} photo={view.look.photo} size={72} team={view.teamId} className="short:!size-14" />
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold leading-tight">{view.nickname}さん</p>
                  {p?.intro && <p className="mt-0.5 text-lg font-bold leading-snug short:text-base">「{p.intro}」</p>}
                </div>
              </div>
              {has ? (
                <div className="flex w-full flex-col gap-2 text-left">
                  {p && p.likes.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-ink-soft">好きなこと</p>
                      <Chips items={p.likes} tone="ice" />
                    </div>
                  )}
                  {p && p.interests.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-ink-soft">興味あること</p>
                      <Chips items={p.interests} tone="camellia" />
                    </div>
                  )}
                  {p?.talk && <p className="text-base leading-snug text-ink-soft">💬 雪かきのあとは「{p.talk}」</p>}
                </div>
              ) : (
                <p className="my-auto text-center text-lg leading-snug text-ink-soft">
                  まだ紹介がありません。
                  <br />
                  隊長に5つ聞いてもらうと、1分で形になります。
                </p>
              )}
            </div>
            {/* 紹介があるときは2つを横に並べて、紹介に高さを回す */}
            <div className={has ? "grid shrink-0 grid-cols-2 gap-2" : "flex shrink-0 flex-col gap-2"}>
              <button type="button" onClick={() => { play("chirp"); setMode("interview"); }} className={`btn btn-lamp w-full shadow-md ${has ? "min-h-14 whitespace-nowrap px-1 text-base" : "btn-big"}`}>
                {has ? "🎙 隊長と作り直す" : "🎙 隊長に聞いてもらって作る"}
              </button>
              <button type="button" onClick={() => { setDraft(toDraft(view)); setBy(undefined); setMode("edit"); }} className={`btn btn-white w-full text-lg ${has ? "min-h-14 px-2" : ""}`}>
                ✏️ 自分で{has ? "直す" : "書く"}
              </button>
            </div>
            <p className="shrink-0 text-center text-xs leading-snug text-ink-soft short:hidden">見えるのは、一緒に活動した仲間だけ。名前・住所は書かないでください。</p>
          </>
        )}

        {/* なかま帳 */}
        <>
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="text-base font-bold">一緒に活動した仲間 {view.companions.length}人</p>
            <Link href={`/connect?tab=invite${q ? `&${q.slice(1)}` : ""}`} className="btn btn-white min-h-10 px-3 text-sm">
              🐦 友だちを誘う
            </Link>
          </div>
          <PagedList
            label="なかま帳"
            items={view.companions}
            empty={
              <div className="my-auto flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-ink/15 px-4 py-8 text-center">
                <p className="text-lg font-bold">まだ記録はありません</p>
                <p className="text-base leading-snug text-ink-soft">雪の朝に同じ家で一緒に雪かきしたり、ゆるく合流したりすると、その人の顔がここに並びます。</p>
                <Link href={`/connect?tab=nakama${q ? `&${q.slice(1)}` : ""}`} className="btn btn-white text-lg">
                  👥 今日のスタイルを選ぶ
                </Link>
              </div>
            }
            render={(c) => (
              <div key={c.participantId} className={`${card} flex min-h-0 flex-1 flex-col gap-2 overflow-hidden ${c.wave.theirs && !c.wave.mine ? "ring-2 ring-lamp" : ""}`}>
                <div className="flex items-center gap-3">
                  <Avatar icon={c.profile.icon} bg={c.profile.iconBg} photo={c.profile.photo} size={60} team={c.teamId} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xl font-bold">
                      <span>{c.nickname}さん</span>
                      <TeamChip teamId={c.teamId} />
                    </p>
                    <p className="text-sm text-ink-soft">
                      {c.how === "meetup" ? "ゆるく合流" : c.how === "both" ? "一緒に雪かき・合流" : "一緒に雪かき"} {c.times}回・最後は {c.last}
                    </p>
                  </div>
                </div>
                {c.wave.theirs && !c.wave.mine && <p className="rounded-2xl bg-camellia-soft px-3 py-1.5 text-base font-bold leading-snug">👋 {c.nickname}さんが「また一緒に」と手をふっています</p>}
                {c.wave.mutual && <p className="rounded-2xl bg-ice-soft px-3 py-1.5 text-base font-bold leading-snug">🤝 おたがいに「また一緒に」。雪の朝「前回の仲間と」で先に候補に出ます</p>}
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                  {c.hasProfile ? (
                    <>
                      {c.profile.intro && <p className="text-lg font-bold leading-snug">「{c.profile.intro}」</p>}
                      <Chips items={[...c.profile.likes, ...c.profile.interests]} tone="ice" max={6} />
                      {c.profile.talk && <p className="text-base leading-snug text-ink-soft">💬 {c.profile.talk}</p>}
                    </>
                  ) : (
                    <p className="my-auto text-base leading-snug text-ink-soft">まだ紹介はありません。雪の朝に会ったら、好きなことを聞いてみてください。</p>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  {c.wave.mine ? (
                    <p className="grid min-h-14 place-items-center rounded-2xl bg-paper px-2 text-center text-base font-bold leading-tight text-ink-soft ring-1 ring-ink/10">👋 手をふりました</p>
                  ) : (
                    <button disabled={pending} onClick={() => wave(c)} className={`btn text-lg ${c.wave.theirs ? "btn-lamp" : "btn-white"}`}>
                      👋 {c.wave.theirs ? "ふり返す" : "また一緒に"}
                    </button>
                  )}
                  <Link href={`/connect?tab=nakama${q ? `&${q.slice(1)}` : ""}`} className="btn btn-white text-lg">
                    👥 雪の朝に会う
                  </Link>
                </div>
              </div>
            )}
          />
          <p className="shrink-0 text-center text-xs text-ink-soft">手をふっても、返事はいりません。家の場所は出ません。</p>
        </>

        {/* 記録 */}
        <>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {(
              [
                ["👥", "仲間", view.stats.companions, "人"],
                ["🤝", "ゆるく合流", view.stats.meets, "回"],
                ["🎽", "渡したバトン", view.stats.batons, "本"],
                ["🙏", "ありがとう", view.stats.thanks, ""],
                ["🌨", "外で活動した日", view.stats.days, "日"],
                ["🃏", "カード", view.stats.cards, "枚"],
              ] as const
            ).map(([emoji, label, n, unit]) => (
              <div key={label} className={`${card} flex items-center gap-2 py-3`}>
                <span className="text-2xl" aria-hidden="true">{emoji}</span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-bold text-ink-soft">{label}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {n}
                    <span className="text-sm">{unit}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className={`${card} my-auto text-center`}>
            <p className="text-lg font-bold leading-snug">数は、だれとも比べません。</p>
            <p className="mt-1 text-base leading-snug text-ink-soft">ひとりでも、たまにでも。雪の朝に外に出た日と、出会った仲間が、ここに残ります。「ありがとう」は、あなたのバトンに届いた数です。</p>
          </div>
          <Link href={`/cards${q}`} className="btn btn-white w-full shrink-0 text-lg">
            🃏 カードと活動を見る ›
          </Link>
        </>
      </Pager>
    </Screen>
  );
}
