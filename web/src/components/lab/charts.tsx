import { cn } from "@/lib/cn";
import {
	type Interval,
	type Run,
	decisive,
	getRun,
	ranking,
	scoreAgainst,
} from "@/lib/lab/results";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

// The Lab's charts, drawn with HTML and CSS in the site's colours (DESIGN.md) and rendered with the page: no library
// and no script, and the labels keep their size on a phone.

const NAMES: Record<string, string> = {
	random: "Random",
	greedy: "Greedy",
	hard: "Hard",
	endgame: "Endgame",
	pimc: "PIMC",
	ismcts: "ISMCTS",
};

export const botName = (bot: string) => NAMES[bot] ?? bot;

const number = (x: number, digits: number) =>
	x.toLocaleString(getLocale(), {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	});
export const count = (x: number) => x.toLocaleString(getLocale());
const pct = (x: number) => `${number(x * 100, 1)}%`;
const plusMinus = (i: Interval, scale = 100) =>
	number(((i.high - i.low) / 2) * scale, 1);

function useRun(name: string): Run {
	const run = getRun(name);
	if (!run) throw new Error(`no run named ${name} in lab/results`);
	return run;
}

// Label, plot and figure; the figure's column has a fixed width so every row's plot spans the same width.
const ROW =
	"grid grid-cols-[5rem_1fr_3rem] items-center gap-3 sm:grid-cols-[7rem_1fr_3.5rem]";
const WIDE_ROW =
	"grid grid-cols-[5rem_1fr_7rem] items-center gap-3 sm:grid-cols-[7rem_1fr_8rem]";

/** The Bradley-Terry ratings, strongest first, the champion in orange. */
export function Ratings({ run: name }: { run: string }) {
	const run = useRun(name);
	const bots = ranking(run);
	const values = bots.map(b => run.ratings[b]);
	const lo = Math.min(0, ...values);
	const span = Math.max(0, ...values) - lo;
	const at = (v: number) => ((v - lo) / span) * 100;
	return (
		<figure className="not-prose my-6">
			<div
				role="img"
				aria-label={m.lab_chart_ratings({
					list: bots.map(b => `${botName(b)} ${Math.round(run.ratings[b])}`).join(", "),
				})}
				className="flex flex-col gap-2"
			>
				{bots.map((bot, i) => {
					const v = run.ratings[bot];
					const left = Math.min(at(0), at(v));
					return (
						<div key={bot} className={ROW}>
							<span className="text-sm">{botName(bot)}</span>
							<span className="relative h-4">
								<span
									className="bg-fd-border absolute inset-y-[-4px] w-px"
									style={{ left: `${at(0)}%` }}
								/>
								<span
									className={cn(
										"absolute inset-y-0 rounded-[3px]",
										i === 0 ? "bg-signal" : "bg-data/85"
									)}
									style={{
										left: `${left}%`,
										width: `max(2px, ${Math.abs(at(v) - at(0))}%)`,
									}}
								/>
							</span>
							<span className="text-fd-muted-foreground w-12 text-right font-mono text-sm tabular-nums">
								{Math.round(v)}
							</span>
						</div>
					);
				})}
			</div>
			<figcaption className="text-fd-muted-foreground mt-3 text-sm">
				{m.lab_caption_ratings({ deals: count(run.config.deals) })}
			</figcaption>
		</figure>
	);
}

