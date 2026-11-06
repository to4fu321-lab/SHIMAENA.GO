"use server";

// 下のタブ「隊長」の未読の数（spec v1.17）。cookie の本人（またはデモの ?as=）の隊長トークの、まだ開いていない行の数。
import { cookies } from "next/headers";
import { inboxKeyOf } from "@/lib/inbox/key";
import { unreadCount } from "@/lib/inbox/store";
import { repo } from "@/lib/repo";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export async function chatUnreadAction(as?: string): Promise<number> {
  try {
    const viewerId = as && isDemoViewer(as) ? as : readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
    const p = viewerId ? await repo().findParticipant(viewerId) : undefined;
    const key = inboxKeyOf(p);
    return key ? await unreadCount(key) : 0;
  } catch {
    return 0;
  }
}
