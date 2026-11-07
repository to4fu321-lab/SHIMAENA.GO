// マイページのアイコン（spec v1.32）。画像ファイルなし: 絵文字をうすい色の丸に。「bird」はシマエナガの絵（Mascot）。
// マフラーの色は今週のチーム（Mascot と同じ）。photo（自分の写真の data URL）があれば、それを丸く切って出す（11/7 本人の指示）。
import { iconBgColor, iconEmoji, type IconBgId, type IconId } from "@/lib/mypage/rules";
import type { TeamId } from "@/lib/types";
import Mascot from "./Mascot";

export default function Avatar({
  icon,
  bg,
  photo,
  size = 64,
  team,
  className = "",
  ring = true,
}: {
  icon?: IconId;
  bg?: IconBgId;
  photo?: string;
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
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL の小さな写真なので next/image は使わない
        <img src={photo} alt="" width={size} height={size} className="size-full object-cover" />
      ) : id === "bird" ? (
        <Mascot size={Math.round(size * 0.86)} team={team} />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.56), lineHeight: 1 }}>{iconEmoji(id)}</span>
      )}
    </span>
  );
}
