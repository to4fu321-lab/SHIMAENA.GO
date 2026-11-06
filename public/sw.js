// シマエナGO の service worker（spec v1.17）: 端末への通知（Web Push）を受け取り、押したら隊長トークを開く。
// ページの中身はここで覚えない（いつも新しいものを取る）。
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {}
  const title = d.title || "シマエナGO";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "隊長トークに届いています",
      icon: "/api/icon/192.png",
      badge: "/api/icon/96.png?mono=1",
      data: { url: d.url || "/chat" },
      tag: d.tag,
      renotify: Boolean(d.tag),
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/chat";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
