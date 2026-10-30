import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	// The engine's worker imports the WebAssembly module, so it is built as an ES module.
	worker: { format: "es" },
	plugins: [
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/paraglide",
			// Italian at the root, English under /en: every page exists as static HTML in both.
			strategy: ["url", "baseLocale"],
		}),
		tailwindcss(),
		tanstackStart({
			// Query strings name the same page: only paths are prerendered.
			prerender: {
				enabled: true,
				crawlLinks: true,
				filter: ({ path }) => !path.includes("?"),
			},
			pages: [{ path: "/" }, { path: "/en" }, { path: "/play" }, { path: "/en/play" }],
		}),
		viteReact(),
		// Only the manifest and registerSW.js: scripts/sw.mjs writes the service worker after the build.
		VitePWA({
			injectRegister: "script-defer",
			registerType: "autoUpdate",
			manifest: {
				name: "Briscolab",
				short_name: "Briscolab",
				description: "Gioca a briscola contro i bot e guarda come ragionano.",
				lang: "it",
				start_url: "/",
				display: "standalone",
				background_color: "#02070A",
				theme_color: "#02070A",
				icons: [
					{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "/icon-maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
		}),
	],
});
