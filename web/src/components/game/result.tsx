import type { Reasoning, View } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { forecast, ruleSentence } from "@/lib/game/reasoning";
import { BOT, type BotMove } from "@/lib/game/runner";
import { m } from "@/paraglide/messages";

import { CardFace } from "./card";
import { ReasoningView } from "./reasoning-view";

/** The end of a game: the score, two ways on, and every trick with the bot's reasoning behind its card. */
export function Result({
	view,
	moves,
	seed,
	onAgain,
	onNew,
}: {
	view: View;
	moves: BotMove[];
	seed: number;
	onAgain: () => void;
	onNew: () => void;
}) {
	const [you, bot] = [view.points[0], view.points[BOT]];
	const title =
		view.outcome?.winner === 0
			? m.result_win()
			: view.outcome?.winner === BOT
				? m.result_loss()
				: m.result_draw();
	return (
		<div className="bg-ground/80 fixed inset-0 z-40 overflow-y-auto backdrop-blur-sm">
			<section
				role="dialog"
				aria-labelledby="result-title"
				className="bg-surface mx-auto my-6 flex max-w-2xl flex-col gap-8 rounded-[28px] p-6 sm:my-12 sm:p-8"
			>
				<div className="flex flex-col gap-3">
					<h2 id="result-title" className="text-5xl font-bold tracking-[-0.035em]">
						{title}
					</h2>
					<p className="font-mono text-2xl">{m.result_score({ you, bot })}</p>
					<p className="text-text-soft text-sm">{m.result_seed({ seed })}</p>
				</div>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={onNew}
						className="bg-text text-ground h-11 rounded-full px-6 font-semibold transition-transform active:scale-95"
					>
						{m.result_new()}
					</button>
					<button
						type="button"
						onClick={onAgain}
						className="bg-raised h-11 rounded-full px-6 font-medium transition-transform active:scale-95"
					>
						{m.result_again()}
					</button>
				</div>

				<section className="flex flex-col gap-3">
					<h3 className="text-lg font-semibold">{m.result_replay()}</h3>
					<ol className="flex flex-col gap-2">
						{view.tricks.map((trick, i) => {
							const move = moves.find(mv => mv.trick === i);
							return (
								<li
									key={i}
									className="bg-ground/60 flex flex-col gap-3 rounded-2xl p-3"
								>
									<div className="flex items-center gap-3">
										<span className="text-text-soft w-16 text-sm">
											{m.result_trick({ n: i + 1 })}
										</span>
										{trick.cards.map((card, j) => (
											<CardFace
												key={card.index}
												card={card}
												className={cn(
													"h-14 w-9 rounded-[6px] [&_span]:hidden",
													(trick.leader + j) % 2 === trick.winner &&
														"outline-text outline-2 outline-offset-1"
												)}
											/>
										))}
										<span className="ml-auto text-right text-sm">
											{trick.winner === BOT ? m.game_bot() : m.game_you()} ·{" "}
											{trick.points}
										</span>
									</div>
									{move && (
										<details className="group">
											<summary className="text-text-soft cursor-pointer text-sm">
												{cardName(move.card)} · {summary(move.reasoning)}
											</summary>
											<div className="pt-4">
												<ReasoningView
													reasoning={move.reasoning}
													revealed
													onReveal={() => {}}
												/>
											</div>
										</details>
									)}
								</li>
							);
						})}
					</ol>
				</section>
			</section>
		</div>
	);
}

function summary(reasoning: Reasoning): string {
	if (reasoning.kind === "rule") return ruleSentence(reasoning);
	if (reasoning.kind === "random") return m.reasoning_random();
	const points = Math.round(forecast(reasoning) ?? 0);
	return reasoning.kind === "exact"
		? m.result_exact({ points })
		: m.result_forecast({ points });
}
