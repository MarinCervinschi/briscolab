// Runs after `vite build`: vite-plugin-pwa cannot write the service worker in a TanStack Start build, so
// Workbox writes it here, once the prerendered pages exist and can be precached for offline play.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
	globDirectory: "dist/client",
	globPatterns: ["**/*.{js,css,html,svg,png,jpg,wasm,woff2,webmanifest}"],
	swDest: "dist/client/sw.js",
	// Page URLs end in a slash; the precache holds their index.html.
	directoryIndex: "index.html",
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	skipWaiting: true,
});
for (const warning of warnings) console.warn(warning);
console.log(`sw.js precaches ${count} files, ${(size / 1024).toFixed(0)} KiB`);
