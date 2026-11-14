// 読み込み中の表示（spec v1.58。本人「読み込み中が分かるようにして、読み込みする時全て」）の数え方。
// 画面の fetch（ボタンのサーバー処理・ページの移動・API）を数えて、1つでも動いていれば LoadingBar が「読み込み中…」を出す。
// 裏で数秒ごとに取り直すもの（地図の自動更新・隊長トークの受信など）は数えない: 呼ぶ直前に quietly() で印を付ける。

type Listener = (busy: number, since: number | null) => void;

let busy = 0;
let since: number | null = null;
let quietUntil = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l(busy, since));

export function onLoading(l: Listener): () => void {
  listeners.add(l);
  l(busy, since);
  return () => void listeners.delete(l);
}

/** このあとすぐ始まる fetch は数えない（裏の取り直し用）。fn を渡せばそのまま呼ぶ */
export function quietly<T>(fn?: () => T): T | undefined {
  quietUntil = Date.now() + 400;
  return fn?.();
}

/** 先読み（Next のリンクの prefetch）は数えない */
function isPrefetch(init?: RequestInit, input?: RequestInfo | URL): boolean {
  const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return h.has("next-router-prefetch") || h.get("purpose") === "prefetch";
}

let installed = false;
/** window.fetch に数える係をつなぐ（画面に1回だけ） */
export function installLoadingWatch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (Date.now() < quietUntil || isPrefetch(init, input)) return orig(input, init);
    busy++;
    if (busy === 1) since = Date.now();
    emit();
    const done = () => {
      busy = Math.max(0, busy - 1);
      if (busy === 0) since = null;
      emit();
    };
    return orig(input, init).then(
      (r) => {
        done();
        return r;
      },
      (e) => {
        done();
        throw e;
      },
    );
  };
}
