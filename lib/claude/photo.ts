// 完了写真の確認: 雪が除かれているか／通路が通れるか／凍結が残っていないか。spec 9-3。
import { z } from "zod";
import { MAX_IMAGE_BYTES, type ImageType } from "../image";
import type { PhotoCheck } from "../types";
import { askJson, hasClaudeKey } from "./client";

export const PhotoCheckSchema = z.object({
  cleared: z.boolean(),
  passable: z.boolean(),
  icy: z.boolean(),
  comment: z.string(),
});

export interface PhotoInput {
  bytes: Uint8Array;
  mediaType: ImageType;
}

export function mockPhotoCheck(): PhotoCheck {
  return {
    cleared: true,
    passable: true,
    icy: false,
    comment: "写真を受け取りました。お疲れさまでした。（Claude のキーがないので、写真の中身の確認は省いています）",
  };
}

export async function checkPhoto(image: PhotoInput): Promise<PhotoCheck> {
  if (!hasClaudeKey()) return mockPhotoCheck();
  if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ...mockPhotoCheck(), comment: "写真が大きすぎて確認できませんでしたが、完了として受け付けました。" };
  }
  return askJson({
    task: "雪かきの完了写真です。採点表の photo の規則で cleared・passable・icy を判定し、comment を書いてください。",
    input: { note: "写真は1枚。玄関前から道路側を写している想定" },
    schema: PhotoCheckSchema,
    images: [{ mediaType: image.mediaType, base64: Buffer.from(image.bytes).toString("base64") }],
    effort: "low",
  });
}
