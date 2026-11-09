// Runs after `vite build`: vite-plugin-pwa cannot write the service worker in a TanStack Start build, so
// Workbox writes it here, once the prerendered pages exist and can be precached for offline play.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
	globDirectory: "dist/client",
	globPatterns: ["**/*.{js,css,html,svg,png,jpg,wasm,woff2,webmanifest,wav}"],
	swDest: "dist/client/sw.js",
	// Page URLs end in a slash; the precache holds their index.html.
	directoryIndex: "index.html",
	// The engine's wasm holds the champion network's weights, 2.8 MB; Workbox skips files over 2 MiB by default.
	maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	skipWaiting: true,
});
for (const warning of warnings) console.warn(warning);
console.log(`sw.js precaches ${count} files, ${(size / 1024).toFixed(0)} KiB`);
