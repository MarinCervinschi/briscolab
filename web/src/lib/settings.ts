import { useSyncExternalStore } from "react";

// The viewer's settings (DESIGN.md, "Screens"), kept in this browser only. Storage may be blocked: then the defaults
// hold for the visit and nothing breaks.

export const DRAWINGS = ["tree", "montecarlo", "net"] as const;
export const BACK_STYLES = ["tavola", "quaderno", "vetrino"] as const;
export const THEMES = ["system", "light", "dark"] as const;

export interface Settings {
	drawing: (typeof DRAWINGS)[number];
	backStyle: (typeof BACK_STYLES)[number];
	theme: (typeof THEMES)[number];
	sound: boolean;
}

export const DEFAULTS: Settings = {
	drawing: "tree",
	backStyle: "tavola",
	theme: "system",
	sound: true,
};

/** The storage key, also read by the script in the page's head that sets the theme before the first paint. */
export const SETTINGS_KEY = "briscolab:settings";

function read(): Settings {
	try {
		const saved = JSON.parse(
			localStorage.getItem(SETTINGS_KEY) ?? "{}"
		) as Partial<Settings>;
		return {
			drawing: DRAWINGS.includes(saved.drawing!) ? saved.drawing! : DEFAULTS.drawing,
			backStyle: BACK_STYLES.includes(saved.backStyle!)
				? saved.backStyle!
				: DEFAULTS.backStyle,
			theme: THEMES.includes(saved.theme!) ? saved.theme! : DEFAULTS.theme,
			sound: typeof saved.sound === "boolean" ? saved.sound : DEFAULTS.sound,
		};
	} catch {
		return DEFAULTS;
	}
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
	current ??= read();
	return current;
}

export function updateSettings(patch: Partial<Settings>) {
	current = { ...getSettings(), ...patch };
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
	} catch {
		// Blocked storage: the choice holds until the page is closed.
	}
	if (patch.theme) applyTheme(current.theme);
	for (const listener of listeners) listener();
}

/** Sets the theme on the page: `system` leaves it to `prefers-color-scheme` (globals.css). */
export function applyTheme(theme: Settings["theme"]) {
	if (theme === "system") delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;
}

export function useSettings(): Settings {
	return useSyncExternalStore(
		listener => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getSettings,
		() => DEFAULTS
	);
}

/** The script for the page's head: the saved theme, before React and before the first paint. */
export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}").theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
