// 設定: 登録のやり直し（spec v1.17: 画面で）。/start の登録をもう一度。羽やカードは消えない。
import Link from "next/link";

export default function RedoRegistration() {
  return (
    <Link href="/start?redo=1" className="btn btn-ink w-full text-lg">
      登録をやり直す
    </Link>
  );
}
