import type { Metadata } from "next";
import Link from "next/link";
import { TEAMS } from "@/lib/teams";

export const metadata: Metadata = { title: "あそびかた ・ シマエナGO" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-neon text-lg font-bold text-white">{n}</span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-ink/80">{text}</p>
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
  ["無理しない", "5分でも立派な参加です。疲れたら休む、寒かったら帰る"],
  ["体調がすぐれない日は休む", "点呼で「0分」と答えればだいじょうぶ"],
] as const;

export default function RulesPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 bg-paper px-4 py-6 text-ink">
      <header className="space-y-2 text-center">
        <p className="text-sm font-bold tracking-widest text-neon">あそびかた</p>
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-neon">GO</span>
        </h1>
        <p className="text-lg">寒い冬は、くっついて乗り切る。</p>
        <p className="text-ink/80">
          雪の朝、町内のみんなで、ひとり暮らしの家の雪かきをするゲームです。
          シマエナガが枝の上で身を寄せ合って冬を越すように。
        </p>
      </header>

      <Card title="手伝う人は、3つだけ">
        <ol className="space-y-4">
          <Step n={1} title="雪の朝、LINE に1問だけ届く" text="「今朝、何分動けますか？」0・15・30・60 から1つ押すだけ。" />
          <Step n={2} title="「行く」を押す" text="近くの家と時間が届きます。地図で同じチームの仲間も見えます。" />
          <Step n={3} title="終わったら写真を1枚" text="地図のマスがチームの色に塗られて、その朝だけのカードが届きます。" />
        </ol>
      </Card>

      <Card title="手伝ってほしい人は、1つだけ">
        <p>
          雪の朝に届く「今朝、玄関は出られそうですか？」に、<b>はい・いいえ・一緒なら</b>から1つ押すだけ。
        </p>
        <p className="text-ink/80">LINE を使っていない方は、ご家族が代わりに登録できます。終わったらご家族にも知らせが届きます。</p>
      </Card>

      <Card title="チームと点数">
        <div className="flex flex-wrap gap-2">
          {TEAMS.map((t) => (
            <span key={t.id} className="rounded-full px-4 py-1 font-bold text-white" style={{ background: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
        <p>町内の人は3チームに分かれます。チームは毎週日曜に入れ替わるので、いろんな人と知り合えます。</p>
        <ul className="list-inside list-disc space-y-1 text-ink/90">
          <li>1軒終わると 10点。7:30 までなら +5点</li>
          <li>同じチームで2人以上なら、ひとり +5点</li>
          <li>ほかのチームを手伝うと、<b>両方のチームに</b> +5点</li>
          <li>人手が足りない家（赤く点滅）に駆けつけると +10点</li>
          <li>偵察（写真1枚）やお茶の差し入れも 3点</li>
        </ul>
        <p className="text-sm text-ink/70">点数はお金にはなりません。町内の中だけで比べます。</p>
      </Card>

      <Card title="持ちもの">
        <ul className="space-y-2">
          {BRING.map(([what, note]) => (
            <li key={what}>
              <b>{what}</b>
              <span className="text-ink/70"> ― {note}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="けがをしないために">
        <ul className="space-y-2">
          {CAREFUL.map(([what, note]) => (
            <li key={what} className="rounded-2xl bg-alert/10 px-3 py-2">
              <b className="text-alert">{what}</b>
              <br />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink/70">
          けがや急な体調の変化があったときは、ためらわずに 119 番へ。シマエナGO は体調の判断はしません。
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 pb-6">
        <Link href="/map" className="rounded-2xl bg-ink py-4 text-center text-lg font-bold text-white">
          地図を見る
        </Link>
        <Link href="/" className="rounded-2xl bg-white py-4 text-center text-lg font-bold ring-2 ring-ink">
          はじめに戻る
        </Link>
      </div>
    </main>
  );
}
