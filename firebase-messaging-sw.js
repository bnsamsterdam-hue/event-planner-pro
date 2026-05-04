/* BNS Firebase Messaging Service Worker V1
   Plaats dit bestand in de HOOFDMAP:
   /firebase-messaging-sw.js
*/
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

if (self.BNS_FIREBASE_CONFIG) {
  firebase.initializeApp(self.BNS_FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title =
      (payload.notification && payload.notification.title) ||
      payload.data?.title ||
      "BNS melding";

    const options = {
      body:
        (payload.notification && payload.notification.body) ||
        payload.data?.body ||
        "Nieuwe update in de planning",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: payload.data || {}
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url ||
    "/event-planner-pro/driver/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
