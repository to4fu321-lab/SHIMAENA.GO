"use client";
// /admin 用: サーバーで作った中身（ReactNode の並び）を ‹ › で n 個ずつ見せる。関数はサーバーから渡せないので、ここで PagedList に包む。
import type { ReactNode } from "react";
import { PagedList } from "@/components/Pager";

export default function PagedNodes({ nodes, per = 1, label, empty }: { nodes: ReactNode[]; per?: number; label: string; empty?: ReactNode }) {
  return <PagedList items={nodes} per={per} label={label} empty={empty} render={(n, i) => <div key={i} className="contents">{n}</div>} />;
}
