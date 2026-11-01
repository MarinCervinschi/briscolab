import { useEffect, useRef, useState } from "react";

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { BotAvatar } from "@/components/bot-avatar";
import { PlacesContext, newPlaces, reducedMotion } from "@/components/game/moving-card";
import { PointsBar, Scoreboard } from "@/components/game/points-bar";
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
	TableCards,
} from "@/components/game/table";
import { cn } from "@/lib/cn";
import { forecast } from "@/lib/game/reasoning";
import { TRICK_MS } from "@/lib/game/runner";
import { useWatch } from "@/lib/game/use-watch";
import { SPEEDS, type WatchRunner, type WatchState } from "@/lib/game/watch";
import { type WatchBot, botLabel, parseBots } from "@/lib/levels";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/watch")({
	validateSearch: (search: Record<string, unknown>) => ({
		bots: parseBots(search.bots).join(","),
		seed:
			typeof search.seed === "number" && Number.isInteger(search.seed)
				? search.seed
				: undefined,
	}),
	// The game runs in the browser only: the shell is prerendered, the table is not.
	ssr: false,
	component: Watch,
});

function Watch() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/watch" });
	// A game without a seed gets one, written into the URL so the same deal can be watched again.
	useEffect(() => {
		if (search.seed === undefined)
			void navigate({
				search: s => ({ ...s, seed: crypto.getRandomValues(new Uint32Array(1))[0] }),
				replace: true,
			});
	}, [search.seed, navigate]);
	const [round, setRound] = useState(0);
	if (search.seed === undefined) return null;
	return (
		<Game
			key={`${search.bots}-${search.seed}-${round}`}
			bots={parseBots(search.bots)}
			seed={search.seed}
			onAgain={() => setRound(r => r + 1)}
			onNew={() => void navigate({ search: s => ({ ...s, seed: undefined }) })}
		/>
	);
}

function Game({
	bots,
	seed,
	onAgain,
	onNew,
}: {
	bots: [WatchBot, WatchBot];
	seed: number;
	onAgain: () => void;
	onNew: () => void;
}) {
	const { state, runner } = useWatch(bots, seed);
	const navigate = useNavigate();
	const [places] = useState(newPlaces);
	const [stage, setStage] = useState<Stage>(() =>
		reducedMotion() ? "play" : "shuffle"
	);
	const [revealed, setRevealed] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [pinned, setPinned] = useState<number | null>(null);
	const names: [string, string] = [botLabel(bots[0]), botLabel(bots[1])];
	const views = state?.views;

	// The opening runs once the engine has dealt: the shuffle, then the deal, then the bots play.
	const ready = views !== undefined && views !== null;
	useEffect(() => {
		if (!ready || stage === "play") return;
		const timer = setTimeout(
			() => setStage(stage === "shuffle" ? "deal" : "play"),
			(stage === "shuffle" ? SHUFFLE_S : DEAL_S) * 1000
		);
		return () => clearTimeout(timer);
	}, [ready, stage]);
	const started = useRef(false);
	useEffect(() => {
		if (ready && stage === "play" && runner && !started.current) {
			started.current = true;
			void runner.play();
		}
	}, [ready, stage, runner]);

	if (!state || !views || !runner) {
		return (
			<main className="text-text-soft grid min-h-dvh place-items-center px-4">
				{state?.error ? m.game_error({ message: state.error }) : m.game_loading()}
			</main>
		);
	}

	const [bottom, top] = views;
	const lastMover = state.moves.at(-1)?.seat ?? null;
	const shownSeat = pinned ?? state.thinking ?? lastMover ?? 0;
	// The bar measures from the top seat: a forecast by the bottom seat is turned around.
	const thinker = state.thinking ?? lastMover;
	const expected = thinker === null ? null : forecast(state.reasoning[thinker]);
	const topForecast =
		expected === null ? null : thinker === 1 ? expected : 120 - expected;
	const trickNo = Math.min(bottom.tricks.length + (state.lastTrick ? 0 : 1), 20);
	const trickMs = TRICK_MS / state.speed;

	const reasoningPanel = (
		<div className="flex flex-col gap-5">
			<div role="tablist" className="bg-raised flex rounded-full p-1">
				{names.map((name, seat) => (
					<button
						key={seat}
						type="button"
						role="tab"
						aria-selected={shownSeat === seat}
						onClick={() => setPinned(seat)}
						className={cn(
							"flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors",
							shownSeat === seat ? "bg-surface text-text" : "text-text-soft"
						)}
					>
						<BotAvatar bot={bots[seat]} className="size-7" />
						{name}
					</button>
				))}
			</div>
			<ReasoningView
				reasoning={state.reasoning[shownSeat]}
				revealed={revealed}
				onReveal={() => setRevealed(true)}
				opponent={names[1 - shownSeat]}
			/>
		</div>
	);

	return (
		<PlacesContext value={places}>
			<div className="game-sizes flex min-h-dvh flex-col">
				<header className="lg:glass sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 px-4 lg:px-7">
					<Link
						to="/"
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
					</Link>
					<Link to="/" className="hidden text-xl font-bold tracking-tight lg:block">
						Briscolab
					</Link>
					<div className="flex min-w-0 flex-col leading-tight lg:ml-auto lg:flex-row lg:items-center lg:gap-2">
						<span className="flex min-w-0 items-center gap-2 font-semibold">
							<span className="flex shrink-0 -space-x-2">
								<BotAvatar bot={bots[0]} className="size-7" />
								<BotAvatar bot={bots[1]} className="size-7" />
							</span>
							<span className="truncate">
								{m.watch_title({ first: names[0], second: names[1] })}
							</span>
						</span>
						<span className="text-text-soft text-sm">
							{m.game_trick({ n: trickNo })}
						</span>
					</div>
					<button
						type="button"
						onClick={() => setSheetOpen(true)}
						className="glass relative ml-auto h-11 shrink-0 rounded-full px-4 text-sm font-medium lg:ml-2 xl:hidden"
					>
						{m.game_reasoning()}
					</button>
					<Link
						to="/"
						className="glass relative hidden h-11 shrink-0 items-center rounded-full px-5 text-sm font-medium lg:ml-2 lg:flex"
					>
						{m.game_back()}
					</Link>
				</header>

				<main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-6 px-4 pt-3 pb-4 lg:px-7 lg:pt-6 xl:grid-cols-[minmax(0,1fr)_380px]">
					<section className="flex min-w-0 flex-col gap-3">
						<Controls
							state={state}
							runner={runner}
							revealed={revealed}
							onReveal={() => setRevealed(r => !r)}
						/>
						<div className="flex flex-1 gap-6">
							<div className="hidden shrink-0 py-2 lg:flex">
								<PointsBar
									bot={bottom.points[1]}
									you={bottom.points[0]}
									forecast={topForecast}
									names={names}
								/>
							</div>
							<Felt className="flex min-w-0 flex-1 flex-col px-3 pt-4 pb-[calc(var(--hand-h)*0.62)] lg:px-8 lg:pt-7 lg:pb-[calc(var(--hand-h)*0.42)]">
								<div className="flex items-start gap-3">
									<div className="min-w-0 flex-1">
										<BotHand
											view={bottom}
											label={names[1]}
											stage={stage}
											cards={revealed ? top.hand : undefined}
										/>
									</div>
									<div className="lg:hidden">
										<Scoreboard
											bot={bottom.points[1]}
											you={bottom.points[0]}
											forecast={topForecast}
											names={names}
										/>
									</div>
								</div>
								<Status state={state} stage={stage} names={names} />
								<div className="flex flex-1 items-center gap-3 lg:gap-6">
									<Deck view={bottom} stage={stage} />
									<TableCards
										view={bottom}
										lastTrick={state.lastTrick}
										turnSeats={revealed ? [] : [0, 1]}
										trickMs={trickMs}
									/>
									<Piles view={bottom} names={names} />
								</div>
							</Felt>
						</div>
						<div className="-mt-[calc(var(--hand-h)*0.36)] flex gap-6">
							<div className="hidden w-14 shrink-0 lg:block" />
							<div className="min-w-0 flex-1">
								<Hand
									view={bottom}
									stage={stage}
									canPlay={false}
									faceDown={!revealed}
								/>
							</div>
						</div>
					</section>

					<aside
						aria-label={m.reasoning_title()}
						className="bg-surface sticky top-22 hidden max-h-[calc(100dvh-7rem)] flex-col gap-6 self-start overflow-y-auto overscroll-contain rounded-[28px] p-7 xl:flex"
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

				{state.phase === "over" && (
					<Result
						view={bottom}
						moves={state.moves}
						seed={seed}
						names={names}
						onAgain={onAgain}
						onNew={onNew}
						onHome={() => void navigate({ to: "/" })}
					/>
				)}
			</div>
		</PlacesContext>
	);
}

