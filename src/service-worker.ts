/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

// Caches only the app shell (code, icons, offline page). Budget data is never cached: it is always live.
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `app-${version}`;
const ASSETS = [...build, ...files.filter((f) => !f.endsWith('.map'))];

sw.addEventListener('install', (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (e) => {
	e.waitUntil(
		(async () => {
			for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (e) => {
	const req = e.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;
	if (ASSETS.includes(url.pathname)) {
		e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
	} else if (req.mode === 'navigate') {
		e.respondWith(fetch(req).catch(async () => (await caches.match('/offline.html')) ?? Response.error()));
	}
});
