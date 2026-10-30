import { useId } from "react";

// The flags are drawn rather than emoji, which Windows shows as two letters.
export function Flag({ locale }: { locale: "it" | "en" }) {
	return locale === "it" ? <Italy /> : <UnitedKingdom />;
}

function Italy() {
	return (
		<svg
			viewBox="0 0 3 2"
			width="21"
			height="14"
			aria-hidden="true"
			className="rounded-[3px]"
		>
			<rect width="1" height="2" fill="#009246" />
			<rect x="1" width="1" height="2" fill="#ffffff" />
			<rect x="2" width="1" height="2" fill="#ce2b37" />
		</svg>
	);
}

function UnitedKingdom() {
	const id = useId();
	return (
		<svg
			viewBox="0 0 60 30"
			width="28"
			height="14"
			aria-hidden="true"
			className="rounded-[3px]"
		>
			<clipPath id={`${id}-s`}>
				<path d="M0,0 v30 h60 v-30 z" />
			</clipPath>
			<clipPath id={`${id}-t`}>
				<path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
			</clipPath>
			<g clipPath={`url(#${id}-s)`}>
				<path d="M0,0 v30 h60 v-30 z" fill="#012169" />
				<path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
				<path
					d="M0,0 L60,30 M60,0 L0,30"
					clipPath={`url(#${id}-t)`}
					stroke="#c8102e"
					strokeWidth="4"
				/>
				<path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
				<path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
			</g>
		</svg>
	);
}
