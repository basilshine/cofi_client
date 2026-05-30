import { useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	CeitsLogoMark,
	CeitsWordmark,
} from "../../../components/brand/ceits-logo";
import { useAuth } from "../../../contexts/AuthContext";
import { sortSpacesByLastActivity } from "../../../shared/lib/recentSpaceIds";
import { SpaceSidebarActivity } from "./SpaceSidebarActivity";
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

const IconHome = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="18"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="18"
	>
		<title>Home</title>
		<path
			d="M3 11l9-8 9 8M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconShield = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Security</title>
		<path
			d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconHelp = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Support</title>
		<circle cx="12" cy="12" r="9" />
		<path
			d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconBell = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Notifications</title>
		<path
			d="M15 17H5l1.2-1.2c.5-.5.8-1.2.8-1.9V11a5 5 0 1 1 10 0v2.9c0 .7.3 1.4.8 1.9L19 17h-4z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M10 19a2 2 0 0 0 4 0"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconCog = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Settings</title>
		<path
			d="M10.3 3.6l.4 1.7a7.6 7.6 0 0 1 2.6 0l.4-1.7 2.3.9-.7 1.7c.7.4 1.3.9 1.8 1.5l1.7-.7.9 2.3-1.7.4a7.6 7.6 0 0 1 0 2.6l1.7.4-.9 2.3-1.7-.7c-.4.7-.9 1.3-1.5 1.8l.7 1.7-2.3.9-.4-1.7a7.6 7.6 0 0 1-2.6 0l-.4 1.7-2.3-.9.7-1.7a7.6 7.6 0 0 1-1.8-1.5l-1.7.7-.9-2.3 1.7-.4a7.6 7.6 0 0 1 0-2.6L3.6 9.7l.9-2.3 1.7.7c.4-.7.9-1.3 1.5-1.8l-.7-1.7 2.3-.9z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<circle cx="12" cy="12" r="2.6" />
	</svg>
);

const IconUser = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Account</title>
		<path d="M19 21a7 7 0 1 0-14 0" strokeLinecap="round" />
		<circle cx="12" cy="7" r="4" />
	</svg>
);

const IconSpark = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Appearance</title>
		<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
	</svg>
);

const IconLock = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Security</title>
		<rect height="10" rx="2" width="14" x="5" y="11" />
		<path d="M8 11V8a4 4 0 1 1 8 0v3" />
	</svg>
);

const IconCard = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="16"
		stroke="currentColor"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
		width="16"
	>
		<title>Billing</title>
		<rect height="14" rx="2" width="18" x="3" y="5" />
		<path d="M3 10h18" />
	</svg>
);