/** Every bot's score against the champion, with its 95% interval; a bar that crosses 50% is a tie. */
export function VersusChampion({ run: name }: { run: string }) {
	const run = useRun(name);
	const [champion, ...others] = ranking(run);
	const at = (s: number) => `${s * 100}%`;
	return (
		<figure className="not-prose my-6">
			<div
				role="img"
				aria-label={m.lab_chart_versus({
					champion: botName(champion),
					list: others
						.map(b => {
							const s = scoreAgainst(run, b, champion)!;
							return `${botName(b)} ${pct(s.mean)} ± ${plusMinus(s)}`;
						})
						.join(", "),
				})}
				className="flex flex-col gap-2"
			>
				{others.map(bot => {
					const s = scoreAgainst(run, bot, champion)!;
					return (
						<div key={bot} className={WIDE_ROW}>
							<span className="text-sm">{botName(bot)}</span>
							<span className="relative h-5">
								{[0.25, 0.75].map(t => (
									<span
										key={t}
										className="bg-fd-border absolute inset-y-0 w-px"
										style={{ left: at(t) }}
									/>
								))}
								<span
									className="border-signal absolute inset-y-[-4px] border-l border-dashed"
									style={{ left: at(0.5) }}
								/>
								<span
									className="bg-data absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
									style={{ left: at(s.low), width: at(s.high - s.low) }}
								/>
								<span
									className={cn(
										"border-data absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
										decisive(s) ? "bg-data" : "bg-fd-background"
									)}
									style={{ left: at(s.mean) }}
								/>
							</span>
							<span className="text-fd-muted-foreground text-right font-mono text-sm whitespace-nowrap tabular-nums">
								{pct(s.mean)} ± {plusMinus(s)}
							</span>
						</div>
					);
				})}
				<div className={WIDE_ROW}>
					<span />
					<span className="text-fd-muted-foreground relative h-4 font-mono text-xs">
						{[0, 0.5, 1].map(t => (
							<span
								key={t}
								className="absolute -translate-x-1/2"
								style={{ left: at(t) }}
							>
								{t * 100}%
							</span>
						))}
					</span>
					<span />
				</div>
			</div>
			<figcaption className="text-fd-muted-foreground mt-3 text-sm">
				{m.lab_caption_versus({ champion: botName(champion) })}
			</figcaption>
		</figure>
	);
}

/** Every pair: the row's score against the column, in blue when the row wins with an interval clear of 50%. */
export function PairMatrix({ run: name }: { run: string }) {
	const run = useRun(name);
	const bots = ranking(run);
	return (
		<figure className="not-prose my-6">
			<div className="overflow-x-auto">
				<table className="border-separate border-spacing-1 text-sm">
					<thead>
						<tr>
							<th />
							{bots.map(b => (
								<th
									key={b}
									scope="col"
									className="text-fd-muted-foreground px-1 font-medium"
								>
									{botName(b)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{bots.map(row => (
							<tr key={row}>
								<th
									scope="row"
									className="pr-2 text-left font-medium whitespace-nowrap"
								>
									{botName(row)}
								</th>
								{bots.map(col => {
									const s = row === col ? undefined : scoreAgainst(run, row, col);
									if (!s) return <td key={col} />;
									const tie = !decisive(s);
									return (
										<td
											key={col}
											className={cn(
												"rounded-md px-2 py-1.5 text-center font-mono tabular-nums",
												tie && "outline-signal outline -outline-offset-1",
												!tie && s.mean > 0.5 && "bg-data/25",
												!tie && s.mean < 0.5 && "bg-fd-muted text-fd-muted-foreground"
											)}
										>
											{number(s.mean * 100, 1)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<figcaption className="text-fd-muted-foreground mt-3 text-sm">
				{m.lab_caption_matrix()}
			</figcaption>
		</figure>
	);
}

/** The pairs of a run as numbers: score and margin with their 95% intervals. */
export function PairTable({ run: name }: { run: string }) {
	const run = useRun(name);
	return (
		<div className="not-prose my-6 overflow-x-auto">
			<table className="w-full min-w-[30rem] text-sm">
				<thead className="text-fd-muted-foreground text-left">
					<tr>
						<th className="py-2 pr-4 font-medium">{m.lab_col_pair()}</th>
						<th className="py-2 pl-4 text-right font-medium">{m.lab_col_score()}</th>
						<th className="py-2 pl-4 text-right font-medium">{m.lab_col_margin()}</th>
					</tr>
				</thead>
				<tbody>
					{run.pairs.map(p => (
						<tr key={`${p.a}-${p.b}`} className="border-fd-border border-t">
							<td className="py-2 pr-4">
								{botName(p.a)} – {botName(p.b)}
							</td>
							<td className="py-2 pl-4 text-right font-mono whitespace-nowrap">
								{pct(p.score.mean)} ± {plusMinus(p.score)}
							</td>
							<td className="py-2 pl-4 text-right font-mono whitespace-nowrap">
								{p.margin.mean > 0 ? "+" : ""}
								{number(p.margin.mean, 1)} ± {plusMinus(p.margin, 1)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
