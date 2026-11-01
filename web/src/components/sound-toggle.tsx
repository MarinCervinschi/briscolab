import { cn } from "@/lib/cn";
import { updateSettings, useSettings } from "@/lib/settings";
import { m } from "@/paraglide/messages";

/** The sound setting at hand during a game: the same switch as in the settings. */
export function SoundToggle({ className }: { className?: string }) {
	const { sound } = useSettings();
	return (
		<button
			type="button"
			aria-pressed={sound}
			aria-label={sound ? m.sound_off() : m.sound_on()}
			onClick={() => updateSettings({ sound: !sound })}
			className={cn(
				"glass relative grid size-11 shrink-0 place-items-center rounded-full",
				!sound && "text-text-soft",
				className
			)}
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M11 5 6 9H2v6h4l5 4V5Z" />
				{sound ? (
					<path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
				) : (
					<path d="m22 9-6 6M16 9l6 6" />
				)}
			</svg>
		</button>
	);
}
