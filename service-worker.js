"use strict";

/* Service worker del Time Out Quirúrgico (CIMA).
   Cachea el shell estático (HTML/CSS/JS) para permitir instalación y uso
   sin conexión. Los registros ya no viven en localStorage: se guardan en
   el servidor compartido, así que guardar/continuar un registro requiere
   conexión (solo el "cascarón" de la app funciona sin internet). */

const CACHE_VERSION = "v5";
const CACHE_NAME = `timeout-quirurgico-cima-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./poster.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/qrcode.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Red primero: mientras haya conexión, siempre se sirve la versión más
  // reciente publicada (la app cambia seguido). Solo se recurre a la copia
  // guardada si falla la red (uso sin conexión).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
