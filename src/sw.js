import { precacheAndRoute } from 'workbox-precaching'

// Precache de todos os assets do Vite
precacheAndRoute(self.__WB_MANIFEST)

// Listener para o evento de PUSH (Notificações Nativas)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Alívia'
  const options = {
    body: data.body || 'Você tem uma nova atualização!',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})
