import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Emits sw.js with every built file precached, so the installed app works offline. */
function serviceWorker(): Plugin {
  return {
    name: 'bar-bench-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['./', ...Object.keys(bundle).map((f) => './' + f), './manifest.webmanifest', './emblem.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
      const version = Date.now().toString(36);
      const source = `const CACHE = 'bar-bench-${version}';
const FILES = ${JSON.stringify([...new Set(files)])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return r; }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  server: { port: 5173, open: false },
  build: {
    chunkSizeWarningLimit: 2500,
  },
});
