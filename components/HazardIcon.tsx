// 道の危険の三角アイコン（画面用）。絵は lib/road/icons.ts の1か所。
import { hazardSvg } from "@/lib/road/icons";
import type { HazardId } from "@/lib/road/hazards";

export default function HazardIcon({ id, size = 40, className = "" }: { id: HazardId; size?: number; className?: string }) {
  return <span className={`inline-block shrink-0 leading-none ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: hazardSvg(id, size) }} />;
}
