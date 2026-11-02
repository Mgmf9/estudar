/* Service worker do Caderno de estudos: abre o app sem internet.
   - Página: tenta a rede primeiro (para sempre pegar a versão nova) e usa o cache se estiver offline.
   - Fontes: cache.
   - /api e Firebase: nunca passam pelo cache. */
var V = "caderno-v1";
self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k !== V; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  var font = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !font) return;
  if (u.pathname.indexOf("/api/") === 0 || u.pathname === "/health") return;
  if (font) {
    e.respondWith(caches.open(V).then(function(c){ return c.match(r).then(function(m){ return m || fetch(r).then(function(x){ c.put(r, x.clone()); return x; }); }); }));
    return;
  }
  if (r.mode === "navigate" || u.pathname.slice(-5) === ".html" || u.pathname.slice(-1) === "/") {
    e.respondWith(fetch(r).then(function(x){ var k = x.clone(); caches.open(V).then(function(c){ c.put("./", k); }); return x; }).catch(function(){ return caches.match("./").then(function(m){ return m || Response.error(); }); }));
  }
});
