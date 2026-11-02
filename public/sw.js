// MyFarm service worker. It stores only built assets and the data-free offline shell, never signed-in pages or API responses.
// policy() must match serviceWorkerPolicy in src/modules/offline-first/domain/storage.ts; a unit test compares them.
const CACHE = "myfarm-shell-v1";
const SHELL = "/offline";

function policy({ method, sameOrigin, pathname, navigation }) {
  if (method !== "GET" || !sameOrigin || pathname.startsWith("/api/")) return "NETWORK_ONLY";
  if (pathname.startsWith("/_next/static/") || pathname === "/manifest.webmanifest" || pathname === "/icon.svg") return "STATIC_CACHE";
  if (pathname === SHELL) return "OFFLINE_SHELL";
  return navigation ? "NETWORK_THEN_SHELL" : "NETWORK_ONLY";
}
self.myfarmPolicy = policy;

/** Stores the shell and every built asset its HTML names, then drops assets from older builds. */
async function refreshShell() {
  const response = await fetch(SHELL, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error("Shell unavailable");
  const html = await response.clone().text();
  const assets = new Set([...html.matchAll(/\/_next\/static\/[^"'\\\s)<>]+/g)].map(match => match[0]));
  const cache = await caches.open(CACHE);
  await Promise.all([...assets, "/manifest.webmanifest", "/icon.svg"].map(asset => cache.add(asset).catch(() => undefined)));
  await cache.put(SHELL, response);
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/_next/static/") && !assets.has(pathname)) await cache.delete(request);
  }
  return cache.match(SHELL);
}

self.addEventListener("install", event => { event.waitUntil(refreshShell().then(() => self.skipWaiting())); });
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const decision = policy({ method: event.request.method, sameOrigin: url.origin === self.location.origin, pathname: url.pathname, navigation: event.request.mode === "navigate" });
  if (decision === "STATIC_CACHE") {
    event.respondWith(caches.match(event.request).then(cached => cached ?? fetch(event.request).then(async response => {
      if (response.ok) await (await caches.open(CACHE)).put(event.request, response.clone());
      return response;
    })));
  } else if (decision === "OFFLINE_SHELL") {
    event.respondWith(refreshShell().catch(() => caches.match(SHELL)).then(cached => cached ?? Response.error()));
  } else if (decision === "NETWORK_THEN_SHELL") {
    event.respondWith(fetch(event.request).catch(async () => (await caches.match(SHELL)) ? Response.redirect(new URL(SHELL, self.location.origin).href, 302) : Response.error()));
  }
});
