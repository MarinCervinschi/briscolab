// Umami (SPEC.md, decision 13): page views and one event per finished game, anonymous and without cookies. The
// script's address and the site's id come in at build time; without them, as in development, nothing is sent.
const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL as string | undefined;
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;

declare const __ENGINE_VERSION__: string;

/** The version of the engine the bots run on, as in the arena's results. */
export const ENGINE_VERSION = __ENGINE_VERSION__;

/** The Umami script for the page's head, or null when analytics are off. */
export const umamiScript =
	scriptUrl && websiteId
		? { src: scriptUrl, defer: true, "data-website-id": websiteId }
		: null;

declare global {
	interface Window {
		umami?: {
			track: (name: string, data: Record<string, string | number | boolean>) => void;
		};
	}
}

/** The end of a game: who played and how it went, never the moves. */
export function trackGameEnd(data: {
	bot: string;
	engine: string;
	level: string;
	winner: "player" | "bot" | "draw";
	margin: number;
	revealed: boolean;
}) {
	window.umami?.track("game_end", data);
}
