import { useEffect, useState } from "react";

import { animate } from "motion";
import { motion } from "motion/react";

import type { Reasoning, View } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { forecast, mostLikely, ruleSentence } from "@/lib/game/reasoning";
import { BOT, type BotMove } from "@/lib/game/runner";
import { m } from "@/paraglide/messages";

import { CardFace } from "./card";
import { reducedMotion } from "./moving-card";
import { ReasoningView } from "./reasoning-view";

/**
 * The end of a game: the outcome, the score, three ways on, and every trick with the reasoning behind the bots'
 * cards. With `names` the game was two bots, seat 0 and seat 1, and nobody is "you".
 */
export function Result({
	view,
	moves,
	seed,
	names,
	onAgain,
	onNew,
	onHome,
}: {
	view: View;
	moves: (BotMove & { seat?: number })[];
	seed: number;
	names?: [string, string];
	onAgain: () => void;
	onNew: () => void;
	onHome: () => void;
}) {
	const [you, bot] = [view.points[0], view.points[BOT]];
	const [replayOpen, setReplayOpen] = useState(false);
	const winner = view.outcome?.winner ?? null;
	const seatName = (seat: number) =>
		names ? names[seat] : seat === BOT ? m.game_bot() : m.game_you();
	const title = names
		? winner === null
			? m.result_draw()
			: m.result_watch_win({ bot: names[winner] })
		: winner === 0
			? m.result_win()
			: winner === BOT
				? m.result_loss()
				: m.result_draw();
	const margin =
		winner === null
			? m.result_margin_draw()
			: names
				? m.result_watch_margin({ points: Math.abs(you - bot) })
				: winner === 0
					? m.result_margin_win({ points: you - bot })
					: m.result_margin_loss({ points: 61 - you });
	const tricks = (seat: number) => view.tricks.filter(t => t.winner === seat).length;
	return (
		<div className="bg-ground/80 fixed inset-0 z-40 overflow-y-auto backdrop-blur-sm">
			<motion.section
				role="dialog"
				aria-modal="true"
				aria-labelledby="result-title"
				initial={{ opacity: 0, y: 28, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
				className="bg-surface mx-auto my-4 flex max-w-3xl flex-col overflow-hidden rounded-[32px] sm:my-10"
			>
				<div
					className={cn(
						"relative flex flex-col gap-7 p-6 sm:p-10",
						winner === 0 &&
							"bg-[radial-gradient(ellipse_at_85%_0%,rgb(252_115_77/0.28),transparent_60%)]",
						winner === BOT &&
							"bg-[radial-gradient(ellipse_at_85%_0%,rgb(2_151_222/0.26),transparent_60%)]"
					)}
				>
					<div className="flex items-end justify-between gap-6">
						<div className="flex flex-col gap-3">
							<h2
								id="result-title"
								className={cn(
									"text-5xl font-bold tracking-[-0.045em] sm:text-6xl",
									winner === 0 && "text-signal",
									winner === BOT && "text-data"
								)}
							>
								{title}
							</h2>
							<p className="text-text-soft text-lg">{margin}</p>
						</div>
						{winner !== null && <Trophy view={view} winner={winner} />}
					</div>

					<Score you={you} bot={bot} names={[seatName(0), seatName(BOT)]} />

					<p className="text-text-soft text-sm">
						{names
							? m.result_watch_tricks({
									first: names[0],
									firstCount: tricks(0),
									second: names[1],
									secondCount: tricks(BOT),
								})
							: m.result_tricks({ you: tricks(0), bot: tricks(BOT) })}{" "}
						· {m.result_seed({ seed })}
					</p>
					{view.tricks.length < 20 && (
						<p className="text-text-soft -mt-4 text-sm">
							{m.result_decided({ n: view.tricks.length })}
						</p>
					)}

					<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
						<button
							type="button"
							autoFocus
							onClick={onNew}
							className="bg-text text-ground h-12 rounded-full px-6 font-semibold transition-transform active:scale-95"
						>
							{m.result_new()}
						</button>
						<button
							type="button"
							onClick={onAgain}
							className="bg-raised h-12 rounded-full px-6 font-medium transition-transform active:scale-95"
						>
							{m.result_again()}
						</button>
						<button
							type="button"
							onClick={onHome}
							className="text-text-soft hover:text-text h-12 rounded-full px-4 font-medium transition-colors"
						>
							{m.result_home()}
						</button>
					</div>
				</div>

				<div className="flex flex-col gap-10 px-6 pb-6 sm:px-10 sm:pb-8">
					<section className="flex flex-col gap-3">
						<h3>
							<button
								type="button"
								aria-expanded={replayOpen}
								aria-controls="replay"
								onClick={() => setReplayOpen(o => !o)}
								className="bg-raised flex h-12 w-full items-center justify-between rounded-2xl px-5 text-left font-semibold"
							>
								{m.result_replay()}
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
									className={cn(
										"transition-transform duration-200",
										replayOpen && "rotate-180"
									)}
								>
									<path d="M6 9l6 6 6-6" />
								</svg>
							</button>
						</h3>
						<ol id="replay" hidden={!replayOpen} className="flex flex-col gap-2">
							{view.tricks.map((trick, i) => {
								const played = moves.filter(mv => mv.trick === i);
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
												{seatName(trick.winner)} · {trick.points}
											</span>
										</div>
										{played.map(move => (
											<details key={move.card.index} className="group">
												<summary className="text-text-soft cursor-pointer text-sm">
													{names && move.seat !== undefined && `${names[move.seat]} · `}
													{cardName(move.card)} · {summary(move.reasoning)}
												</summary>
												<div className="pt-4">
													<ReasoningView
														reasoning={move.reasoning}
														revealed
														opponent={
															names && move.seat !== undefined
																? names[1 - move.seat]
																: undefined
														}
													/>
												</div>
											</details>
										))}
									</li>
								);
							})}
						</ol>
					</section>
				</div>
			</motion.section>
		</div>
	);
}

/** The final score counting up, over the 120-point track with its 61-point notch. */
function Score({
	you,
	bot,
	names,
}: {
	you: number;
	bot: number;
	names: [string, string];
}) {
	const [shown, setShown] = useState(reducedMotion() ? 1 : 0);
	useEffect(() => {
		if (reducedMotion()) return;
		const controls = animate(0, 1, {
			duration: 1.1,
			delay: 0.25,
			ease: [0.22, 1, 0.36, 1],
			onUpdate: setShown,
		});
		return () => controls.stop();
	}, []);
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-end justify-between font-mono">
				<span className="flex flex-col">
					<span className="text-text-soft font-sans text-sm">{names[0]}</span>
					<span className="text-5xl tabular-nums sm:text-6xl">
						{Math.round(you * shown)}
					</span>
				</span>
				<span className="flex flex-col items-end">
					<span className="text-text-soft font-sans text-sm">{names[1]}</span>
					<span className="text-data text-5xl tabular-nums sm:text-6xl">
						{Math.round(bot * shown)}
					</span>
				</span>
			</div>
			<div className="relative h-2">
				<div className="bg-raised absolute inset-0 rounded-full" />
				<div
					className="bg-text absolute inset-y-0 left-0 rounded-full"
					style={{ width: `${((you * shown) / 120) * 100}%` }}
				/>
				<div
					className="bg-data absolute inset-y-0 right-0 rounded-full"
					style={{ width: `${((bot * shown) / 120) * 100}%` }}
				/>
				<div
					className="bg-signal absolute -inset-y-1.5 w-0.5"
					style={{ left: `${(61 / 120) * 100}%` }}
				/>
			</div>
		</div>
	);
}

