import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { NotFoundPage } from "@/components/not-found";
import { deLocalizeUrl, localizeUrl } from "@/paraglide/runtime";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
	return createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultNotFoundComponent: NotFoundPage,
		// Routes are written once; the locale lives only in the URL.
		rewrite: {
			input: ({ url }) => deLocalizeUrl(url),
			output: ({ url }) => localizeUrl(url),
		},
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
