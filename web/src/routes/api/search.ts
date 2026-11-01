import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";

import { labSource } from "@/lib/lab/source";

// Prerendered once as a static index that the search dialog downloads.
const server = createFromSource(labSource, {
	localeMap: { it: { language: "italian" }, en: { language: "english" } },
});

export const Route = createFileRoute("/api/search")({
	server: { handlers: { GET: () => server.staticGET() } },
});
