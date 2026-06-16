/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE = `deck-${version}`;
// Content-hashed build assets + everything in static/. Safe to cache aggressively.
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Never intercept the API, SSE streams, or cross-origin requests.
	if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

	// Immutable, content-hashed assets: serve from cache first.
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
		return;
	}

	// Navigations and everything else: network-first, fall back to cache when offline.
	event.respondWith(fetch(request).catch(() => caches.match(request).then((c) => c || caches.match('/'))));
});
