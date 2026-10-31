import { useEffect, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AbandonDialog } from "@/components/game/abandon-dialog";
import { PlacesContext, newPlaces, reducedMotion } from "@/components/game/moving-card";
import { PointsBar } from "@/components/game/points-bar";
import { ReasoningView } from "@/components/game/reasoning-view";
import { Result } from "@/components/game/result";
import {
	BotHand,
	DEAL_S,
	Deck,
	Felt,
	Hand,
	Piles,
	SHUFFLE_S,
	type Stage,
	Status,
	TableCards,
} from "@/components/game/table";
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
	const navigate = useNavigate();
	const [places] = useState(newPlaces);
	const [stage, setStage] = useState<Stage>(() =>
		reducedMotion() ? "play" : "shuffle"
	);
	const [revealed, setRevealed] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [leaving, setLeaving] = useState(false);
	const view = state?.view;
	const canPlay = state?.phase === "player" && stage === "play";

	// The opening runs once the engine has dealt: the shuffle, then the deal.
	const ready = view !== undefined && view !== null;
	useEffect(() => {
		if (!ready || stage === "play") return;
		const next = stage === "shuffle" ? "deal" : "play";
		const timer = setTimeout(
			() => setStage(next),
			(stage === "shuffle" ? SHUFFLE_S : DEAL_S) * 1000
		);
		return () => clearTimeout(timer);
	}, [ready, stage]);

	// Keys 1 to 3 play the cards in hand, on desktop.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const i = Number(e.key) - 1;
			if (canPlay && view && runner && i >= 0 && i < view.hand.length)
				void runner.play(view.hand[i]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canPlay, view, runner]);

	if (!state || !view || !runner) {
		return (
			<main className="text-text-soft grid min-h-dvh place-items-center px-4">
				{state?.error ? m.game_error({ message: state.error }) : m.game_loading()}
			</main>
		);
	}

	const home = () => void navigate({ to: "/" });
	const leave = () => (state.phase === "over" ? home() : setLeaving(true));
	const trickNo = Math.min(view.tricks.length + (state.lastTrick ? 0 : 1), 20);
	const reasoningPanel = (
		<ReasoningView
			reasoning={state.reasoning}
			revealed={revealed}
			onReveal={() => setRevealed(true)}
		/>
	);

	return (
		<PlacesContext value={places}>
			<div className="game-sizes flex min-h-dvh flex-col">
				<header className="lg:glass sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 px-4 lg:px-7">
					<button
						type="button"
						onClick={leave}
						aria-label={m.game_abandon()}
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
					</button>
					<span className="hidden text-xl font-bold tracking-tight lg:block">
						Briscolab
					</span>
					<div className="flex flex-col leading-tight lg:ml-auto lg:flex-row lg:items-baseline lg:gap-2">
						<span className="font-semibold">{level.name()}</span>
						<span className="text-text-soft text-sm">
							{m.game_trick({ n: trickNo })}
						</span>
					</div>
					<button
						type="button"
						onClick={() => setSheetOpen(true)}
						className="glass relative ml-auto h-11 rounded-full px-4 text-sm font-medium lg:ml-2 xl:hidden"
					>
						{m.game_reasoning()}
					</button>
					<button
						type="button"
						onClick={leave}
						className="glass relative hidden h-11 rounded-full px-5 text-sm font-medium lg:ml-2 lg:block"
					>
						{m.game_abandon()}
					</button>
				</header>

				<main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 pt-3 pb-4 lg:px-7 lg:pt-6 xl:grid-cols-[minmax(0,1fr)_380px]">
					<section className="flex min-w-0 flex-col">
						<div className="flex flex-1 gap-3 lg:gap-6">
							<Bar state={state} />
							<Felt className="flex min-w-0 flex-1 flex-col px-3 pt-4 pb-[calc(var(--hand-h)*0.42)] lg:px-8 lg:pt-7">
								<BotHand view={view} label={level.bot} stage={stage} />
								<Status
									state={state}
									stage={stage}
									onSkip={() => runner.skipThinking()}
								/>
								<div className="flex flex-1 items-center gap-3 lg:gap-6">
									<Deck view={view} stage={stage} />
									<TableCards view={view} state={state} />
									<Piles view={view} />
								</div>
							</Felt>
						</div>
						<div className="-mt-[calc(var(--hand-h)*0.36)] flex gap-3 lg:gap-6">
							<div className="hidden w-14 shrink-0 lg:block" />
							<div className="min-w-0 flex-1">
								<Hand
									view={view}
									stage={stage}
									canPlay={canPlay}
									onPlay={card => void runner.play(card)}
								/>
							</div>
						</div>
					</section>

					<aside
						aria-label={m.reasoning_title()}
						className="bg-surface sticky top-22 hidden flex-col gap-6 self-start rounded-[28px] p-7 xl:flex"
					>
						<h2 className="text-xl font-semibold">{m.reasoning_title()}</h2>
						{reasoningPanel}
					</aside>
				</main>

				{sheetOpen && (
					<div
						className="fixed inset-0 z-30 xl:hidden"
						onClick={() => setSheetOpen(false)}
					>
						<section
							role="dialog"
							aria-label={m.reasoning_title()}
							onClick={e => e.stopPropagation()}
							className="glass absolute inset-x-2 bottom-2 flex max-h-[75dvh] flex-col gap-5 overflow-y-auto rounded-[32px] p-5 sm:right-2 sm:left-auto sm:w-[420px]"
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

				{leaving && <AbandonDialog onStay={() => setLeaving(false)} onLeave={home} />}

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
		</PlacesContext>
	);
}

/** The bar shows the bot's forecast when it has one, else the points already taken. */
function Bar({ state }: { state: GameState }) {
	const expected = forecast(state.reasoning);
	const points = state.view!.points;
	return (
		<div className="flex shrink-0 pt-2 pb-[calc(var(--hand-h)*0.42)] lg:pb-2">
			<PointsBar
				bot={expected ?? points[BOT]}
				you={expected === null ? points[0] : 120 - expected}
				forecast={expected !== null}
			/>
		</div>
	);
}
