// sw.js - Service Worker completo para MakerAI Studio
const CACHE_NAME = 'makerai-v1.0';
const APP_VERSION = '1.0.0';

// URLs para cache (opcional - básico)
const CACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS/JS serão cacheados dinamicamente
];

// ========== INSTALAÇÃO ==========
self.addEventListener('install', (event) => {
  console.log(`📱 Service Worker v${APP_VERSION} instalando...`);
  
  // Pular a fase de espera (ativar imediatamente)
  self.skipWaiting();
  
  // Cache inicial (opcional)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache inicial criado');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Instalação completa');
      })
      .catch((error) => {
        console.error('❌ Erro na instalação:', error);
      })
  );
});

// ========== ATIVAÇÃO ==========
self.addEventListener('activate', (event) => {
  console.log('🔧 Service Worker ativando...');
  
  event.waitUntil(
    // Limpar caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Ativação completa');
      // Tomar controle de todas as tabs abertas
      return self.clients.claim();
    })
  );
});

// ========== ESTRATÉGIA DE CACHE ==========
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignora requisições de analytics, etc.
  if (url.pathname.includes('chrome-extension') || 
      url.pathname.includes('sockjs-node') ||
      url.hostname === 'localhost:35729') {
    return;
  }
  
  // Para o seu site, usa estratégia "Network First, Cache Fallback"
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Se a requisição foi bem sucedida, cacheia para offline
        if (response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se offline, tenta servir do cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se não tem no cache, retorna página offline
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            // Para outros recursos, retorna null
            return new Response('Offline', {
              status: 503,
              statusText: 'Offline',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// ========== MENSAGENS ==========
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ========== SYNC BACKGROUND ==========
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('🔄 Sincronização em background');
  }
});

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nova atualização disponível',
    icon: '/icons/icon-192x192.png', // Opcional
    badge: '/icons/icon-96x96.png',  // Opcional
    tag: data.tag || 'makerai-update',
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'MakerAI Studio', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});