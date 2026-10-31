import { type ReactNode, useEffect, useRef } from "react";

import { motion } from "motion/react";

import type { Card, View } from "@/engine/types";
import { cardName } from "@/lib/cards";
import { cn } from "@/lib/cn";
import { BOT, type GameState, TRICK_MS } from "@/lib/game/runner";
import { m } from "@/paraglide/messages";

import { CardBack, CardFace } from "./card";
import { MovingCard, TRAVEL_S, sendToPile, usePlaces } from "./moving-card";

/** How the game opens: the bot shuffles, then deals three cards each and turns the briscola. */
export type Stage = "shuffle" | "deal" | "play";

// The player is dealt first, one card at a time, as the dealer does at the table.
const DEAL_GAP_S = 0.15;
export const BRISCOLA_DELAY_S = 6 * DEAL_GAP_S + 0.1;
export const DEAL_S = BRISCOLA_DELAY_S + TRAVEL_S;
export const SHUFFLE_S = 1.3;

function dealDelay(seat: number, i: number) {
	return (2 * i + (seat === BOT ? 1 : 0)) * DEAL_GAP_S;
}

/** After a trick the winner draws first. */
function drawDelay(view: View, seat: number) {
	return view.leader === seat ? 0 : 0.2;
}

/** The table the game is played on: a dark plate with a faint drawing grid, as on the card backs. */
export function Felt({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative isolate rounded-[32px] border border-white/[0.07] lg:rounded-[40px]",
				"bg-[radial-gradient(ellipse_at_50%_42%,color-mix(in_oklab,var(--color-data)_13%,var(--color-surface))_0%,var(--color-surface)_58%,color-mix(in_oklab,var(--color-ground)_60%,var(--color-surface))_100%)]",
				"shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_90px_rgb(0_0_0/0.45),0_30px_80px_-20px_rgb(0_0_0/0.6)]",
				className
			)}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[linear-gradient(to_right,rgb(2_151_222/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(2_151_222/0.07)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)] bg-[size:32px_32px]"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-3 -z-10 rounded-[24px] border border-[#0297de]/15 lg:inset-4 lg:rounded-[30px]"
			/>
			{children}
		</div>
	);
}

export function BotHand({
	view,
	label,
	stage,
}: {
	view: View;
	label: string;
	stage: Stage;
}) {
	const places = usePlaces();
	const row = useRef<HTMLDivElement>(null);
	useEffect(() => {
		places.botHand = [...(row.current?.children ?? [])].map(el =>
			el.getBoundingClientRect()
		);
	});
	return (
		<div ref={row} className="flex min-h-(--back-h) gap-2 lg:justify-center lg:gap-3">
			{stage !== "shuffle" &&
				Array.from({ length: view.handLens[BOT] }, (_, i) => (
					<MovingCard
						key={i}
						label={label}
						from={() => places.deck}
						delay={stage === "deal" ? dealDelay(BOT, i) : drawDelay(view, BOT)}
						className="h-(--back-h) w-[calc(var(--back-h)*0.61)]"
					/>
				))}
		</div>
	);
}

