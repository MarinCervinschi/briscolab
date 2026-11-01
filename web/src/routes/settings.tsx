import type { ReactNode } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";

import { CardBack } from "@/components/game/card";
import { Switch } from "@/components/switch";
import { cn } from "@/lib/cn";
import {
	BACK_STYLES,
	DRAWINGS,
	type Settings as SettingsShape,
	THEMES,
	updateSettings,
	useSettings,
} from "@/lib/settings";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/settings")({
	// The choices live in this browser, so the page renders there.
	ssr: false,
	component: Settings,
});

const DRAWING_NAMES: Record<SettingsShape["drawing"], () => string> = {
	tree: m.drawing_tree,
	montecarlo: m.drawing_montecarlo,
	net: m.drawing_net,
};
const STYLE_NAMES: Record<SettingsShape["backStyle"], () => string> = {
	tavola: m.style_tavola,
	quaderno: m.style_quaderno,
	vetrino: m.style_vetrino,
};
const THEME_NAMES: Record<SettingsShape["theme"], () => string> = {
	system: m.theme_system,
	light: m.theme_light,
	dark: m.theme_dark,
};

function Settings() {
	const settings = useSettings();
	return (
		<main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-12 px-4 py-6 sm:px-8">
			<header className="flex items-center gap-3">
				<Link
					to="/"
					aria-label={m.game_back()}
					className="glass relative grid size-11 shrink-0 place-items-center rounded-full"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<path d="M15 18l-6-6 6-6" />
					</svg>
				</Link>
				<Link to="/" className="text-xl font-bold tracking-tight">
					Briscolab
				</Link>
			</header>
			<div className="flex flex-col gap-3">
				<h1 className="text-5xl font-bold tracking-[-0.045em] sm:text-6xl">
					{m.settings_title()}
				</h1>
				<p className="text-text-soft">{m.settings_note()}</p>
			</div>

			<section className="flex flex-col gap-6">
				<h2 className="text-2xl font-semibold">{m.settings_back()}</h2>
				<Choices
					label={m.settings_drawing()}
					options={DRAWINGS}
					value={settings.drawing}
					onChange={drawing => updateSettings({ drawing })}
					render={drawing => (
						<>
							<CardBack drawing={drawing} className="h-[123px] w-[75px]" />
							{DRAWING_NAMES[drawing]()}
						</>
					)}
				/>
				<Choices
					label={m.settings_style()}
					options={BACK_STYLES}
					value={settings.backStyle}
					onChange={backStyle => updateSettings({ backStyle })}
					render={backStyle => (
						<>
							<CardBack backStyle={backStyle} className="h-[123px] w-[75px]" />
							{STYLE_NAMES[backStyle]()}
						</>
					)}
				/>
			</section>

			<section className="flex flex-col gap-4">
				<h2 className="text-2xl font-semibold">{m.settings_theme()}</h2>
				<div
					role="radiogroup"
					aria-label={m.settings_theme()}
					className="bg-raised grid grid-cols-3 rounded-full p-1"
				>
					{THEMES.map(theme => (
						<button
							key={theme}
							type="button"
							role="radio"
							aria-checked={settings.theme === theme}
							onClick={() => updateSettings({ theme })}
							className={cn(
								"h-10 min-w-0 rounded-full px-2 text-sm font-medium transition-colors",
								settings.theme === theme
									? "bg-text text-ground"
									: "text-text-soft hover:text-text"
							)}
						>
							{THEME_NAMES[theme]()}
						</button>
					))}
				</div>
			</section>
			<section className="flex items-start justify-between gap-6">
				<div className="flex flex-col gap-2">
					<h2 id="sound" className="text-2xl font-semibold">
						{m.settings_sound()}
					</h2>
					<p className="text-text-soft max-w-xl leading-relaxed">
						{m.settings_sound_body()}
					</p>
				</div>
				<Switch
					checked={settings.sound}
					onChange={sound => updateSettings({ sound })}
					labelledBy="sound"
					className="mt-1"
				/>
			</section>
		</main>
	);
}

/** Pictured options, one of which is chosen. */
function Choices<T extends string>({
	label,
	options,
	value,
	onChange,
	render,
}: {
	label: string;
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
	render: (option: T) => ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<span className="text-text-soft text-sm">{label}</span>
			<div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
				{options.map(option => (
					<button
						key={option}
						type="button"
						role="radio"
						aria-checked={value === option}
						onClick={() => onChange(option)}
						className={cn(
							"flex w-[104px] flex-col items-center gap-2 rounded-2xl p-3 text-sm font-medium transition-colors",
							value === option
								? "bg-raised text-text ring-text ring-2 ring-inset"
								: "text-text-soft hover:bg-raised/60 hover:text-text"
						)}
					>
						{render(option)}
					</button>
				))}
			</div>
		</div>
	);
}
