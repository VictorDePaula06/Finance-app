import { precacheAndRoute } from 'workbox-precaching';

// v5.0.4 - Fix Workbox imports
// v6.1.0 - Robust Push Handling
// v7.3.0 - Update via prompt (sem skipWaiting automatico; evita loop de reload)
// v7.4.0 - clients.claim no activate p/ o "Atualizar agora" recarregar de fato
const SW_VERSION = 'v7.4.0';

// Precache de todos os assets do Vite
precacheAndRoute(self.__WB_MANIFEST)

// NAO chamamos skipWaiting() no install de proposito: o SW novo fica em
// "waiting" ate o usuario clicar em "Atualizar". So entao o cliente envia
// SKIP_WAITING e ativamos a nova versao. (Evita loop de reload automatico.)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Ao ativar (depois do skipWaiting acionado pelo usuario), assume o controle
// das abas abertas. Isso dispara o evento 'controllerchange' no cliente, que o
// virtual:pwa-register usa para recarregar a pagina uma unica vez. Sem isso, o
// botao "Atualizar agora" nao recarregava (a aba seguia controlada pelo SW antigo).
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener para o evento de PUSH (Notificações Nativas)
self.addEventListener('push', (event) => {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // Se não for JSON, tenta pegar como texto
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Alívia';
  const options = {
    body: data.body || 'Você tem uma nova atualização!',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    // Garantir que a notificação apareça mesmo que o app esteja aberto
    tag: 'alivia-notification-' + Date.now(),
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})
