import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";

import { NotFoundPage } from "@/components/not-found";
import { umamiScript } from "@/lib/analytics";
import { THEME_SCRIPT } from "@/lib/settings";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import globalsCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ name: "theme-color", content: "#02070A" },
			{ title: "Briscolab" },
			{ name: "description", content: m.site_description() },
		],
		links: [
			{ rel: "stylesheet", href: globalsCss },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "manifest", href: "/manifest.webmanifest" },
		],
		scripts: [
			{ src: "/registerSW.js", defer: true },
			...(umamiScript ? [umamiScript] : []),
		],
	}),
	shellComponent: RootDocument,
	component: Outlet,
	notFoundComponent: NotFoundPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		// The theme script below sets data-theme before React hydrates.
		<html lang={getLocale()} suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="min-h-dvh antialiased">
				{/* motion's own animations (the shuffle, the hand closing up, the result) follow the system's reduced motion. */}
				<MotionConfig reducedMotion="user">{children}</MotionConfig>
				<Scripts />
			</body>
		</html>
	);
}
