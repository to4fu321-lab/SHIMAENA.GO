import type { Metadata } from "next";
import StartScreen from "@/components/StartScreen";
import { TOWN } from "@/lib/town";

export const metadata: Metadata = { title: "はじめる ・ シマエナGO" };

// LINE で1タップ開始（spec v1.14）。どの「参加する」ボタンもここ（LINE アプリの中）を開く。
export default function StartPage() {
  return <StartScreen liffId={process.env.NEXT_PUBLIC_LIFF_ID} center={TOWN.center} />;
}
