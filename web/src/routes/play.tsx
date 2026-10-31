import { useEffect, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CardBack, CardFace } from "@/components/game/card";
import { PointsBar } from "@/components/game/points-bar";
import { ReasoningView } from "@/components/game/reasoning-view";
import { Result } from "@/components/game/result";
import type { Card, View } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { forecast } from "@/lib/game/reasoning";
import { BOT, type GameState } from "@/lib/game/runner";
import { useGame } from "@/lib/game/use-game";
import { LEVELS, parseLevel } from "@/lib/levels";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/play")({
	validateSearch: (search: Record<string, unknown>) => ({
		level: parseLevel(search.level),
		seed:
			typeof search.seed === "number" && Number.isInteger(search.seed)
				? search.seed
				: undefined,
	}),
	// The game runs in the browser only: the shell is prerendered, the table is not.
	ssr: false,
	component: Play,
});

function Play() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/play" });
	// A game without a seed gets one, written into the URL so the same deal can be played again.
	useEffect(() => {
		if (search.seed === undefined)
			void navigate({
				search: s => ({ ...s, seed: crypto.getRandomValues(new Uint32Array(1))[0] }),
				replace: true,
			});
	}, [search.seed, navigate]);
	// Playing the same deal again mounts a fresh game with the same seed.
	const [round, setRound] = useState(0);
	if (search.seed === undefined) return null;
	return (
		<Game
			key={`${search.level}-${search.seed}-${round}`}
			levelId={search.level}
			seed={search.seed}
			onAgain={() => setRound(r => r + 1)}
			onNew={() => void navigate({ search: s => ({ ...s, seed: undefined }) })}
		/>
	);
}

function Game({
	levelId,
	seed,
	onAgain,
	onNew,
}: {
	levelId: ReturnType<typeof parseLevel>;
	seed: number;
	onAgain: () => void;
	onNew: () => void;
}) {
	const level = LEVELS.find(l => l.id === levelId)!;
	const { state, runner } = useGame(level.engine, seed);
	const [revealed, setRevealed] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);
	const view = state?.view;

	// Keys 1 to 3 play the cards in hand, on desktop.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const i = Number(e.key) - 1;
			if (view && runner && i >= 0 && i < view.hand.length)
				void runner.play(view.hand[i]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [view, runner]);

	if (!state || !view || !runner) {
		return (
			<main className="text-text-soft grid min-h-dvh place-items-center px-4">
				{state?.error ? m.game_error({ message: state.error }) : m.game_loading()}
			</main>
		);
	}

	const trickNo = Math.min(view.tricks.length + (state.lastTrick ? 0 : 1), 20);
	const reasoningPanel = (
		<ReasoningView
			reasoning={state.reasoning}
			revealed={revealed}
			onReveal={() => setRevealed(true)}
		/>
	);

	return (
		<div className="flex min-h-dvh flex-col">
			<header className="lg:glass sticky top-0 z-20 flex h-16 items-center gap-3 px-4 lg:px-7">
				<a
					href="/"
					aria-label={m.game_back()}
					className="glass relative grid size-11 place-items-center rounded-full lg:hidden"
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
				</a>
				<a href="/" className="hidden text-xl font-bold tracking-tight lg:block">
					Briscolab
				</a>
				<div className="flex flex-col leading-tight lg:ml-auto lg:flex-row lg:items-baseline lg:gap-2">
					<span className="font-semibold">{level.name()}</span>
					<span className="text-text-soft text-sm">{m.game_trick({ n: trickNo })}</span>
				</div>
				<button
					type="button"
					onClick={() => setSheetOpen(true)}
					className="glass relative ml-auto h-11 rounded-full px-4 text-sm font-medium lg:hidden"
				>
					{m.game_reasoning()}
				</button>
			</header>

			<main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-4 pb-6 lg:flex-row lg:px-7">
				<section className="flex flex-1 flex-col gap-4">
					<div className="flex min-h-[460px] flex-1 gap-4 lg:min-h-[470px] lg:gap-8">
						<Bar state={state} />
						<div className="flex min-w-0 flex-1 flex-col">
							<BotHand view={view} label={level.bot} />
							<Status state={state} onSkip={() => runner.skipThinking()} />
							<div className="flex flex-1 items-center justify-between gap-4 py-4">
								<Deck view={view} />
								<TableCards view={view} state={state} />
								<Taken view={view} />
							</div>
						</div>
					</div>
					<Hand
						view={view}
						canPlay={state.phase === "player"}
						onPlay={card => void runner.play(card)}
					/>
				</section>

				<aside
					aria-label={m.reasoning_title()}
					className="bg-surface hidden w-[380px] shrink-0 flex-col gap-6 self-start rounded-[28px] p-7 lg:flex"
				>
					<h2 className="text-xl font-semibold">{m.reasoning_title()}</h2>
					{reasoningPanel}
				</aside>
			</main>

			{sheetOpen && (
				<div
					className="fixed inset-0 z-30 lg:hidden"
					onClick={() => setSheetOpen(false)}
				>
					<section
						role="dialog"
						aria-label={m.reasoning_title()}
						onClick={e => e.stopPropagation()}
						className="glass absolute inset-x-2 bottom-2 flex max-h-[75dvh] flex-col gap-5 overflow-y-auto rounded-[32px] p-5"
					>
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold">{m.reasoning_title()}</h2>
							<button
								type="button"
								aria-label={m.game_close()}
								onClick={() => setSheetOpen(false)}
								className="bg-raised grid size-11 place-items-center rounded-full"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									aria-hidden="true"
								>
									<path d="M6 6l12 12M18 6L6 18" />
								</svg>
							</button>
						</div>
						{reasoningPanel}
					</section>
				</div>
			)}

			{state.phase === "over" && (
				<Result
					view={view}
					moves={state.moves}
					seed={seed}
					onAgain={onAgain}
					onNew={onNew}
				/>
			)}
		</div>
	);
}

