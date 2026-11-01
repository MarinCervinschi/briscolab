import { useEffect, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";

import { LanguageLink } from "@/components/language-link";
import { cn } from "@/lib/cn";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * The site's top bar (DESIGN.md, "Desktop"): the wordmark, the glass "Gioca / Lab" control with the current one as
 * the inverted pill, and on the right the settings and the language. On a phone they fold into a menu.
 */
export function SiteHeader({ current }: { current: "play" | "lab" }) {
	const tab = (active: boolean) =>
		cn(
			"flex h-9 items-center rounded-full px-5 text-sm font-medium transition-colors",
			active ? "bg-text text-ground" : "text-text-soft hover:text-text"
		);
	return (
		<header className="relative flex items-center justify-between gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
			<Link to="/" className="justify-self-start text-xl font-bold tracking-tight">
				Briscolab
			</Link>
			<nav
				aria-label={m.nav_label()}
				className="glass relative hidden rounded-full p-1 sm:flex"
			>
				<Link
					to="/"
					aria-current={current === "play" ? "page" : undefined}
					className={tab(current === "play")}
				>
					{m.nav_play()}
				</Link>
				{/* The Lab is another app on the same site: a full page load. */}
				<a
					href={localizeHref("/lab")}
					aria-current={current === "lab" ? "page" : undefined}
					className={tab(current === "lab")}
				>
					{m.nav_lab()}
				</a>
			</nav>
			<div className="hidden items-center gap-2 justify-self-end sm:flex">
				<Link
					to="/settings"
					aria-label={m.home_settings()}
					className="glass relative grid size-11 shrink-0 place-items-center rounded-full"
				>
					<SettingsIcon />
				</Link>
				<LanguageLink />
			</div>
			<PhoneMenu />
		</header>
	);
}

/** The phone's menu: a button that opens every destination in a glass panel. */
function PhoneMenu() {
	const [open, setOpen] = useState(false);
	const panel = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		const onClick = (e: PointerEvent) => {
			if (!panel.current?.parentElement?.contains(e.target as Node)) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		window.addEventListener("pointerdown", onClick);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("pointerdown", onClick);
		};
	}, [open]);
	const item = "flex h-12 items-center rounded-2xl px-4 font-medium hover:bg-raised";
	return (
		<div className="sm:hidden">
			<button
				type="button"
				aria-expanded={open}
				aria-controls="site-menu"
				aria-label={m.nav_menu()}
				onClick={() => setOpen(o => !o)}
				className="glass relative grid size-11 place-items-center rounded-full"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					aria-hidden="true"
				>
					{open ? (
						<path d="M6 6l12 12M18 6L6 18" />
					) : (
						<path d="M4 7h16M4 12h16M4 17h16" />
					)}
				</svg>
			</button>
			{open && (
				<div
					ref={panel}
					id="site-menu"
					className="glass absolute top-14 right-0 left-0 z-30 flex flex-col gap-1 rounded-[24px] p-2"
				>
					<nav aria-label={m.nav_label()} className="flex flex-col gap-1">
						<Link to="/" className={item} onClick={() => setOpen(false)}>
							{m.nav_play()}
						</Link>
						<a href={localizeHref("/lab")} className={item}>
							{m.nav_lab()}
						</a>
						<Link to="/settings" className={item} onClick={() => setOpen(false)}>
							{m.home_settings()}
						</Link>
						<Link to="/credits" className={item} onClick={() => setOpen(false)}>
							{m.home_credits()}
						</Link>
					</nav>
					<div className="border-t border-white/10 px-2 pt-3 pb-1">
						<LanguageLink />
					</div>
				</div>
			)}
		</div>
	);
}

function SettingsIcon() {
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
			<circle cx="16" cy="7" r="2" />
			<circle cx="10" cy="17" r="2" />
		</svg>
	);
}
