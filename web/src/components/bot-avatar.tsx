import { cn } from "@/lib/cn";

/** A bot's robot, drawn once by `pnpm bots` into public/bots. Decorative: the bot's name is always next to it. */
export function BotAvatar({ bot, className }: { bot: string; className?: string }) {
	return (
		<img
			src={`/bots/${bot}.svg`}
			alt=""
			aria-hidden="true"
			draggable={false}
			className={cn("block shrink-0", className)}
		/>
	);
}
