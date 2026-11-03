// 完了写真の確認: 雪が除かれているか／通路が通れるか／凍結が残っていないか。spec 9-3。
// v1.1: 判断できない写真は uncertain=true → 「報告として受け付け」。AI を最終判定者にしない（手動の道は ops.completeManually）。
// v1.2: 雪質（snowType）と労いの一言（care）。雪質はカードの排雪 kg にも使う。
import { z } from "zod";
import { MAX_IMAGE_BYTES, type ImageType } from "../image";
import type { PhotoCheck, SnowType } from "../types";
import { askJson, hasClaudeKey } from "./client";

export const SNOW_TYPE_LABEL: Record<SnowType, string> = {
  powder: "軽い粉雪",
  wet: "重い湿り雪",
  icy: "凍った雪",
  unknown: "ふつうの雪",
};

/** 雪の密度の目安（kg/m³）。排雪 kg の推定に使う */
export const SNOW_DENSITY: Record<SnowType, number> = { powder: 100, unknown: 150, wet: 300, icy: 400 };

export const CARE_MAX = 30;

export const PhotoCheckSchema = z.object({
  cleared: z.boolean(),
  passable: z.boolean(),
  icy: z.boolean(),
  /** 写真では判断できない（暗い・ぼやけ・写っている範囲が狭い） */
  uncertain: z.boolean(),
  /** 雪質 */
  snowType: z.enum(["powder", "wet", "icy", "unknown"]),
  /** 労いの一言（30字まで）。安全の一言はよいが、体調の判断はしない */
  care: z.string(),
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

export function trimCare(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, CARE_MAX);
}

export function mockPhotoCheck(): PhotoCheck {
  return {
    cleared: true,
    passable: true,
    icy: false,
    uncertain: false,
    snowType: "unknown",
    care: "お疲れさまでした。あたたかくして、水分もどうぞ。",
    comment: "写真を受け取りました。お疲れさまでした。（Claude のキーがないので、写真の中身の確認は省いています）",
  };
}

export async function checkPhoto(image: PhotoInput): Promise<PhotoCheck> {
  if (!hasClaudeKey()) return mockPhotoCheck();
  if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
    return {
      cleared: false,
      passable: false,
      icy: false,
      uncertain: true,
      snowType: "unknown",
      care: "お疲れさまでした。",
      comment: "写真が大きすぎて確認できませんでした。",
    };
  }
  const res = await askJson({
    task:
      "雪かきの完了写真です。採点表の photo の規則で cleared・passable・icy・snowType を判定し、comment と care を書いてください。" +
      "暗い・ぼやけている・写っている範囲が狭いなどで判断できないときは uncertain=true にします（その場合 cleared と passable は false でかまいません）。" +
      "care は雪質に合わせた労いの一言（30字まで。例: 重い雪でしたね、腰に気をつけて）。体調や医療の判断はしません。",
    input: { note: "写真は1枚。玄関前から道路側を写している想定" },
    schema: PhotoCheckSchema,
    images: [{ mediaType: image.mediaType, base64: Buffer.from(image.bytes).toString("base64") }],
    effort: "low",
  });
  return { ...res, care: trimCare(res.care) };
}
