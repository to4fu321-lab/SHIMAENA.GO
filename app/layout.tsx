import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { baseUrl } from "@/lib/url";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  // OG 画像などを絶対 URL にする（X や LINE がリンクの見出し画像を取りに来るため）
  metadataBase: new URL(baseUrl()),
  title: "シマエナGO ・ 寒い冬は、くっついて乗り切る。",
  description:
    "雪の朝に点呼が届き、町内の3チームがひとり暮らしの家の雪をどける雪かきゲーム。1人でもソロ出動で10分から。Built with Claude: Japan 2026 提出作品。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
