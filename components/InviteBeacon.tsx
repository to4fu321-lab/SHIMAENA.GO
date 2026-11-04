"use client";
// 招待リンクで開いたことを1回だけ知らせる（誘った人に「○人が見てくれた」と返すため。v1.8）。表示は何もしない
import { useEffect } from "react";
import { inviteOpenAction } from "@/app/public/actions";

export default function InviteBeacon({ code }: { code: string }) {
  useEffect(() => {
    inviteOpenAction(code).catch(() => undefined);
  }, [code]);
  return null;
}
