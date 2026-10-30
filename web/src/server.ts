import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "@/paraglide/server";

// The prerender renders every page through this handler, so /en pages come out in English.
export default {
	fetch(req: Request): Promise<Response> {
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};
