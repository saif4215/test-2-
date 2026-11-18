// Lets the Maruf Cafe web app show a notification (for example "Your order is ready") from the background. It stores nothing and changes nothing else.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.includes("/app/"));
    return open ? open.focus() : self.clients.openWindow("/app/");
  }));
});