/** The bar shows the bot's forecast when it has one, else the points already taken. */
function Bar({ state }: { state: GameState }) {
	const expected = forecast(state.reasoning);
	const points = state.view!.points;
	return (
		<div className="flex shrink-0 py-2">
			<PointsBar
				bot={expected ?? points[BOT]}
				you={expected === null ? points[0] : 120 - expected}
				forecast={expected !== null}
			/>
		</div>
	);
}

function BotHand({ view, label }: { view: View; label: string }) {
	return (
		<div className="flex gap-2 lg:justify-center lg:gap-3">
			{Array.from({ length: view.handLens[BOT] }, (_, i) => (
				<CardBack
					key={i}
					label={label}
					className="h-[100px] w-[61px] lg:h-[158px] lg:w-[96px]"
				/>
			))}
		</div>
	);
}

function Status({ state, onSkip }: { state: GameState; onSkip: () => void }) {
	const { phase, reasoning, lastTrick } = state;
	let text = "";
	if (phase === "player") text = m.game_your_turn();
	if (phase === "bot")
		text =
			reasoning?.kind === "search"
				? m.game_bot_thinking_iterations({
						done: reasoning.iterations,
						total: reasoning.budget,
					})
				: m.game_bot_thinking();
	if (lastTrick)
		text =
			lastTrick.winner === BOT
				? m.game_bot_takes({ points: lastTrick.points })
				: m.game_you_take({ points: lastTrick.points });
	return (
		<div
			className="mt-3 flex h-9 items-center gap-3 lg:justify-center"
			aria-live="polite"
		>
			<span
				className={cn(
					"text-[15px]",
					phase === "player" ? "text-text" : "text-text-soft"
				)}
			>
				{text}
			</span>
			{phase === "bot" && (
				<button
					type="button"
					onClick={onSkip}
					className="bg-raised h-9 rounded-full px-4 text-sm font-medium"
				>
					{m.game_skip()}
				</button>
			)}
		</div>
	);
}

