// マイページのアイコン（spec v1.32）。画像ファイルなし: 絵文字をうすい色の丸に。「bird」はシマエナガの絵（Mascot）。
// マフラーの色は今週のチーム（Mascot と同じ）。
import { iconBgColor, iconEmoji, type IconBgId, type IconId } from "@/lib/mypage/rules";
import type { TeamId } from "@/lib/types";
import Mascot from "./Mascot";

export default function Avatar({
  icon,
  bg,
  size = 64,
  team,
  className = "",
  ring = true,
}: {
  icon?: IconId;
  bg?: IconBgId;
  size?: number;
  team?: TeamId;
  className?: string;
  ring?: boolean;
}) {
  const id = icon ?? "bird";
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${ring ? "shadow-sm ring-2 ring-white" : ""} ${className}`}
      style={{ width: size, height: size, background: iconBgColor(bg) }}
      aria-hidden="true"
    >
      {id === "bird" ? (
        <Mascot size={Math.round(size * 0.86)} team={team} />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.56), lineHeight: 1 }}>{iconEmoji(id)}</span>
      )}
    </span>
  );
}