export const WorkspaceSpaceListNav = ({
	soloNav = false,
}: {
	/** When no chat panel is stacked below, let the space list use remaining sidebar height. */
	soloNav?: boolean;
}) => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const {
		workspaceScope,
		spaces,
		loadError,
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

	// Overview entry covers both the new global Home (`/console/home`) and the
	// legacy widget-rich dashboard so the active state is always coherent.
	const isHomeActive =
		location.pathname.startsWith("/console/home") ||
		location.pathname.startsWith("/console/dashboard");
	const inSpaceShell = /^\/console\/spaces\/[^/]+/.test(location.pathname);
	const inChatShell = location.pathname.startsWith("/console/chat");
	const inSettingsShell = location.pathname.startsWith("/console/settings");
	const settingsLinks = [
		{
			to: "/console/settings/account",
			label: "Account",
			Icon: IconUser,
		},
		{
			to: "/console/settings/appearance",
			label: "Appearance",
			Icon: IconSpark,
		},
		{
			to: "/console/settings/notifications",
			label: "Notifications",
			Icon: IconBell,
		},
		{
			to: "/console/settings/security",
			label: "Security",
			Icon: IconLock,
		},
		{
			to: "/console/settings/billing",
			label: "Billing",
			Icon: IconCard,
		},
		{
			to: "/console/settings/spaces",
			label: "Spaces",
			Icon: IconPlusSquare,
		},
	] as const;

	const handleSelectSpace = useCallback(
		(id: string | number) => {
			setSelectedSpaceId(id);
			// Chat owns its own space switcher — it reacts to the context change
			// and re-fetches messages without any URL navigation.
			if (inChatShell) return;

			const sid = encodeURIComponent(String(id));

			// Inside the space shell (Overview / Splits / Recurring), keep the
			// active sub-tab when the user picks a different space so the click
			// actually moves them — without navigation the page's own URL→context
			// sync effect would immediately reset the selection back to the URL.
			if (inSpaceShell) {
				const subMatch = location.pathname.match(
					/^\/console\/spaces\/[^/]+(\/[^/]+)?\/?$/,
				);
				const tail = subMatch?.[1] ?? "/overview";
				navigate(`/console/spaces/${sid}${tail}`);
				return;
			}

			// Anywhere else (Home, Dashboard, Drafts, Account, …) jump into the
			// chosen space's overview.
			navigate(`/console/spaces/${sid}/overview`);
		},
		[
			setSelectedSpaceId,
			navigate,
			inSpaceShell,
			inChatShell,
			location.pathname,
		],
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

			<Link
				aria-current={isHomeActive ? "page" : undefined}
				aria-label="Dashboard — all spaces overview"
				className={[
					"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					isHomeActive
						? "border-foreground/20 bg-foreground text-background"
						: "border-border/80 bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
				].join(" ")}
				to="/console/home"
			>
				<IconHome className="h-4 w-4" />
			</Link>

			<div className="h-px w-8 shrink-0 bg-gradient-to-r from-transparent via-border to-transparent" />

			<div className="flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden py-1">
				{inSettingsShell
					? settingsLinks.map((item) => {
							const active =
								location.pathname === item.to ||
								(item.to === "/console/settings/spaces" &&
									location.pathname.startsWith("/console/settings/spaces"));
							const SettingsIcon = item.Icon;
							return (
								<Link
									aria-current={active ? "page" : undefined}
									aria-label={item.label}
									className={[
										"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold uppercase tracking-tight shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
										active
											? "border-foreground/20 bg-foreground text-background"
											: "border-border/80 bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
									].join(" ")}
									key={item.to}
									title={item.label}
									to={item.to}
								>
									<SettingsIcon className="h-3.5 w-3.5" />
								</Link>
							);
						})
					: spacesSorted?.length
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

			<div className="flex w-full flex-col items-center gap-2 border-t border-border/60 pt-3">
				{inSettingsShell ? (
					<Link
						aria-label="Settings account"
						className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						to="/console/settings/account"
					>
						<IconCog className="h-4 w-4" />
					</Link>
				) : workspaceScope.kind === "organization" ? (
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
				<Link
					aria-label="Settings"
					className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to="/console/settings/account"
				>
					<IconShield className="h-4 w-4" />
				</Link>
			</div>
		</div>
	);

	const navLinkClass = (isActive: boolean) =>
		[
			"group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			isActive
				? "soft-shadow bg-muted text-foreground font-bold"
				: "text-muted-foreground hover:bg-muted/40 hover:text-foreground font-medium",
		].join(" ");

	/** Same shell as `navLinkClass` but split for space rows: one nav surface + optional actions rail. */
	const spaceNavRowClass = (isActive: boolean) =>
		[
			"group/space flex w-full min-w-0 items-stretch overflow-visible rounded-xl text-left text-sm tracking-tight transition-all",
			"ring-inset focus-within:ring-2 focus-within:ring-ring",
			isActive
				? "soft-shadow bg-muted text-foreground"
				: "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
		].join(" ");

	const expandedBody = (
		<div className="flex min-h-0 flex-1 flex-col gap-0">
			<div className="flex shrink-0 items-center justify-between gap-2 px-2 pb-2">
				<Link
					aria-label="Ceits home"
					className="flex min-w-0 items-center gap-3 rounded-lg py-1 transition-colors hover:opacity-90"
					to="/console/home"
				>
					<span
						aria-hidden
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground shadow-sm"
					>
						<CeitsLogoMark size={34} variant="auto" />
					</span>
					<CeitsWordmark
						className="min-w-0 font-semibold tracking-tight text-foreground"
						size="md"
						variant="auto"
					/>
				</Link>
				<button
					aria-expanded={sidebarExpanded}
					aria-label="Collapse sidebar"
					className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
					onClick={() => setSidebarExpanded(false)}
					type="button"
				>
					<IconPanelClose className="h-4 w-4" />
				</button>
			</div>

			{/*
			 * Single continuous nav — Overview + spaces + New space — that flexes
			 * to fill all empty space between the brand block and the bottom
			 * utility section. Mirrors the household overview design reference.
			 */}
			<nav
				aria-label="Workspaces"
				className="mt-2 flex min-h-0 flex-1 flex-col gap-1"
			>
				<Link
					aria-current={isHomeActive ? "page" : undefined}
					className={navLinkClass(isHomeActive)}
					to="/console/home"
				>
					<IconHome className="h-4 w-4 shrink-0" />
					<span>Dashboard</span>
				</Link>

				{loadError ? (
					<p className="mx-1 mt-2 text-xs text-destructive">{loadError}</p>
				) : null}

				<div className="-mr-1 mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
					{inSettingsShell ? (
						<div className="space-y-1">
							<p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
								Settings
							</p>
							{settingsLinks.map((item) => {
								const active =
									location.pathname === item.to ||
									(item.to === "/console/settings/spaces" &&
										location.pathname.startsWith("/console/settings/spaces"));
								const SettingsIcon = item.Icon;
								return (
									<Link
										aria-current={active ? "page" : undefined}
										className={navLinkClass(active)}
										key={item.to}
										to={item.to}
									>
										<SettingsIcon className="h-4 w-4 shrink-0" />
										<span>{item.label}</span>
									</Link>
								);
							})}
						</div>
					) : spacesSorted?.length ? (
						<>
							<p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
								Spaces
							</p>
							<ul className="space-y-1">
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
											{isYours ? (
												<div className={spaceNavRowClass(isSelected)}>
													<button
														aria-current={isSelected ? "page" : undefined}
														aria-label={`Open space ${s.name}${unread ? ", unread messages" : ""}`}
														className={[
															"flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left",
															isSelected ? "font-bold" : "font-medium",
															"rounded-l-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
														].join(" ")}
														onClick={() => handleSelectSpace(s.id)}
														type="button"
													>
														<span
															aria-hidden
															className={[
																"flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase tracking-tight transition-colors",
																isSelected
																	? "bg-foreground text-background"
																	: "bg-muted/60 text-muted-foreground group-hover/space:text-foreground",
															].join(" ")}
														>
															{spaceInitial(s.name)}
														</span>
														<span className="min-w-0 flex-1">
															<span className="block truncate">{s.name}</span>
															<span className="mt-0.5 block truncate text-[10px] font-medium tracking-wide text-muted-foreground">
																Your space
															</span>
														</span>
														{unread ? (
															<span
																aria-hidden
																className="ml-1 h-2 w-2 shrink-0 rounded-full bg-secondary shadow-[0_0_0_2px_hsl(var(--background))]"
																title="Unread messages"
															/>
														) : null}
													</button>
												</div>
											) : (
												<div className={spaceNavRowClass(isSelected)}>
													<button
														aria-label={`Select space ${s.name}${unread ? ", unread messages" : ""}`}
														aria-current={isSelected ? "page" : undefined}
														className={[
															"flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left",
															isSelected ? "font-bold" : "font-medium",
															"rounded-l-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
														].join(" ")}
														onClick={() => handleSelectSpace(s.id)}
														type="button"
													>
														<span
															aria-hidden
															className={[
																"flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase tracking-tight transition-colors",
																isSelected
																	? "bg-foreground text-background"
																	: "bg-muted/60 text-muted-foreground group-hover/space:text-foreground",
															].join(" ")}
														>
															{spaceInitial(s.name)}
														</span>
														<span className="min-w-0 flex-1">
															<span className="block truncate">{s.name}</span>
															<span className="mt-0.5 block truncate text-[10px] font-medium tracking-wide text-muted-foreground">
																{ownerId != null ? "Shared" : `id ${sid}`}
															</span>
														</span>
														{unread ? (
															<span
																aria-hidden
																className="ml-1 h-2 w-2 shrink-0 rounded-full bg-secondary shadow-[0_0_0_2px_hsl(var(--background))]"
																title="Unread messages"
															/>
														) : null}
													</button>
												</div>
											)}
										</li>
									);
								})}
							</ul>
						</>
					) : (
						<div className="rounded-xl border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
							No spaces yet.
						</div>
					)}
				</div>

				<div className="shrink-0 pt-2" id="workspace-sidebar-create">
					{inSettingsShell ? (
						<div className="rounded-xl border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground">
							Space context is hidden while you are in settings.
						</div>
					) : workspaceScope.kind === "organization" ? (
						<p className="px-1 text-xs leading-relaxed text-muted-foreground">
							Manage organization spaces in{" "}
							<Link
								className="font-medium text-foreground underline underline-offset-2"
								to="/console/spaces"
							>
								Spaces
							</Link>
							.
						</p>
					) : (
						<button
							className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-transparent px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-all hover:border-foreground/40 hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={() => setCreateSpaceDialogOpen(true)}
							type="button"
						>
							<IconPlusSmall className="h-4 w-4 shrink-0" />
							<span>New space</span>
						</button>
					)}
				</div>
			</nav>

			<div className="mt-4 shrink-0 space-y-1 border-t border-border/60 pt-4">
				<Link
					className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to="/console/settings"
				>
					<IconShield className="h-4 w-4 shrink-0" />
					<span>Settings</span>
				</Link>
				<a
					className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					href="mailto:support@ceits.app"
					rel="noopener noreferrer"
				>
					<IconHelp className="h-4 w-4 shrink-0" />
					<span>Support</span>
				</a>
				<SpaceSidebarActivity selectedSpaceId={selectedSpaceId} />
			</div>
		</div>
	);

	return (
		<div
			className={[
				/* Sidebar nav always claims the available vertical space, even
				 * when an optional chat-context panel is stacked below. The brand
				 * stays at the top of the inner body; bottom utility/profile sit
				 * at the bottom; the spaces list flexes to fill what is between. */
				"flex min-h-0 flex-1 flex-col bg-background",
				soloNav ? "" : "border-b border-border/60",
			].join(" ")}
		>
			<div
				className={[
					/* No `overflow-y-auto` here — the inner spaces list owns its
					 * scroll so the nav can flex to fill all empty space between
					 * the brand block and the bottom utility row. */
					"min-h-0 flex-1 flex-col p-4",
					"max-lg:flex",
					sidebarExpanded ? "lg:flex lg:min-h-0 lg:flex-1" : "lg:hidden",
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
