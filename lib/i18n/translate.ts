// 隊長のことばの翻訳（spec v1.33）: 毎回ちがう文（点呼・作戦・相談の返事・ボタンの文字）を Claude（Haiku）がまとめて訳す。
// 同じ文は2度訳さない: メモリと、DB があれば translations 表に貯める（同じ点呼の文は町じゅう同じなので、よく当たる）。
// 鍵がないときは訳さずそのまま（日本語のまま出る。画面は止まらない）。1回に訳す量には上限（お金の守り）。
// 本人が打った文は toJapanese で日本語に直してから、今までの処理（ことばの一覧・隊長エージェント）に渡す。
import { createHash } from "node:crypto";
import { z } from "zod";
import { askJson, hasClaudeKey } from "../claude/client";
import { hasDb, query } from "../db";
import { recordProblem } from "../ops/problems";
import { LANG_INFO, type Lang } from "./langs";

/** 1回の呼び出しで訳す上限（これを超えた古い文は日本語のまま） */
export const TRANSLATE_MAX_ITEMS = 60;
export const TRANSLATE_MAX_CHARS = 6000;
const MEM_MAX = 4000;

const g = globalThis as { __shimaenaTranslations?: Map<string, string>; __shimaenaTranslationsTable?: Promise<void> };
const mem = () => (g.__shimaenaTranslations ??= new Map());

export function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}
const memKey = (lang: string, hash: string) => `${lang}:${hash}`;

function remember(lang: string, hash: string, dst: string): void {
  const m = mem();
  m.set(memKey(lang, hash), dst);
  if (m.size > MEM_MAX) m.delete(m.keys().next().value as string);
}

const TABLE = `create table if not exists translations (
  lang text not null,
  hash text not null,
  src text not null,
  dst text not null,
  at timestamptz not null default now(),
  primary key (lang, hash))`;
const ensure = () =>
  (g.__shimaenaTranslationsTable ??= query(TABLE)
    .then(() => undefined)
    .catch((e) => {
      g.__shimaenaTranslationsTable = undefined;
      throw e;
    }));

async function loadFromDb(lang: string, hashes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!hasDb() || hashes.length === 0) return out;
  try {
    await ensure();
    const rows = await query<{ hash: string; dst: string }>("select hash, dst from translations where lang = $1 and hash = any($2::text[])", [lang, hashes]);
    for (const r of rows) out.set(r.hash, r.dst);
  } catch (e) {
    await recordProblem("i18n/load", e);
  }
  return out;
}

async function saveToDb(lang: string, rows: { hash: string; src: string; dst: string }[]): Promise<void> {
  if (!hasDb() || rows.length === 0) return;
  try {
    await ensure();
    for (const r of rows) await query("insert into translations (lang, hash, src, dst) values ($1, $2, $3, $4) on conflict (lang, hash) do nothing", [lang, r.hash, r.src, r.dst]);
  } catch (e) {
    await recordProblem("i18n/save", e);
  }
}

const Batch = z.object({ items: z.array(z.string()) });

/** Claude に、文字列の列をまとめて訳してもらう（同じ数・同じ順番）。形が合わなければ元の文 */
async function askTranslate(texts: string[], lang: Lang): Promise<string[]> {
  const res = await askJson({
    task:
      `次の items（日本語）を ${LANG_INFO[lang].name} に翻訳してください。雪かきアプリ「シマエナGO」の隊長トークに出る、シマエナ隊長（シマエナガの鳥の隊長）のことばとボタンの文字です。` +
      "規則: ①items と同じ数・同じ順番で返す（1つも減らさない・増やさない） ②絵文字・数字・改行・「拠点3」のような番号・時刻・距離はそのまま ③チーム名（サルビア・マリーゴールド・ルピナス）はその言語の花の名前に（英語: Salvia / Marigold / Lupinus） " +
      "④隊長の語尾「〜しま」「〜えな」はかわいい口癖なので、訳では親しみやすい自然な口調にし、無理に残さない ⑤ボタンの文字（短い行）は短く ⑥意味を足したり省いたりしない ⑦「シマエナGO」「シマエナ隊長」は Shimaena GO / Captain Shimaena のように音写（ほかの言語も同じ考え方） ⑧敬称「〜さん」は自然に（英語なら名前だけ）。",
    input: { items: texts },
    schema: Batch,
    effort: "low",
    model: "light",
  });
  if (res.items.length !== texts.length) throw new Error(`翻訳の数が合いません（${texts.length} → ${res.items.length}）`);
  return res.items.map((s, i) => (typeof s === "string" && s.trim() ? s : texts[i]));
}