/** The winner's richest cards, fanned out in the corner. */
function Trophy({ view, winner }: { view: View; winner: number }) {
	const cards = view.tricks
		.filter(t => t.winner === winner)
		.flatMap(t => t.cards)
		.filter(c => c.points > 0)
		.sort((a, b) => b.points - a.points)
		.slice(0, 5);
	const mid = (cards.length - 1) / 2;
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none relative hidden h-36 w-48 shrink-0 sm:block"
		>
			{cards.map((card, i) => (
				<motion.span
					key={card.index}
					className="absolute bottom-0 left-1/2 -ml-[42px] block origin-bottom"
					initial={{ rotate: 0, y: 40, opacity: 0 }}
					animate={{ rotate: (i - mid) * 11, y: 0, opacity: 1 }}
					transition={{
						type: "spring",
						bounce: 0.35,
						duration: 0.8,
						delay: 0.3 + i * 0.07,
					}}
				>
					<CardFace
						card={card}
						className="h-[138px] w-[84px] shadow-[0_14px_30px_-8px_rgb(0_0_0/0.7)]"
					/>
				</motion.span>
			))}
		</div>
	);
}

function summary(reasoning: Reasoning): string {
	if (reasoning.kind === "rule") return ruleSentence(reasoning);
	if (reasoning.kind === "random") return m.reasoning_random();
	if (reasoning.kind === "network")
		return m.result_network({
			percent: Math.round(mostLikely(reasoning).probability * 100),
		});
	const points = Math.round(forecast(reasoning) ?? 0);
	return reasoning.kind === "exact"
		? m.result_exact({ points })
		: m.result_forecast({ points });
}
