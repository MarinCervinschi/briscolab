import { cn } from "@/lib/cn";
import { m } from "@/paraglide/messages";

const WIN = 61;
const TOTAL = 120;
// Closer than this, the forecast's figure and the "61" would print over each other.
const NEAR = 9;

/**
 * The 120-point bar (DESIGN.md, "The 120-point bar"): a thin track between the bot and the player, the points each
 * has taken filling it from their end, the 61-point notch in orange and the bot's points in a glass cursor.
 * `forecast`, when the bot has one, is a ring at the points it expects to end with. Upright beside the table on
 * desktop only; a phone shows the `Scoreboard`.
 */
export function PointsBar({
	bot,
	you,
	forecast,
	names = [m.game_you(), m.game_bot()],
}: {
	bot: number;
	you: number;
	forecast: number | null;
	/** Seat 0's and seat 1's, at the bottom and at the top. */
	names?: [string, string];
}) {
	// Every position is measured from the bot's end, the top.
	const at = (points: number) => `${(points / TOTAL) * 100}%`;
	const label = scoreLabel(bot, you, forecast);
	const winBelow = forecast !== null && forecast < WIN && WIN - forecast < NEAR;
	return (
		<>
			<div
				role="img"
				aria-label={label}
				className="relative hidden h-full w-14 flex-col gap-2 select-none lg:flex"
			>
				<span className="text-text-soft text-sm">{names[1]}</span>
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
						className={cn(
							"text-signal absolute left-5 font-mono text-xs",
							winBelow ? "translate-y-[30%]" : "-translate-y-[130%]"
						)}
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
							<span className="text-data font-mono text-xs">
								≈{Math.round(forecast)}
							</span>
						</span>
					)}
				</div>
				<span className="text-text-soft text-sm">
					{names[0]} <span className="text-text font-mono">{you}</span>
				</span>
			</div>
		</>
	);
}

function scoreLabel(bot: number, you: number, forecast: number | null) {
	return (
		m.bar_taken({ bot, you }) +
		(forecast === null ? "" : ` ${m.bar_forecast({ points: Math.round(forecast) })}`)
	);
}

/**
 * The score on a phone, where the bar would take the table's room: the two players' points in the table's corner,
 * the bot's forecast beside its points, and a figure in orange once it reaches 61.
 */
export function Scoreboard({
	bot,
	you,
	forecast,
	names = [m.game_you(), m.game_bot()],
}: {
	bot: number;
	you: number;
	forecast: number | null;
	names?: [string, string];
}) {
	const row = (name: string, points: number, colour: string, extra?: string) => (
		<span className="flex items-baseline justify-between gap-3">
			<span className="text-text-soft text-xs">{name}</span>
			<span className="flex items-baseline gap-1.5">
				{extra && <span className="text-data font-mono text-[11px]">{extra}</span>}
				<span
					className={cn(
						"font-mono text-lg leading-tight tabular-nums",
						points >= WIN ? "text-signal" : colour
					)}
				>
					{points}
				</span>
			</span>
		</span>
	);
	return (
		<div
			role="img"
			aria-label={scoreLabel(bot, you, forecast)}
			className="glass flex w-[104px] shrink-0 flex-col gap-0.5 rounded-2xl px-3 py-2 select-none"
		>
			{row(
				names[1],
				bot,
				"text-data",
				forecast === null ? undefined : `≈${Math.round(forecast)}`
			)}
			<span className="h-px bg-white/10" />
			{row(names[0], you, "text-text")}
		</div>
	);
}
