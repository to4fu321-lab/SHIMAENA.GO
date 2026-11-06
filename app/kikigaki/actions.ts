"use server";

// 雪の聞き書き（spec v1.26）の操作。「自分」は trustedViewer で確かめる。頼む家として登録した人だけ。
// やりとり（答え）は画面が持ち、毎回送ってくる。サーバーはお話にするまで答えを残さない。
import { revalidatePath } from "next/cache";
import { nextTurn } from "@/lib/claude/kikigaki";
import { MIN_ANSWERS, answered, normalizeTurns } from "@/lib/kikigaki/core";
import { createStory, setShare } from "@/lib/kikigaki/ops";
import { toView, type StoryView } from "@/lib/kikigaki/view";
import { repo } from "@/lib/repo";
import { trustedViewer } from "@/lib/viewer";

async function requester(viewerId: string) {
  const id = await trustedViewer(viewerId);
  const p = id ? await repo().findParticipant(id) : undefined;
  return p?.role === "requester" ? p : undefined;
}

export async function nextQuestionAction(viewerId: string, rawTurns: unknown): Promise<{ ok: boolean; aizuchi?: string; question?: string; text?: string }> {
  const p = await requester(viewerId);
  if (!p) return { ok: false, text: "雪かきを頼む家として登録した人だけが使えます。" };
  const t = await nextTurn(normalizeTurns(rawTurns));
  return { ok: true, aizuchi: t.aizuchi, question: t.question };
}

export async function finishAction(viewerId: string, rawTurns: unknown): Promise<{ ok: boolean; story?: StoryView; text?: string }> {
  const p = await requester(viewerId);
  if (!p) return { ok: false, text: "雪かきを頼む家として登録した人だけが使えます。" };
  const turns = normalizeTurns(rawTurns);
  if (answered(turns) < MIN_ANSWERS) return { ok: false, text: `あと少しだけ聞かせてください（${MIN_ANSWERS}つ答えるとお話にできます）。` };
  const s = await createStory(p.id, turns);
  revalidatePath("/kikigaki");
  return { ok: true, story: toView(s) };
}

export async function shareAction(viewerId: string, share: boolean): Promise<{ ok: boolean; text: string }> {
  const p = await requester(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
  const s = await setShare(p.id, share);
  if (!s) return { ok: false, text: "お話が見つかりませんでした。" };
  revalidatePath("/kikigaki");
  return {
    ok: true,
    text: share ? "次にこの家の雪かきが終わったら、来てくれた人の隊長トークに届きます。" : "あなただけのお話として、しまっておきました。いつでも変えられます。",
  };
}
