import { useEffect } from "react";

import { m } from "@/paraglide/messages";

/** Asks before leaving a game in progress: nothing of it is kept. */
export function AbandonDialog({
	onStay,
	onLeave,
}: {
	onStay: () => void;
	onLeave: () => void;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onStay();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onStay]);
	return (
		<div
			className="bg-ground/70 fixed inset-0 z-40 grid place-items-center p-4 backdrop-blur-sm"
			onClick={onStay}
		>
			<section
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="abandon-title"
				aria-describedby="abandon-body"
				onClick={e => e.stopPropagation()}
				className="bg-surface flex w-full max-w-md flex-col gap-4 rounded-[28px] p-6 sm:p-7"
			>
				<h2 id="abandon-title" className="text-2xl font-semibold">
					{m.game_abandon_title()}
				</h2>
				<p id="abandon-body" className="text-text-soft leading-relaxed">
					{m.game_abandon_body()}
				</p>
				<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						autoFocus
						onClick={onStay}
						className="bg-raised h-11 rounded-full px-5 font-medium whitespace-nowrap transition-transform active:scale-95"
					>
						{m.game_keep_playing()}
					</button>
					<button
						type="button"
						onClick={onLeave}
						className="bg-signal text-ground h-11 rounded-full px-5 font-semibold whitespace-nowrap transition-transform active:scale-95"
					>
						{m.game_abandon()}
					</button>
				</div>
			</section>
		</div>
	);
}
