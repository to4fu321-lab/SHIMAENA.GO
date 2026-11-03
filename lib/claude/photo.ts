// 完了写真の確認: 雪が除かれているか／通路が通れるか／凍結が残っていないか。spec 9-3。
// v1.1: 判断できない写真は uncertain=true → 「報告として受け付け」。AI を最終判定者にしない（手動の道は ops.completeManually）。
import { z } from "zod";
import { MAX_IMAGE_BYTES, type ImageType } from "../image";
import type { PhotoCheck } from "../types";
import { askJson, hasClaudeKey } from "./client";

export const PhotoCheckSchema = z.object({
  cleared: z.boolean(),
  passable: z.boolean(),
  icy: z.boolean(),
  /** 写真では判断できない（暗い・ぼやけ・写っている範囲が狭い） */
  uncertain: z.boolean(),
  comment: z.string(),
});

export interface PhotoInput {
  bytes: Uint8Array;
  mediaType: ImageType;
}

export type PhotoOutcome = "done" | "accepted" | "retry";

/** 写真の確認結果をどう扱うか: 通れる＝完了／判断できない＝報告として受け付け／それ以外＝もう一度 */
export function decidePhoto(check: PhotoCheck): PhotoOutcome {
  if (check.cleared && check.passable) return "done";
  return check.uncertain ? "accepted" : "retry";
}

export function mockPhotoCheck(): PhotoCheck {
  return {
    cleared: true,
    passable: true,
    icy: false,
    uncertain: false,
    comment: "写真を受け取りました。お疲れさまでした。（Claude のキーがないので、写真の中身の確認は省いています）",
  };
}

export async function checkPhoto(image: PhotoInput): Promise<PhotoCheck> {
  if (!hasClaudeKey()) return mockPhotoCheck();
  if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
    return { cleared: false, passable: false, icy: false, uncertain: true, comment: "写真が大きすぎて確認できませんでした。" };
  }
  return askJson({
    task:
      "雪かきの完了写真です。採点表の photo の規則で cleared・passable・icy を判定し、comment を書いてください。" +
      "暗い・ぼやけている・写っている範囲が狭いなどで判断できないときは uncertain=true にします（その場合 cleared と passable は false でかまいません）。",
    input: { note: "写真は1枚。玄関前から道路側を写している想定" },
    schema: PhotoCheckSchema,
    images: [{ mediaType: image.mediaType, base64: Buffer.from(image.bytes).toString("base64") }],
    effort: "low",
  });
}
