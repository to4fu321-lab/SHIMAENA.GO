// /admin に出す名前。架空の町内の人（h1・r2 のような ID）はそのまま、LINE で登録した本物の人は仮名にする。
// LINE の表示名は本名のことが多い。撮影や画面共有で /admin を映しても、本物の名前が出ないようにする（約束ごと: 実在の氏名を出さない）。
import type { Participant } from "./types";

const DEMO_ID = /^[hr]\d+$/;

export interface NameMasker {
  /** 参加者 ID → 画面に出す呼び名 */
  label: (id: string) => string;
  /** 文の中の本物の名前を仮名に置き換える（記録・LINE の文面） */
  mask: (text: string) => string;
}

export function makeNameMasker(participants: Participant[]): NameMasker {
  const alias = new Map<string, string>();
  const real: [string, string][] = [];
  let n = 0;
  for (const p of participants) {
    if (DEMO_ID.test(p.id)) {
      alias.set(p.id, p.nickname);
      continue;
    }
    n++;
    const a = `${p.role === "helper" ? "手伝う人" : "お願いする人"}${n}`;
    alias.set(p.id, a);
    const name = p.nickname.trim();
    if (name.length >= 1) real.push([name, a]);
  }
  // 長い名前から置き換える（「山田」と「山田花子」があっても崩れない）
  real.sort((x, y) => y[0].length - x[0].length);
  return {
    label: (id) => alias.get(id) ?? "（不明な人）",
    mask: (text) => real.reduce((t, [name, a]) => t.split(name).join(a), text),
  };
}
