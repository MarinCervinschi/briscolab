import { m } from "@/paraglide/messages";

const WIN = 61;
const TOTAL = 120;

/**
 * The 120-point bar (DESIGN.md, "The 120-point bar"): a thin track from the bot at the top to the player at the
 * bottom, the bot's share in blue from the top, the player's in white from the bottom, the 61-point notch in orange
 * and the bot's figure in a glass cursor.
 * `forecast` says whether the figures are the bot's forecast or the points already taken.
 */
export function PointsBar({
	bot,
	you,
	forecast,
}: {
	bot: number;
	you: number;
	forecast: boolean;
}) {
	const share = `${(bot / TOTAL) * 100}%`;
	const yours = `${(you / TOTAL) * 100}%`;
	const win = `${(WIN / TOTAL) * 100}%`;
	const label = forecast ? m.bar_forecast({ bot, you }) : m.bar_taken({ bot, you });
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
						style={{ height: share }}
					/>
					<div
						className="bg-text/85 absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-300 ease-out"
						style={{ height: yours }}
					/>
				</div>
				<div className="bg-signal absolute -left-2.5 h-0.5 w-11" style={{ top: win }} />
				<span
					className="text-signal absolute left-5 -translate-y-[130%] font-mono text-xs"
					style={{ top: win }}
				>
					{WIN}
				</span>
				<span
					className="glass text-data absolute -left-3.5 flex h-7 -translate-y-1/2 items-center rounded-full px-2 font-mono text-sm transition-[top] duration-300 ease-out"
					style={{ top: share }}
				>
					{Math.round(bot)}
				</span>
			</div>
			<span className="text-text-soft text-sm">
				{m.game_you()} <span className="text-text font-mono">{Math.round(you)}</span>
			</span>
		</div>
	);
}
