import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { sortSpacesByLastActivity } from "../../../shared/lib/recentSpaceIds";
import { WorkspaceCreateSpaceDialog } from "./WorkspaceCreateSpaceDialog";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

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
		<title>Expand sidebar</title>
		<path
			d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 12H9M18 8l4 4-4 4"
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
		<title>Collapse sidebar</title>
		<path
			d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M9 12h10M6 8l-4 4 4 4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconPlusSquare = ({ className }: { className?: string }) => (
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
		<title>Expand sidebar to create a space</title>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M12 8v8M8 12h8" strokeLinecap="round" />
	</svg>
);

const spaceInitial = (name: string) => {
	const t = name.trim();
	if (!t) return "?";
	return t.charAt(0).toUpperCase();
};

const IconPlusSmall = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Add</title>
		<path d="M12 5v14M5 12h14" strokeLinecap="round" />
	</svg>
);

export const WorkspaceSpaceListNav = ({
	soloNav = false,
}: {
	/** When no chat panel is stacked below, let the space list use remaining sidebar height. */
	soloNav?: boolean;
}) => {
	const { user } = useAuth();
	const {
		workspaceScope,
		spaces,
		isLoading,
		loadError,
		refreshSpaces,
		sidebarExpanded,
		setSidebarExpanded,
		selectedSpaceId,
		setSelectedSpaceId,
		spaceHasUnread,
		setCreateSpaceDialogOpen,
	} = useWorkspaceSpaces();

	const spacesSorted = useMemo(
		() => (spaces?.length ? sortSpacesByLastActivity(spaces) : spaces),
		[spaces],
	);

	const handleSelectSpace = useCallback(
		(id: string | number) => {
			setSelectedSpaceId(id);
		},
		[setSelectedSpaceId],
	);

	if (!workspaceScope) {
		return (
			<div className="border-b border-border/60 p-4 text-xs text-muted-foreground">
				Loading spaces…
			</div>
		);
	}

	const collapsedRail = (
		<div className="flex min-h-0 flex-1 flex-col items-center gap-3 py-2">
			<button
				aria-label="Expand sidebar"
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onClick={() => setSidebarExpanded(true)}
				type="button"
			>
				<IconPanelOpen className="h-4 w-4" />
			</button>

			<div className="h-px w-8 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />

			<div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden py-1">
				{spacesSorted?.length
					? spacesSorted.map((s) => {
							const isActive =
								selectedSpaceId !== null &&
								String(s.id) === String(selectedSpaceId);
							const unread = spaceHasUnread(s.id);
							return (
								<button
									aria-label={`${s.name}${unread ? ", unread" : ""}`}
									aria-pressed={isActive}
									className={[
										"relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										isActive
											? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
											: "border border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/80 hover:text-foreground",
									].join(" ")}
									key={String(s.id)}
									onClick={() => handleSelectSpace(s.id)}
									title={s.name}
									type="button"
								>
									{spaceInitial(s.name)}
									{unread ? (
										<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
									) : null}
								</button>
							);
						})
					: null}
			</div>

			<div className="flex w-full flex-col items-center border-t border-border/60 pt-3">
				{workspaceScope.kind === "organization" ? (
					<Link
						aria-label="Manage spaces"
						className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						to="/console/spaces"
					>
						<IconPlusSquare className="h-4 w-4" />
					</Link>
				) : (
					<button
						aria-label="Add a new space"
						className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => setCreateSpaceDialogOpen(true)}
						type="button"
					>
						<IconPlusSquare className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);

	const expandedBody = (
		<div className="flex min-h-0 flex-1 flex-col gap-0">
			<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-3">
				<div className="text-sm font-semibold tracking-tight">Spaces</div>
				<div className="flex items-center gap-1">
					<button
						aria-expanded={sidebarExpanded}
						aria-label="Collapse sidebar"
						className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
						onClick={() => setSidebarExpanded(false)}
						type="button"
					>
						<IconPanelClose className="h-4 w-4" />
					</button>
					<button
						className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
						disabled={isLoading}
						onClick={() => void refreshSpaces()}
						type="button"
					>
						Refresh
					</button>
				</div>
			</div>

			{loadError ? (
				<p className="mt-2 text-xs text-destructive">{loadError}</p>
			) : null}

			<div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-0.5">
				<div className="grid gap-2">
					{spacesSorted?.length ? (
						<ul className="space-y-2">
							{spacesSorted.map((s) => {
								const isSelected =
									selectedSpaceId !== null &&
									String(s.id) === String(selectedSpaceId);
								const unread = spaceHasUnread(s.id);
								const ownerId =
									s.owner_user_id != null ? Number(s.owner_user_id) : null;
								const isYours =
									user?.id != null &&
									ownerId != null &&
									ownerId === Number(user.id);
								const sid = String(s.id);
								return (
									<li key={sid}>
										<div
											className={[
												"rounded-lg px-2 py-2 text-sm transition-colors",
												isSelected
													? "bg-primary/10 ring-1 ring-primary/25"
													: "hover:bg-muted/50",
											].join(" ")}
										>
											<button
												aria-label={`Select space ${s.name}${unread ? ", unread messages" : ""}`}
												className="flex w-full items-start justify-between gap-2 rounded-md px-1 text-left"
												onClick={() => handleSelectSpace(s.id)}
												type="button"
											>
												<div className="min-w-0 flex-1">
													<div className="truncate font-medium text-foreground">
														{s.name}
													</div>
													<div className="mt-0.5 text-[10px] leading-tight text-muted-foreground/95">
														{isYours ? (
															<span className="font-medium text-emerald-700 dark:text-emerald-400">
																Your space
															</span>
														) : ownerId != null ? (
															<span>Shared · owner user #{ownerId}</span>
														) : (
															<span className="font-mono">id {sid}</span>
														)}
													</div>
												</div>
												{unread ? (
													<span
														aria-hidden
														className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-sm shadow-primary/40"
														title="Unread messages"
													/>
												) : null}
											</button>
										</div>
									</li>
								);
							})}
						</ul>
					) : (
						<div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
							No spaces found.
						</div>
					)}
				</div>

				<div className="shrink-0 pt-1" id="workspace-sidebar-create">
					{workspaceScope.kind === "organization" ? (
						<p className="text-xs leading-relaxed text-muted-foreground">
							<Link
								className="font-medium text-foreground underline underline-offset-2"
								to="/console/spaces"
							>
								Spaces
							</Link>{" "}
							to add or manage organization spaces.
						</p>
					) : (
						<button
							className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => setCreateSpaceDialogOpen(true)}
							type="button"
						>
							<IconPlusSmall className="h-4 w-4 shrink-0" />
							Add space
						</button>
					)}
				</div>
			</div>
		</div>
	);

	return (
		<div
			className={[
				"flex min-h-0 flex-col border-b border-border/60 bg-muted/10",
				soloNav ? "min-h-0 flex-1" : "shrink-0",
			].join(" ")}
		>
			<div
				className={[
					"min-h-0 flex-1 flex-col overflow-y-auto p-4",
					"max-lg:flex",
					sidebarExpanded
						? soloNav
							? "lg:flex lg:min-h-0 lg:flex-1"
							: "lg:flex lg:max-h-[min(50vh,28rem)]"
						: "lg:hidden",
				].join(" ")}
			>
				{expandedBody}
			</div>
			<div
				className={[
					"hidden min-h-0 flex-col overflow-hidden",
					"max-lg:hidden",
					sidebarExpanded ? "lg:hidden" : "lg:flex lg:flex-1",
				].join(" ")}
			>
				{collapsedRail}
			</div>
			<WorkspaceCreateSpaceDialog />
		</div>
	);
};