/**
 * 文字列の列をそのことばに。日本語はそのまま。キャッシュにあるものは呼ばない。
 * 鍵がない・失敗したときは元の文（画面は止まらない）。translator は確かめ用に差しかえられる
 */
export async function translateTexts(texts: string[], lang: Lang, translator: (t: string[], l: Lang) => Promise<string[]> = askTranslate): Promise<string[]> {
  if (lang === "ja" || texts.length === 0) return texts;
  const uniq = [...new Set(texts.filter((t) => t.trim()))];
  const hashes = new Map(uniq.map((t) => [t, textHash(t)] as const));
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const t of uniq) {
    const hit = mem().get(memKey(lang, hashes.get(t)!));
    if (hit !== undefined) found.set(t, hit);
    else missing.push(t);
  }
  if (missing.length > 0) {
    const fromDb = await loadFromDb(lang, missing.map((t) => hashes.get(t)!));
    for (const t of [...missing]) {
      const dst = fromDb.get(hashes.get(t)!);
      if (dst !== undefined) {
        found.set(t, dst);
        remember(lang, hashes.get(t)!, dst);
        missing.splice(missing.indexOf(t), 1);
      }
    }
  }
  if (missing.length > 0 && hasClaudeKey()) {
    // 新しいものから（流れの下のほうが先に読まれる）。上限を超えた分は日本語のまま
    const batch: string[] = [];
    let chars = 0;
    for (const t of [...missing].reverse()) {
      if (batch.length >= TRANSLATE_MAX_ITEMS || chars + t.length > TRANSLATE_MAX_CHARS) break;
      batch.push(t);
      chars += t.length;
    }
    try {
      const out = await translator(batch, lang);
      if (out.length !== batch.length) throw new Error(`翻訳の数が合いません（${batch.length} → ${out.length}）`);
      const rows = batch.map((src, i) => ({ hash: hashes.get(src)!, src, dst: out[i] }));
      for (const r of rows) {
        found.set(r.src, r.dst);
        remember(lang, r.hash, r.dst);
      }
      await saveToDb(lang, rows);
    } catch (e) {
      await recordProblem("i18n/translate", e);
    }
  }
  return texts.map((t) => found.get(t) ?? t);
}

const ToJa = z.object({ ja: z.string() });

/**
 * 本人が打った文を日本語に（今までの処理は日本語で動く）。日本語を選んでいる・鍵がないときはそのまま。
 * 訳も貯める（鍵は `en>ja` のように向きを付ける）
 */
export async function toJapanese(text: string, lang: Lang, translator?: (t: string, l: Lang) => Promise<string>): Promise<string> {
  const src = text.trim();
  if (lang === "ja" || !src) return text;
  const key = `${lang}>ja`;
  const hash = textHash(src);
  const hit = mem().get(memKey(key, hash)) ?? (await loadFromDb(key, [hash])).get(hash);
  if (hit !== undefined) return hit;
  if (!translator && !hasClaudeKey()) return text;
  try {
    const ja = translator
      ? await translator(src, lang)
      : (
          await askJson({
            task:
              `次の文（${LANG_INFO[lang].name}）を、自然な日本語に翻訳してください。雪かきアプリの隊長に話しかけている本人の文です。` +
              "意味を足したり省いたりしない。数字・時刻・絵文字はそのまま。ですます調で短く。訳だけを ja に入れる。",
            input: { text: src },
            schema: ToJa,
            effort: "low",
            model: "light",
          })
        ).ja;
    const out = ja.trim() || text;
    remember(key, hash, out);
    await saveToDb(key, [{ hash, src, dst: out }]);
    return out;
  } catch (e) {
    await recordProblem("i18n/toJapanese", e);
    return text;
  }
}

/** 確かめ用: メモリのキャッシュを空にする */
export function clearTranslationCache(): void {
  mem().clear();
}
