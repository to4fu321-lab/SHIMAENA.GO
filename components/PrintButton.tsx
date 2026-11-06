"use client";

/** 印刷のダイアログを開く（絵本の印刷用ページ） */
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-ink min-h-12 px-5 text-lg">
      🖨 印刷する
    </button>
  );
}
