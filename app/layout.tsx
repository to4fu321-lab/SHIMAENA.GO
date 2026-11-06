import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
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
  // ホーム画面に追加（PWA、spec v1.17）。アイコンは画像ファイルを持たず /api/icon で作る
  manifest: "/manifest.webmanifest",
  icons: { icon: "/api/icon/192.png", apple: "/api/icon/180.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "シマエナGO" },
};

export const viewport: Viewport = { themeColor: "#D9825B", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
