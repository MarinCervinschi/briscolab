import type { Reasoning } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { forecast, mostVisited, ruleSentence } from "@/lib/game/reasoning";
import { m } from "@/paraglide/messages";

import { CardFace } from "./card";

/**
 * What the bot is thinking or thought (DESIGN.md, "The bot's reasoning"). The parts that show the bot's own
 * cards are blurred until `revealed`.
 */
export function ReasoningView({
	reasoning,
	revealed,
	onReveal,
	opponent,
}: {
	reasoning: Reasoning | null;
	revealed: boolean;
	onReveal: () => void;
	/** Whose cards the bot imagines, when it is not the person watching: another bot. */
	opponent?: string;
}) {
	if (!reasoning) return <p className="text-text-soft">{m.reasoning_none()}</p>;
	if (reasoning.kind === "random")
		return <p className="text-text-soft">{m.reasoning_random()}</p>;
	if (reasoning.kind === "rule")
		return <p className="text-lg leading-snug">{ruleSentence(reasoning)}</p>;

	const expected = forecast(reasoning);
	const pick =
		reasoning.kind === "search"
			? mostVisited(reasoning)?.card.index
			: reasoning.results.reduce((a, b) => (b.points > a.points ? b : a)).card.index;
	const rows =
		reasoning.kind === "search"
			? reasoning.cards.map(c => ({
					card: c.card,
					points: c.expectedPoints,
					detail: m.reasoning_visits({ visits: c.visits }),
				}))
			: reasoning.results.map(r => ({ card: r.card, points: r.points, detail: "" }));

	return (
		<div className="flex flex-col gap-7">
			<div className="grid grid-cols-2 gap-4">
				{expected !== null && (
					<Figure
						value={Math.round(expected)}
						caption={m.reasoning_forecast()}
						className="text-data"
					/>
				)}
				{reasoning.kind === "search" && (
					<Figure
						value={reasoning.iterations}
						caption={m.reasoning_iterations({ total: reasoning.budget })}
					/>
				)}
			</div>

			{reasoning.kind === "exact" && (
				<p className="text-text-soft leading-relaxed">{m.reasoning_exact()}</p>
			)}

			{reasoning.kind === "search" && reasoning.hypotheses.length > 0 && (
				<section className="flex flex-col gap-2">
					<h3 className="text-[15px] font-semibold">
						{opponent
							? m.reasoning_hypotheses_of({ name: opponent })
							: m.reasoning_hypotheses()}
					</h3>
					<ul className="flex flex-col gap-1">
						{reasoning.hypotheses.slice(0, 3).map((h, i) => (
							<li
								key={h.iteration}
								className={cn(
									"flex items-center gap-1.5 rounded-2xl p-1.5 pr-3",
									i === 0 ? "bg-raised" : "text-text-soft"
								)}
							>
								{h.hand.map(card => (
									<CardFace
										key={card.index}
										card={card}
										className="h-14 w-9 rounded-[6px] [&_span]:hidden"
									/>
								))}
								<span className="ml-2 text-sm">
									{m.reasoning_hypothesis({ n: h.iteration })}
								</span>
								<span className="ml-auto font-mono">{h.points}</span>
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="relative flex flex-col gap-3">
				<h3 className="text-[15px] font-semibold">
					{reasoning.kind === "search"
						? m.reasoning_cards()
						: m.reasoning_exact_cards()}
				</h3>
				<ul
					aria-hidden={!revealed}
					className={cn(
						"flex flex-col gap-3.5 transition-[filter]",
						!revealed && "blur-md"
					)}
				>
					{rows.map(row => (
						<li key={row.card.index} className="flex items-center gap-3">
							<CardFace
								card={row.card}
								className="h-15 w-9.5 shrink-0 rounded-[6px] [&_span]:hidden"
							/>
							<div className="flex flex-1 flex-col gap-2">
								<div className="flex items-baseline justify-between text-[15px]">
									<span className={cn(row.card.index === pick && "text-signal")}>
										{cardName(row.card)}
										{row.card.index === pick && ` · ${m.reasoning_picks()}`}
									</span>
									<span className="text-text-soft font-mono text-sm">
										{m.reasoning_points({ points: Math.round(row.points) })}
										{row.detail && ` · ${row.detail}`}
									</span>
								</div>
								<div className="bg-raised relative h-2 rounded-full">
									<div
										className={cn(
											"bg-data absolute inset-y-0 left-0 rounded-full",
											row.card.index !== pick && "opacity-55"
										)}
										style={{ width: `${(row.points / 120) * 100}%` }}
									/>
									<div
										className="bg-signal absolute -top-1 h-4 w-0.5"
										style={{ left: `${(61 / 120) * 100}%` }}
									/>
								</div>
							</div>
						</li>
					))}
				</ul>
				{!revealed && (
					<div className="absolute inset-x-0 top-9 bottom-0 flex items-center justify-center">
						<button
							type="button"
							onClick={onReveal}
							className="bg-text text-ground h-10 rounded-full px-5 text-[15px] font-semibold transition-transform active:scale-95"
						>
							{m.reasoning_reveal()}
						</button>
					</div>
				)}
			</section>
		</div>
	);
}

function Figure({
	value,
	caption,
	className,
}: {
	value: number;
	caption: string;
	className?: string;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className={cn("font-mono text-[44px] leading-none", className)}>
				{value}
			</span>
			<span className="text-text-soft text-sm">{caption}</span>
		</div>
	);
}
