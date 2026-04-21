import type { ReactNode } from "react";

const IconPanelOpen = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Expand panel</title>
		<path
			d="M15 4H9a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6M9 12h10M6 8l-4 4 4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconPanelClose = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Collapse panel</title>
		<path
			d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 12H9M18 8l4 4-4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconReceipt = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Expenses</title>
		<path
			d="M9 5h6l4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path d="M9 9h6M9 13h4" strokeLinecap="round" />
	</svg>
);

export type WorkspaceRightSidebarProps = {
	expanded: boolean;
	onExpandedChange: (next: boolean) => void;
	title: string;
	children: ReactNode;
};

export const WorkspaceRightSidebar = ({
	expanded,
	onExpandedChange,
	title,
	children,
}: WorkspaceRightSidebarProps) => {
	return (
		<aside
			className={[
				"flex min-h-0 shrink-0 flex-col self-stretch border-l border-border/80 bg-muted/15 transition-[width,max-width] duration-200 ease-out",
				expanded
					? "w-full max-w-[min(100vw,320px)] lg:w-[min(100%,320px)]"
					: "w-full max-w-[4.5rem] lg:w-[4.5rem]",
			].join(" ")}
		>
			{expanded ? (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/10 px-3 py-2.5">
						<div className="min-w-0 truncate text-sm font-semibold tracking-tight">
							{title}
						</div>
						<button
							aria-expanded={expanded}
							aria-label="Collapse expenses panel"
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => onExpandedChange(false)}
							type="button"
						>
							<IconPanelClose className="h-4 w-4" />
						</button>
					</div>
					<div className="scrollbar-chat min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
						{children}
					</div>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 flex-col items-center gap-3 py-2">
					<button
						aria-label={`Expand ${title}`}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onExpandedChange(true)}
						type="button"
					>
						<IconPanelOpen className="h-4 w-4" />
					</button>
					<div className="h-px w-8 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />
					<button
						aria-label={`${title} — expand to browse`}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onExpandedChange(true)}
						title={title}
						type="button"
					>
						<IconReceipt className="h-4 w-4" />
					</button>
				</div>
			)}
		</aside>
	);
};
