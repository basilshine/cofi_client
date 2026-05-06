export type FirstChatQuickAction = { id: string; label: string };

type FirstChatQuickActionsProps = {
	actions: FirstChatQuickAction[];
	onAction: (id: string) => void;
};

export const FirstChatQuickActions = ({
	actions,
	onAction,
}: FirstChatQuickActionsProps) => {
	if (!actions.length) return null;

	return (
		<div className="shrink-0 border-t border-border/60 bg-muted/15 px-3 py-2.5 sm:px-4">
			<p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				Quick start
			</p>
			<div className="flex flex-wrap gap-2">
				{actions.map((a) => (
					<button
						className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						key={a.id}
						onClick={() => onAction(a.id)}
						type="button"
					>
						{a.label}
					</button>
				))}
			</div>
		</div>
	);
};
