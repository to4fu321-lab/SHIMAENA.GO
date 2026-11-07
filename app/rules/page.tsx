import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/Icon";
import Tutorial from "@/components/tutorial/Tutorial";
import { lineJoinUrl } from "@/lib/line/join";
import TabBar from "@/components/TabBar";
import { TEAMS } from "@/lib/teams";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "使い方 ・ シマエナGO" };

/** くわしいルールの1項目（開け閉めできる） */
function Card({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-card shadow-sm ring-1 ring-ink/10">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-4">{children}</div>
    </details>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-bold text-white">{n}</span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-ink-soft">{text}</p>
      </div>
    </li>
  );
}

const BRING = [
  ["長靴", "すべりにくい底のもの"],
  ["手袋", "防水のもの。替えがあると安心"],
  ["帽子・ネックウォーマー", "朝はとても冷えます"],
  ["スコップかスノーダンプ", "なければ「道具はない」で登録。補給や偵察で参加できます"],
  ["明るい色の上着か反射材", "朝は暗く、車から見えにくい"],
  ["飲み物", "汗をかくので水分を"],
  ["スマホ", "終わったら写真を1枚"],
] as const;

const CAREFUL = [
  ["屋根の下に近づかない", "落雪はとても危険です。屋根には上りません"],
  ["車と除雪車に気をつける", "道路に出るときは左右を見て。道路に雪を出さない"],
  ["転ばない", "小さな歩幅で、足の裏全体で歩く"],
  ["腰を守る", "ひざを曲げて、少しずつすくう。ひねらない"],
  ["ひとりでやらない", "群れで動くのがシマエナGO。子どもは大人と一緒に"],
  ["無理しない", "10分でも立派な参加です。疲れたら休む、寒かったら帰る"],
  ["体調がすぐれない日は休む", "お知らせに答える必要はありません。行ける日だけで大丈夫"],
] as const;

export default function RulesPage() {
  // くわしいルール（チュートリアルの「大切なルール」から開く）
  const rules = (
    <>
    <Card title="下のタブ（5つ）">
      <ul className="space-y-2">
        {(
          [
            ["house", "ホーム", "今日の雪・チーム・雪かきGO！・ソロ活動はここから。「雪かきをお願いする」もここ。のぞくだけでもOK。"],
            ["map", "マップ", "町の雪の状況と、助けが必要な家（50m のマス）。滑る所・細い道など、近所の人の道の報告もここで。"],
            ["team", "チーム", "今週のあなたのチームと、3チームの様子。隊長トーク（お知らせ・相談）はホームの吹き出しの「隊長に相談する」から。"],
            ["connect", "つなぐ", "広める（SNS に投稿）・友だちを誘う・応援を呼ぶ・雪かきバトン・なかま（合流）。いつでもここから。"],
            ["card", "きろく", "今日の羽・連続出動・その時だけのカード・図鑑。"],
          ] as const
        ).map(([icon, label, text]) => (
          <li key={label} className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-card ring-1 ring-ink/20">
              <Icon name={icon} size={30} accent="var(--lamp)" />
            </span>
            <span>
              <b>{label}</b>
              <span className="block text-base text-ink-soft">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-base">この「使い方」はホーム右上と設定から。登録の確認・やり直し・連携コードは、ホーム右上の「設定」から。LINE は本人の確認（ログイン）にだけ使います。</p>
    </Card>

    <Card title="手伝う人は、3つだけ">
      <ol className="space-y-4">
        <Step n={1} title="積もった朝、隊長トークにお知らせが届く" text="10cm 以上積もった朝 6:30 に自動で「助けてほしい家が○軒」。毎朝の質問はありません。お昼 11:30・夕方 16:30 にも、まだ待っている家をお知らせ。6〜19時なら、いつでも10分から。" />
        <Step n={2} title="地図でピンを押して「行く」" text="町の地図のオレンジのピンが待っている家。「雪かきGO！」で準備と今日の合言葉を確かめて出発。同じチームの仲間も見えます。" />
        <Step n={3} title="終わったら写真を1枚" text="「写真を撮る」ボタンで1枚。町の地図のマスがチームの色に塗られて、その時だけのカードが届きます。" />
      </ol>
    </Card>

    <Card title="手伝ってほしい人は、登録だけ">
      <p>
        「雪かきをお願いする」で、家の人も一緒に雪かきするか（<b>おまかせ／一緒にやる</b>）と、どこまで（<b>玄関前・車庫前・道路まで</b>）を1回登録するだけ。写真を撮れば、どこまでかを隊長が読み取ります。
      </p>
      <p>10cm 以上積もった朝 6:30 に、近所の人へ自動でお知らせが届きます。雪の少ない日でも 6〜19時なら「今日、頼む」ができます。</p>
      <p className="text-ink-soft">手伝う人も、自分の家を「頼める家」にできます（お互いさま）。スマホを使っていない方は、ご家族が代わりに登録できます。終わったらご家族にも知らせが届きます。</p>
    </Card>

    <Card title="チームと点数">
      <div className="flex flex-wrap gap-2">
        {TEAMS.map((t) => (
          <span key={t.id} className="rounded-full bg-card px-4 py-1 font-bold ring-2" style={{ "--tw-ring-color": t.color } as React.CSSProperties}>
            <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
            {t.name}（{t.colorName}）
          </span>
        ))}
      </div>
      <p>
        手伝う人は3チームに分かれます。チームは<b>月曜〜日曜の1週間</b>。<b>日曜の夜 9時</b>に組み直して、隊長トークに「チーム発表」が届きます。毎週ちがう顔ぶれなので、いろんな人と知り合えます。
      </p>
      <p className="text-ink-soft">町の地図のマスと、シマエナガのマフラーが、あなたのチームの色になります。</p>
      <ul className="list-inside list-disc space-y-1 text-ink-soft">
        <li>1軒終わると 10点。朝 9時までなら +5点、ドカ雪の日（15cm 以上）も +5点</li>
        <li>雪かきは 6時〜19時なら、いつ始めても・いつ終えても OK（19時以降はお休み）</li>
        <li>同じチームで2人以上なら、ひとり +5点</li>
        <li>ほかのチームを手伝うと、<b>両方のチームに</b> +5点</li>
        <li>人手が足りない家（赤く点滅）に駆けつけると +10点</li>
        <li>偵察（写真1枚）やお茶の差し入れも 3点</li>
      </ul>
      <p className="text-sm text-ink-soft">点数はお金にはなりません。エリアの中だけで比べます。</p>
    </Card>

    <Card title="持ちもの">
      <ul className="space-y-2">
        {BRING.map(([what, note]) => (
          <li key={what}>
            <b>{what}</b>
            <span className="text-ink-soft"> ― {note}</span>
          </li>
        ))}
      </ul>
    </Card>

    <Card title="けがをしないために" open>
      <ul className="space-y-2">
        {CAREFUL.map(([what, note]) => (
          <li key={what} className="rounded-2xl bg-alert/10 px-3 py-2">
            <b className="text-alert">{what}</b>
            <br />
            <span>{note}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-soft">
        けがや急な体調の変化があったときは、ためらわずに 119 番へ。シマエナGO は体調の判断はしません。
      </p>
    </Card>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Link href="/map" className="btn btn-ink text-lg">
          地図を見る
        </Link>
        <Link href="/" className="btn btn-white text-lg">
          ホームへ
        </Link>
      </div>
    </>
  );
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <Bgm track="morning" />
      <Tutorial joinUrl={lineJoinUrl()} rules={rules} />
      <TabBar />
    </div>
  );
}
