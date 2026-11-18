/* Service worker for web push (module 16). Shows the alert and opens its deep link when tapped. */
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SocietyApp', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SocietyApp', {
      body: data.body || '',
      data: { deepLink: data.deepLink || '/' },
    }),
  );
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.deepLink) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
