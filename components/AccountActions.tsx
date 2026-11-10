"use client";

// 設定の「アカウント」（11/10 本人「ログアウト機能、退会機能を追加したい」）。
// ログアウト: この端末の「自分」の印を消すだけ（登録は残る）。退会: 登録と記録を全部消す（2回押して確かめる）。
import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { withdrawAction } from "@/app/settings/actions";

export default function AccountActions({ mode, name }: { mode: "line" | "demo" | "guest"; name?: string }) {
  const [asking, setAsking] = useState(false);
  if (mode === "demo") {
    return (
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="アカウント">
        <h2 className="text-lg font-bold">デモの人で見ています</h2>
        <p className="text-base">{name ? `${name}さん（架空の人）` : "架空の人"}です。ログアウトや退会はありません。別の人で見るときは、えらび直してください。</p>
        <Link href="/demo" className="btn btn-white w-full text-lg" data-sound="back">
          デモの人をえらび直す
        </Link>
      </section>
    );
  }
  if (mode === "guest") {
    return (
      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="アカウント">
        <h2 className="text-lg font-bold">ログインしていません</h2>
        <p className="text-base">ログアウトと退会は、LINE でログインした人が使えます。</p>
      </section>
    );
  }
  return (
    <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="アカウント">
      <h2 className="text-lg font-bold">アカウント</h2>
      {!asking ? (
        <>
          <form action={logoutAction}>
            <button className="btn btn-ink w-full text-lg">ログアウト</button>
          </form>
          <p className="text-sm text-ink-soft">ログアウトしても登録は残ります。LINE でまたログインすれば、続きから。</p>
          <button type="button" onClick={() => setAsking(true)} className="btn btn-white w-full text-lg text-alert">
            退会する
          </button>
        </>
      ) : (
        <>
          <p className="rounded-2xl bg-alert-soft px-3 py-2 text-base font-bold text-alert">
            退会すると、登録・家の場所・カード・羽・記録が全部消えます。元に戻せません。
          </p>
          <form action={withdrawAction}>
            <button className="btn btn-alert w-full text-lg">消して退会する</button>
          </form>
          <button type="button" onClick={() => setAsking(false)} className="btn btn-white w-full text-lg" data-sound="back">
            やめる
          </button>
        </>
      )}
    </section>
  );
}
