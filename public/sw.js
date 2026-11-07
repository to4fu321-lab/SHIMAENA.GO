// シマエナGO の service worker（spec v1.17）: 端末への通知（Web Push）を受け取り、押したら隊長トークを開く。
// v1.31（スマートウォッチ）: 通知にボタン（朝／休む・行く／無理）を付け、押したら開かずに答えを送る。
// スマホに届いた通知はペアリングした時計（Apple Watch・Wear OS）にも映るので、手首で 1 タップで答えられる（ボタンが出るのは Android）。
// ページの中身はここで覚えない（いつも新しいものを取る）。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const ICON = { icon: "/api/icon/192.png", badge: "/api/icon/96.png?mono=1" };

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {}
  const title = d.title || "シマエナGO";
  const actions = Array.isArray(d.actions) ? d.actions.slice(0, 2).filter((a) => a && typeof a.action === "string" && typeof a.title === "string") : [];
  const labels = {};
  for (const a of actions) labels[a.action] = a.title;
  e.waitUntil(
    self.registration.showNotification(title, {
      ...ICON,
      body: d.body || "隊長トークに届いています",
      data: { url: d.url || "/chat", labels },
      tag: d.tag,
      renotify: Boolean(d.tag) && !d.silent,
      silent: Boolean(d.silent), // 夜の急がない知らせは音と振動なし
      actions,
    }),
  );
});

function openApp(url) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ("focus" in c) {
        if ("navigate" in c) c.navigate(url);
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  });
}

/** 通知のボタンで答える: 開かずに /api/push/act へ送り、受け付けたことを同じ通知に出す（時計にも映る） */
function answerFromNotification(n, action) {
  const data = action.slice(3);
  const label = (n.data && n.data.labels && n.data.labels[action]) || "";
  return fetch("/api/push/act", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data, label }),
  })
    .then((r) => r.json())
    .then((j) => {
      if (!j || !j.ok) throw new Error("not ok");
      return self.registration.showNotification(`✅ ${label || "答え"} を受け付けました`, {
        ...ICON,
        body: j.text || "隊長トークに返事があります",
        tag: n.tag || "act",
        data: { url: "/chat" },
      });
    })
    .catch(() => openApp("/chat")); // ログインの印がない・電波がない → 開いて答える
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action && e.action.startsWith("pb:")) {
    e.waitUntil(answerFromNotification(e.notification, e.action));
    return;
  }
  const url = (e.notification.data && e.notification.data.url) || "/chat";
  e.waitUntil(openApp(url));
});