export function Status({
	state,
	stage,
	onSkip,
}: {
	state: GameState;
	stage: Stage;
	onSkip: () => void;
}) {
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
	if (stage === "shuffle") text = m.game_shuffling();
	if (stage === "deal") text = m.game_dealing();
	return (
		<div
			className="mt-3 flex h-9 items-center gap-3 lg:justify-center"
			aria-live="polite"
		>
			<span
				className={cn(
					"text-[15px]",
					phase === "player" && stage === "play" ? "text-text" : "text-text-soft"
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

const DECK_CARD = "h-(--deck-h) w-[calc(var(--deck-h)*0.61)]";

export function Deck({ view, stage }: { view: View; stage: Stage }) {
	const places = usePlaces();
	const top = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		places.deck = top.current!.getBoundingClientRect();
	});
	const empty = view.deckLen === 0;
	const lastCard = view.deckLen === 1;
	const depth = view.deckLen > 20 ? 3 : view.deckLen > 6 ? 2 : 1;
	const suit = m
		.game_briscola({ suit: view.briscola.suit })
		.replace(/^./, c => c.toUpperCase());
	return (
		<div className="flex shrink-0 flex-col gap-2">
			<div className="relative h-(--deck-h) w-[calc(var(--deck-h)*1.22)]">
				{/* The briscola lies sideways under the deck, until it is drawn as the last card. */}
				{!empty && stage !== "shuffle" && (
					<span className="absolute top-0 left-[calc(var(--deck-h)*0.46)] h-(--deck-h) w-[calc(var(--deck-h)*0.61)] rotate-90">
						<MovingCard
							card={view.briscola}
							from={() => null}
							turn={stage === "deal"}
							delay={BRISCOLA_DELAY_S}
							className="outline-signal h-full w-full rounded-[12px] outline-2 outline-offset-2"
						/>
					</span>
				)}
				{/* Once drawn, the briscola stays on the table as a faded mark, so its suit is never lost. */}
				{empty && (
					<span className="absolute top-0 left-[calc(var(--deck-h)*0.46)] h-(--deck-h) w-[calc(var(--deck-h)*0.61)] rotate-90 rounded-[14px] outline-2 outline-offset-2 outline-white/20 outline-dashed">
						<CardFace card={view.briscola} className="h-full w-full opacity-45" />
					</span>
				)}
				{stage === "shuffle" && <Riffle />}
				{stage !== "shuffle" &&
					!empty &&
					!lastCard &&
					Array.from({ length: depth }, (_, i) => (
						<CardBack
							key={i}
							className={cn(DECK_CARD, "shadow-[0_2px_6px_rgb(0_0_0/0.5)]")}
							style={{ position: "absolute", top: -i * 2, left: -i * 2 }}
						/>
					))}
				<span
					ref={top}
					aria-hidden="true"
					className={cn(DECK_CARD, "pointer-events-none absolute top-0 left-0")}
				/>
			</div>
			<span className="text-[15px]">{suit}</span>
			<span className="text-text-soft -mt-1 text-sm">
				{empty
					? m.game_deck_empty()
					: lastCard
						? m.game_last_card()
						: m.game_deck({ count: view.deckLen })}
			</span>
		</div>
	);
}

/** The shuffle: the deck splits in two halves that slide apart and fall back together, twice. */
function Riffle() {
	const half = (side: -1 | 1) => (
		<motion.span
			className="absolute top-0 left-0"
			initial={{ x: 0 }}
			animate={{ x: [0, side * 34, side * 34, 0], rotate: [0, side * 4, side * 4, 0] }}
			transition={{ duration: SHUFFLE_S / 2, repeat: 1, ease: "easeInOut" }}
		>
			{[0, 1, 2].map(i => (
				<CardBack
					key={i}
					className={cn(DECK_CARD, "shadow-[0_2px_6px_rgb(0_0_0/0.5)]")}
					style={{ position: "absolute", top: -i * 2, left: -i * 2 }}
				/>
			))}
		</motion.span>
	);
	return (
		<>
			{half(-1)}
			{half(1)}
		</>
	);
}

/** The cards in play: the trick in progress, or the one just won, which goes to the winner's pile. */
export function TableCards({ view, state }: { view: View; state: GameState }) {
	const places = usePlaces();
	const area = useRef<HTMLDivElement>(null);
	const cards = state.lastTrick ? state.lastTrick.cards : view.table;
	const leader = state.lastTrick ? state.lastTrick.leader : view.leader;
	const winner = state.lastTrick?.winner;
	useEffect(() => {
		if (winner === undefined) return;
		const timer = setTimeout(
			() => {
				for (const el of area.current?.querySelectorAll<HTMLElement>("[data-card]") ??
					[])
					sendToPile(el, places.piles[winner], winner === BOT);
			},
			TRICK_MS - TRAVEL_S * 1000 - 50
		);
		return () => clearTimeout(timer);
	}, [winner, places]);
	return (
		<div
			ref={area}
			className="flex min-h-[calc(var(--table-h)+32px)] flex-1 items-center justify-center"
		>
			{cards.map((card, i) => {
				const seat = (leader + i) % 2;
				return (
					<MovingCard
						key={card.index}
						card={card}
						turn={seat === BOT}
						from={() =>
							seat === BOT ? places.botHand.at(-1) : places.hand.get(card.index)
						}
						className={cn(
							"h-(--table-h) w-[calc(var(--table-h)*0.61)] rounded-[12px] shadow-[0_14px_30px_-8px_rgb(0_0_0/0.75),0_0_0_1px_rgb(0_0_0/0.25)]",
							seat === BOT ? "-translate-y-3 -rotate-6" : "translate-y-4 rotate-[5deg]",
							i > 0 && "-ml-[calc(var(--table-h)*0.2)]",
							winner === seat && "outline-signal outline-2 outline-offset-3"
						)}
					/>
				);
			})}
		</div>
	);
}

/** Each player's pile of won tricks, face down, with the count. */
export function Piles({ view }: { view: View }) {
	const places = usePlaces();
	return (
		<div className="hidden shrink-0 flex-col justify-between self-stretch py-2 lg:flex">
			{[BOT, 0].map(seat => {
				const count = view.tricks.filter(t => t.winner === seat).length;
				return (
					<div key={seat} className="flex flex-col items-end gap-2 text-right">
						<span
							ref={el => {
								places.piles[seat] = el;
							}}
							className="relative h-[calc(var(--deck-h)*0.6)] w-[calc(var(--deck-h)*0.6*0.61)]"
						>
							{count === 0 ? (
								<span className="absolute inset-0 rounded-[8px] border border-dashed border-white/15" />
							) : (
								Array.from({ length: Math.min(count, 3) }, (_, i) => (
									<CardBack
										key={i}
										className="h-full w-full rounded-[8px] shadow-[0_2px_6px_rgb(0_0_0/0.5)]"
										style={{
											position: "absolute",
											top: -i * 2,
											left: -i * 2,
											rotate: `${(i - 1) * 4}deg`,
										}}
									/>
								))
							)}
						</span>
						<span className="text-[15px] leading-tight">
							{seat === BOT ? m.game_bot() : m.game_you()}
							<br />
							<span className="text-text-soft text-sm">
								{count === 1 ? m.game_taken_one() : m.game_taken_many({ count })}
							</span>
						</span>
					</div>
				);
			})}
		</div>
	);
}

export function Hand({
	view,
	stage,
	canPlay,
	onPlay,
}: {
	view: View;
	stage: Stage;
	canPlay: boolean;
	onPlay: (card: Card) => void;
}) {
	const places = usePlaces();
	const buttons = useRef(new Map<number, HTMLElement>());
	useEffect(() => {
		places.hand = new Map(
			[...buttons.current].map(([index, el]) => [index, el.getBoundingClientRect()])
		);
	});
	if (stage === "shuffle") return <div className="h-(--hand-h)" />;
	return (
		<div className="relative z-10 flex justify-center gap-2.5 lg:gap-4">
			{view.hand.map((card, i) => (
				<motion.div
					layout
					transition={{ duration: 0.3 }}
					key={card.index}
					className="flex flex-col items-center gap-2"
				>
					<button
						type="button"
						ref={el => {
							if (el) buttons.current.set(card.index, el);
							else buttons.current.delete(card.index);
						}}
						disabled={!canPlay}
						onClick={() => onPlay(card)}
						aria-label={m.game_play_card({ card: cardName(card) })}
						className="group relative rounded-[12px] transition-[translate,scale] duration-200 ease-out enabled:hover:-translate-y-4 enabled:hover:scale-[1.03] enabled:focus-visible:-translate-y-4 enabled:active:scale-[0.97] disabled:cursor-default"
					>
						<MovingCard
							card={card}
							turn
							from={() => places.deck}
							delay={stage === "deal" ? dealDelay(0, i) : drawDelay(view, 0)}
							className="h-(--hand-h) w-[calc(var(--hand-h)*0.61)] rounded-[12px] shadow-[0_18px_40px_-14px_rgb(0_0_0/0.8)]"
						/>
						<span
							aria-hidden="true"
							className="border-signal pointer-events-none absolute -inset-[5px] rounded-[16px] border-2 opacity-0 shadow-[0_0_0_5px_rgb(252_115_77/0.14),0_24px_44px_-14px_rgb(252_115_77/0.6)] transition-opacity duration-200 group-enabled:group-hover:opacity-100 group-enabled:group-focus-visible:opacity-100"
						/>
					</button>
					<kbd
						className={cn(
							"hidden font-mono text-sm transition-colors lg:block",
							canPlay ? "text-text-soft" : "text-text-faint"
						)}
					>
						{i + 1}
					</kbd>
				</motion.div>
			))}
		</div>
	);
}
