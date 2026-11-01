import { useState } from "react";

import { Link, createFileRoute } from "@tanstack/react-router";

import { BotAvatar } from "@/components/bot-avatar";
import { LanguageLink } from "@/components/language-link";
import { cn } from "@/lib/cn";
import { LEVELS, WATCH_BOTS, type WatchBot } from "@/lib/levels";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-12 px-4 py-6 sm:px-8">
			<header className="flex items-center justify-between">
				<span className="text-xl font-bold tracking-tight">Briscolab</span>
				<nav className="flex items-center gap-2">
					<a
						href={localizeHref("/lab")}
						className="hover:bg-surface flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors"
					>
						{m.home_lab()}
					</a>
					<LanguageLink />
				</nav>
			</header>
			<section className="flex flex-col gap-5 pt-12">
				<h1 className="text-6xl font-bold tracking-[-0.045em] sm:text-8xl">
					{m.home_title()}
				</h1>
				<p className="max-w-2xl text-lg leading-relaxed">{m.home_lead()}</p>
			</section>
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{LEVELS.map(level => (
					<li key={level.id}>
						<Link
							to="/play"
							search={{ level: level.id, seed: undefined }}
							className="bg-surface hover:bg-raised flex h-28 flex-col justify-between rounded-[20px] p-5 transition-colors"
						>
							<span className="flex items-start justify-between gap-2">
								<span className="text-lg font-semibold">{level.name()}</span>
								<BotAvatar bot={level.engine} className="-mt-1 -mr-1 size-10" />
							</span>
							<span className="text-text-soft font-mono text-sm">{level.bot}</span>
						</Link>
					</li>
				))}
			</ul>
			<WatchPicker />
			<footer className="text-text-soft mt-auto pt-8 text-sm">
				<Link
					to="/credits"
					className="hover:text-text underline-offset-4 hover:underline"
				>
					{m.home_credits()}
				</Link>
			</footer>
		</main>
	);
}

/** Two bots to watch against each other, then the game. */
function WatchPicker() {
	const [first, setFirst] = useState<WatchBot>("endgame");
	const [second, setSecond] = useState<WatchBot>("ismcts");
	// One column per seat, facing each other across "vs": the second mirrors the first.
	const pick = (
		id: string,
		label: string,
		value: WatchBot,
		onChange: (bot: WatchBot) => void,
		mirrored: boolean
	) => (
		<div className={cn("flex min-w-0 flex-col gap-2", mirrored && "items-end")}>
			<span id={id} className="text-text-soft text-sm">
				{label}
			</span>
			<div
				role="radiogroup"
				aria-labelledby={id}
				className="flex w-full flex-col gap-1.5"
			>
				{WATCH_BOTS.map(bot => (
					<button
						key={bot.engine}
						type="button"
						role="radio"
						aria-checked={value === bot.engine}
						onClick={() => onChange(bot.engine)}
						className={cn(
							"flex h-12 min-w-0 items-center gap-2 rounded-2xl px-1.5 font-medium transition-colors sm:gap-3 sm:px-2",
							mirrored && "flex-row-reverse text-right",
							value === bot.engine
								? "bg-raised text-text outline-text outline-2 -outline-offset-2"
								: "text-text-soft hover:bg-raised/60 hover:text-text"
						)}
					>
						<BotAvatar bot={bot.engine} className="size-8 sm:size-9" />
						<span className="truncate">{bot.name}</span>
					</button>
				))}
			</div>
		</div>
	);
	return (
		<section className="bg-surface flex flex-col gap-6 rounded-[24px] p-6">
			<div className="flex flex-col gap-2">
				<h2 className="text-2xl font-semibold">{m.home_watch_title()}</h2>
				<p className="text-text-soft max-w-2xl leading-relaxed">
					{m.home_watch_body()}
				</p>
			</div>
			<div className="grid max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
				{pick("watch-first", m.home_watch_first(), first, setFirst, false)}
				<span
					aria-hidden="true"
					className="text-signal font-mono text-lg font-semibold"
				>
					{m.watch_versus()}
				</span>
				{pick("watch-second", m.home_watch_second(), second, setSecond, true)}
			</div>
			<Link
				to="/watch"
				search={{ bots: `${first},${second}`, seed: undefined }}
				className="bg-text text-ground flex h-11 items-center justify-center self-stretch rounded-full px-6 font-semibold whitespace-nowrap transition-transform active:scale-95 sm:self-start"
			>
				{m.home_watch_go()}
			</Link>
		</section>
	);
}
