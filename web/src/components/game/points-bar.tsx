import { m } from "@/paraglide/messages";

const WIN = 61;
const TOTAL = 120;

/**
 * The 120-point bar (DESIGN.md, "The 120-point bar"): a thin track from the bot at the top to the player at the
 * bottom, the points each has taken filling it from their end, the 61-point notch in orange and the bot's points in
 * a glass cursor. `forecast`, when the bot has one, is a ring at the points it expects to end with.
 */
export function PointsBar({
	bot,
	you,
	forecast,
}: {
	bot: number;
	you: number;
	forecast: number | null;
}) {
	const at = (points: number) => `${(points / TOTAL) * 100}%`;
	const label =
		m.bar_taken({ bot, you }) +
		(forecast === null ? "" : ` ${m.bar_forecast({ points: Math.round(forecast) })}`);
	return (
		<div
			role="img"
			aria-label={label}
			className="relative flex h-full w-14 flex-col gap-2 select-none"
		>
			<span className="text-text-soft text-sm">{m.game_bot()}</span>
			<div className="relative mx-3.5 my-4 flex-1">
				<div className="absolute inset-y-0 left-0 w-1 rounded-full bg-[#3a4852]">
					<div
						className="bg-data absolute inset-x-0 top-0 rounded-full transition-[height] duration-300 ease-out"
						style={{ height: at(bot) }}
					/>
					<div
						className="bg-text/85 absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-300 ease-out"
						style={{ height: at(you) }}
					/>
				</div>
				<div
					className="bg-signal absolute -left-2.5 h-0.5 w-11"
					style={{ top: at(WIN) }}
				/>
				<span
					className="text-signal absolute left-5 -translate-y-[130%] font-mono text-xs"
					style={{ top: at(WIN) }}
				>
					{WIN}
				</span>
				<span
					className="glass text-data absolute -left-3.5 flex h-7 -translate-y-1/2 items-center rounded-full px-2 font-mono text-sm transition-[top] duration-300 ease-out"
					style={{ top: at(bot) }}
				>
					{bot}
				</span>
				{forecast !== null && (
					<span
						className="absolute -left-[5px] flex -translate-y-1/2 items-center gap-1.5 transition-[top] duration-300 ease-out"
						style={{ top: at(forecast) }}
					>
						<span className="border-data bg-ground size-3.5 rounded-full border-2" />
						<span className="text-data font-mono text-xs">≈{Math.round(forecast)}</span>
					</span>
				)}
			</div>
			<span className="text-text-soft text-sm">
				{m.game_you()} <span className="text-text font-mono">{you}</span>
			</span>
		</div>
	);
}
