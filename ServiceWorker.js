const cacheName = "DefaultCompany-Roulette-0.1.0";

// 基础缓存文件（始终缓存）
const baseCache = [
    "TemplateData/style.css"
];

// 默认缓存列表（本地开发）
// 如果使用 Blob Storage，这些路径会被忽略，因为文件在 Blob Storage 中
const defaultBuildCache = [
    "Build/SideEffectsWebBuild_V0.2.loader.js",
    "Build/SideEffectsWebBuild_V0.2.framework.js",
    "Build/SideEffectsWebBuild_V0.2.data",
    "Build/SideEffectsWebBuild_V0.2.wasm"
];

// 注意：Service Worker 无法直接访问 window 对象
// Blob Storage URLs 需要在主线程中通过 message 传递，或使用默认路径
const contentToCache = baseCache.concat(defaultBuildCache);

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    
    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      try {
        await cache.addAll(contentToCache);
      } catch (error) {
        console.warn('[Service Worker] Some files failed to cache:', error);
        // 尝试逐个缓存文件
        for (const url of contentToCache) {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn(`[Service Worker] Failed to cache ${url}:`, err);
          }
        }
      }
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      let response = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (response) { return response; }

      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      cache.put(e.request, response.clone());
      return response;
    })());
});