/** Pause and resume, one card at a time while paused, the speed, and whether the hands are shown. */
function Controls({
	state,
	runner,
	revealed,
	onReveal,
}: {
	state: WatchState;
	runner: WatchRunner;
	revealed: boolean;
	onReveal: () => void;
}) {
	const button =
		"bg-raised h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors";
	return (
		<div className="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onClick={() => (state.paused ? runner.resume() : runner.pause())}
				className={cn(button, state.paused && "bg-text text-ground")}
			>
				{state.paused ? m.watch_resume() : m.watch_pause()}
			</button>
			<button
				type="button"
				onClick={() => runner.step()}
				disabled={!state.paused}
				className={cn(button, "disabled:opacity-40")}
			>
				{m.watch_step()}
			</button>
			<div
				role="radiogroup"
				aria-label={m.watch_speed()}
				className="bg-raised flex h-10 rounded-full p-1"
			>
				{SPEEDS.map(speed => (
					<button
						key={speed}
						type="button"
						role="radio"
						aria-checked={state.speed === speed}
						onClick={() => runner.setSpeed(speed)}
						className={cn(
							"rounded-full px-3 font-mono text-sm transition-colors",
							state.speed === speed ? "bg-surface text-text" : "text-text-soft"
						)}
					>
						{speed}×
					</button>
				))}
			</div>
			<button
				type="button"
				onClick={onReveal}
				aria-pressed={revealed}
				className={button}
			>
				{revealed ? m.watch_hide() : m.watch_reveal()}
			</button>
		</div>
	);
}

function Status({
	state,
	stage,
	names,
}: {
	state: WatchState;
	stage: Stage;
	names: [string, string];
}) {
	const { thinking, reasoning, lastTrick, paused } = state;
	let text = "";
	if (thinking !== null) {
		const r = reasoning[thinking];
		text =
			r?.kind === "search" && r.iterations < r.budget
				? m.watch_thinking_iterations({
						bot: names[thinking],
						done: r.iterations,
						total: r.budget,
					})
				: m.watch_thinking({ bot: names[thinking] });
	} else if (paused) text = m.watch_paused();
	if (lastTrick)
		text = m.watch_takes({ bot: names[lastTrick.winner], points: lastTrick.points });
	if (stage === "shuffle") text = m.watch_shuffling();
	if (stage === "deal") text = m.watch_dealing();
	return (
		<div className="mt-3 flex h-9 items-center lg:justify-center" aria-live="polite">
			<span className="text-text-soft text-[15px]">{text}</span>
		</div>
	);
}
