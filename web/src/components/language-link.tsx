import { useLocation } from "@tanstack/react-router";

import { Flag } from "@/components/flag";
import { m } from "@/paraglide/messages";
import { getLocale, localizeHref } from "@/paraglide/runtime";

// A plain link, so switching reloads the page and the prerendered HTML of the other locale.
export function LanguageLink() {
	const { pathname } = useLocation();
	const other = getLocale() === "it" ? "en" : "it";
	return (
		<a
			href={localizeHref(pathname, { locale: other })}
			hrefLang={other}
			className="glass relative flex h-11 items-center gap-2.5 rounded-full px-4 text-sm font-medium"
		>
			<Flag locale={other} />
			{m.language_switch()}
		</a>
	);
}
