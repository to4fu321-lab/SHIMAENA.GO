// LINE のリッチメニューと同じアイコン（lib/brand.ts）。文字ラベルと必ず一緒に使う（アイコンだけのボタンは作らない）。
import { ICONS, type IconName } from "@/lib/brand";

export default function Icon({ name, size = 32, accent, className = "" }: { name: IconName; size?: number; accent?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      style={accent ? ({ "--icon-accent": accent } as React.CSSProperties) : undefined}
      // 中身は lib/brand.ts の固定の文字列だけ（利用者の入力は入らない）
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