function Deck({ view }: { view: View }) {
	if (view.deckLen === 0) return <div className="w-[112px]" />;
	const lastCard = view.deckLen === 1;
	return (
		<div className="flex flex-col gap-2">
			<div className="relative h-[92px] w-[112px] lg:h-[140px] lg:w-[170px]">
				{/* The briscola lies sideways under the deck, until it is drawn as the last card. */}
				<span className="absolute top-0 left-[42px] h-[92px] w-[56px] rotate-90 lg:left-[64px] lg:h-[140px] lg:w-[86px]">
					<CardFace
						card={view.briscola}
						className="outline-signal h-full w-full outline-2 outline-offset-2"
					/>
				</span>
				{!lastCard && (
					<CardBack className="absolute top-0 left-0 h-[92px] w-[56px] lg:h-[140px] lg:w-[86px]" />
				)}
			</div>
			<span className="text-[15px]">
				{m
					.game_briscola({ suit: view.briscola.suit })
					.replace(/^./, c => c.toUpperCase())}
			</span>
			<span className="text-text-soft -mt-1 text-sm">
				{lastCard ? m.game_last_card() : m.game_deck({ count: view.deckLen })}
			</span>
		</div>
	);
}

/** The cards in play: the trick in progress, or the one just won until the next card. */
function TableCards({ view, state }: { view: View; state: GameState }) {
	const cards = state.lastTrick ? state.lastTrick.cards : view.table;
	const leader = state.lastTrick ? state.lastTrick.leader : view.leader;
	return (
		<div className="flex min-h-[160px] flex-1 items-center justify-center lg:min-h-[240px]">
			{cards.map((card, i) => {
				const seat = (leader + i) % 2;
				return (
					<CardFace
						key={card.index}
						card={card}
						className={cn(
							"h-[138px] w-[84px] transition-transform lg:h-[220px] lg:w-[134px]",
							seat === BOT ? "-rotate-3" : "translate-y-4 rotate-3",
							i > 0 && "-ml-8 lg:-ml-6",
							state.lastTrick &&
								state.lastTrick.winner === seat &&
								"outline-text outline-2 outline-offset-2"
						)}
					/>
				);
			})}
		</div>
	);
}

function Taken({ view }: { view: View }) {
	const count = (seat: number) => view.tricks.filter(t => t.winner === seat).length;
	return (
		<div className="hidden flex-col items-end gap-4 text-right lg:flex">
			{[BOT, 0].map(seat => (
				<span key={seat} className="text-[15px]">
					{seat === BOT ? m.game_bot() : m.game_you()}
					<br />
					<span className="text-text-soft text-sm">
						{count(seat) === 1
							? m.game_taken_one()
							: m.game_taken_many({ count: count(seat) })}
					</span>
				</span>
			))}
		</div>
	);
}

function Hand({
	view,
	canPlay,
	onPlay,
}: {
	view: View;
	canPlay: boolean;
	onPlay: (card: Card) => void;
}) {
	return (
		<div className="flex justify-center gap-2.5 lg:gap-4">
			{view.hand.map((card, i) => (
				<div key={card.index} className="flex flex-col items-center gap-2">
					<button
						type="button"
						disabled={!canPlay}
						onClick={() => onPlay(card)}
						aria-label={m.game_play_card({ card: cardName(card) })}
						className="rounded-[12px] transition-transform enabled:hover:-translate-y-2 enabled:active:scale-[0.97] disabled:opacity-90"
					>
						<CardFace
							card={card}
							className="h-[184px] w-[112px] lg:h-[220px] lg:w-[134px]"
						/>
					</button>
					<kbd className="text-text-soft hidden font-mono text-sm lg:block">
						{i + 1}
					</kbd>
				</div>
			))}
		</div>
	);
}
