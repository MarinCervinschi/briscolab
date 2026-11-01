import { cn } from "@/lib/cn";

export function Switch({
	checked,
	onChange,
	labelledBy,
	className,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	labelledBy: string;
	className?: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-labelledby={labelledBy}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-8 w-14 shrink-0 rounded-full transition-colors",
				checked ? "bg-data" : "bg-raised",
				className
			)}
		>
			<span
				className={cn(
					"bg-text absolute top-1 left-1 size-6 rounded-full transition-transform",
					checked && "translate-x-6"
				)}
			/>
		</button>
	);
}
