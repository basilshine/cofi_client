import type { Space, SpaceParticipant } from "@cofi/api";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Link,
	Navigate,
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceTabs } from "../../app/layout/workspaceSpaces/SpaceTabs";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";
import { SpaceParticipantsPanel } from "../../widgets/space-participants-panel";
import { SpaceMembersInvitesPanel } from "./SpaceMembersInvitesPanel";
import {
	useSpaceMembersInvites,
	useSpaceOwnerFromMembers,
} from "./useSpaceMembersInvites";

const sectionCard =
	"rounded-2xl border border-border/70 bg-card text-card-foreground soft-shadow inner-glow";
const sectionHeading =
	"flex items-center justify-between gap-3 border-b border-border/50 px-6 py-4";
const sectionTitle =
	"font-display text-lg font-bold tracking-tight text-foreground sm:text-xl";
const sectionEyebrow = "eyebrow";
const buttonBase =
	"inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50";
const inputBase =
	"w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

type AppearanceTheme = "default" | "calm" | "contrast";

export const SpaceSettingsPage = ({
	surface = "space",
}: {
	surface?: "space" | "settings";
}) => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { user } = useAuth();
	const {
		spaces,
		patchSpaces,
		refreshSpaces,
		selectedSpaceId,
		setSelectedSpaceId,
	} = useWorkspaceSpaces();

	const numericSpaceId = useMemo(() => {
		const n = Number(spaceId);
		return Number.isFinite(n) ? n : null;
	}, [spaceId]);
	const selectedParticipantId =
		searchParams.get("participantId")?.trim() || null;

	const space: Space | null = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return spaces.find((s) => String(s.id) === String(spaceId)) ?? null;
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Space settings", space?.name ?? null);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	const isOwner =
		space?.owner_user_id != null &&
		user?.id != null &&
		Number(space.owner_user_id) === Number(user.id);
	const settingsSurface = surface === "settings";

	const [name, setName] = useState(space?.name ?? "");
	const [description, setDescription] = useState(space?.description ?? "");
	const [theme, setTheme] = useState<AppearanceTheme>("default");
	const [accent, setAccent] = useState("#8d6e63");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pendingDestructive, setPendingDestructive] = useState<
		"delete" | "leave" | null
	>(null);
	const [cloneBusy, setCloneBusy] = useState(false);
	const [destructiveBusy, setDestructiveBusy] = useState(false);
	const [participants, setParticipants] = useState<SpaceParticipant[] | null>(
		null,
	);

	useEffect(() => {
		setName(space?.name ?? "");
		setDescription(space?.description ?? "");
		const appearance = space?.settings?.appearance;
		setTheme((appearance?.theme as AppearanceTheme | undefined) ?? "default");
		setAccent(appearance?.accent ?? "#8d6e63");
	}, [space]);

	const handleCloneSpace = useCallback(async () => {
		if (numericSpaceId == null) return;
		setCloneBusy(true);
		setError(null);
		try {
			const created = await apiClient.spaces.clone(numericSpaceId);
			patchSpaces((prev) => (prev ? [...prev, created] : [created]));
			setSelectedSpaceId(created.id);
			void refreshSpaces();
			navigate(
				settingsSurface
					? `/console/settings/spaces/${encodeURIComponent(String(created.id))}`
					: `/console/spaces/${encodeURIComponent(String(created.id))}/overview`,
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to clone this space");
		} finally {
			setCloneBusy(false);
		}
	}, [
		navigate,
		numericSpaceId,
		patchSpaces,
		refreshSpaces,
		setSelectedSpaceId,
		settingsSurface,
	]);

	const handleConfirmDestructive = useCallback(async () => {
		if (numericSpaceId == null || pendingDestructive == null) return;
		setDestructiveBusy(true);
		setError(null);
		try {
			await apiClient.spaces.delete(numericSpaceId);
			patchSpaces((prev) =>
				prev
					? prev.filter((s) => String(s.id) !== String(numericSpaceId))
					: prev,
			);
			if (
				selectedSpaceId != null &&
				String(selectedSpaceId) === String(numericSpaceId)
			) {
				setSelectedSpaceId(null);
			}
			void refreshSpaces();
			setPendingDestructive(null);
			navigate(settingsSurface ? "/console/settings/spaces" : "/console/home");
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: pendingDestructive === "delete"
						? "Failed to delete this space"
						: "Failed to leave this space",
			);
		} finally {
			setDestructiveBusy(false);
		}
	}, [
		navigate,
		numericSpaceId,
		patchSpaces,
		pendingDestructive,
		refreshSpaces,
		selectedSpaceId,
		setSelectedSpaceId,
		settingsSurface,
	]);

	const membersModel = useSpaceMembersInvites({
		spaceId: numericSpaceId,
		selectedSpace: space,
		enabled: numericSpaceId != null && space != null,
		onSpacesUpdated: refreshSpaces,
		onJoinedSpace: (s) => setSelectedSpaceId(s.id),
	});
	const memberPanelIsOwner = useSpaceOwnerFromMembers(
		membersModel.members,
		user?.id != null ? Number(user.id) : null,
	);

	useEffect(() => {
		if (numericSpaceId == null || space == null) return;
		let cancelled = false;
		setParticipants(null);
		void apiClient.spaces
			.listParticipants(numericSpaceId)
			.then((res) => {
				if (!cancelled) setParticipants(res.participants ?? null);
			})
			.catch(() => {
				if (!cancelled) setParticipants(null);
			});
		return () => {
			cancelled = true;
		};
	}, [numericSpaceId, space]);

	const handleParticipantSaved = useCallback(
		(participant: SpaceParticipant) => {
			setParticipants((current) => {
				if (!current) return [participant];
				return current.map((item) =>
					Number(item.id) === Number(participant.id) ? participant : item,
				);
			});
		},
		[],
	);

	useEffect(() => {
		if (location.hash !== "#space-settings-members") return;
		window.requestAnimationFrame(() => {
			document.getElementById("space-settings-members")?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	}, [location.hash, numericSpaceId, space?.id]);

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	if (space == null) {
		return (
			<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
				{settingsSurface ? null : (
					<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
						<SpaceTabs />
					</header>
				)}
				<div className="flex min-h-0 flex-1 items-center justify-center px-4">
					<p className="text-sm text-muted-foreground">Loading space...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			{settingsSurface ? null : (
				<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
					<SpaceTabs />
				</header>
			)}
			<div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
					{settingsSurface ? (
						<section className="rounded-2xl border border-border/70 bg-card p-4 text-card-foreground soft-shadow inner-glow">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="min-w-0">
									<p className={sectionEyebrow}>Settings / Spaces</p>
									<p className="mt-1 text-sm text-muted-foreground">
										Switch between spaces to edit per-space settings.
									</p>
								</div>
								<Link className={buttonBase} to="/console/settings/spaces">
									All spaces
								</Link>
							</div>
							{spaces?.length ? (
								<nav
									aria-label="Space settings navigation"
									className="mt-4 flex gap-2 overflow-x-auto pb-1"
								>
									{spaces.map((entry) => {
										const active = String(entry.id) === String(numericSpaceId);
										return (
											<Link
												aria-current={active ? "page" : undefined}
												className={[
													"inline-flex h-10 shrink-0 items-center rounded-xl border px-3 text-sm font-medium transition-[background-color,color,transform] active:scale-[0.96]",
													active
														? "border-primary/30 bg-primary text-primary-foreground"
														: "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
												].join(" ")}
												key={String(entry.id)}
												to={`/console/settings/spaces/${encodeURIComponent(String(entry.id))}`}
											>
												{entry.name || `Space ${String(entry.id)}`}
											</Link>
										);
									})}
								</nav>
							) : null}
						</section>
					) : null}
					<header className="space-y-2">
						<p className={sectionEyebrow}>
							{settingsSurface ? "Space settings" : "Space settings"}
						</p>
						<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
							{space.name}
						</h1>
						<p className="text-sm text-muted-foreground">
							{isOwner
								? "Edit identity, appearance, and space actions. Clone or delete from the sections below."
								: "You are a member. Only the owner can change identity and appearance; you can leave this space below."}
						</p>
					</header>

					{error ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					) : null}

					{membersModel.memberRoleError ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{membersModel.memberRoleError}
						</div>
					) : null}

					<section className={sectionCard} id="space-settings-members">
						<div className={sectionHeading}>
							<div>
								<p className={sectionEyebrow}>Collaboration</p>
								<h2 className={sectionTitle}>Members & invites</h2>
							</div>
						</div>
						<div className="space-y-3 p-6">
							<p className="text-xs text-muted-foreground">
								People, invite links, and tokens for this space.
							</p>
							<SpaceMembersInvitesPanel
								{...membersModel}
								currentUserId={user?.id != null ? Number(user.id) : null}
								isSpaceOwner={memberPanelIsOwner}
								selectedSpace={space}
								selectedSpaceId={numericSpaceId}
							/>
							<div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
								<SpaceParticipantsPanel
									onParticipantSaved={handleParticipantSaved}
									participants={participants}
									selectedParticipantId={selectedParticipantId}
									showTopBorder={false}
									spaceId={numericSpaceId}
								/>
							</div>
						</div>
					</section>

					{!isOwner ? (
						<>
							<div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
								You are a member of this space, but only the owner can edit
								space identity and appearance.
							</div>
							<section className={sectionCard}>
								<div className={sectionHeading}>
									<div>
										<p className={sectionEyebrow}>Danger zone</p>
										<h2 className={sectionTitle}>Leave this space</h2>
									</div>
								</div>
								<div className="space-y-3 p-6">
									<p className="text-sm text-muted-foreground">
										Leaving removes your membership. You will need a new invite
										to join this space again.
									</p>
									<button
										className={`${buttonBase} border-destructive/40 text-destructive hover:bg-destructive/10`}
										disabled={destructiveBusy || cloneBusy}
										onClick={() => setPendingDestructive("leave")}
										type="button"
									>
										Leave space
									</button>
								</div>
							</section>
							<div className="flex flex-wrap items-center gap-2">
								<Link
									className={buttonBase}
									to={
										settingsSurface
											? "/console/settings/spaces"
											: `/console/spaces/${encodeURIComponent(String(numericSpaceId))}/overview`
									}
								>
									{settingsSurface ? "Back to spaces" : "Back to overview"}
								</Link>
							</div>
						</>
					) : (
						<>
							{message ? (
								<output className="block rounded-xl border border-border bg-muted/60 p-3 text-sm text-foreground">
									{message}
								</output>
							) : null}
							<section className={sectionCard}>
								<div className={sectionHeading}>
									<div>
										<p className={sectionEyebrow}>General</p>
										<h2 className={sectionTitle}>Identity</h2>
									</div>
								</div>
								<div className="space-y-4 p-6">
									<label className="grid gap-1 text-sm">
										<span className="text-muted-foreground">Space name</span>
										<input
											className={inputBase}
											onChange={(e) => setName(e.target.value)}
											type="text"
											value={name}
										/>
									</label>
									<label className="grid gap-1 text-sm">
										<span className="text-muted-foreground">Description</span>
										<textarea
											className={`${inputBase} min-h-24 resize-y`}
											onChange={(e) => setDescription(e.target.value)}
											value={description}
										/>
									</label>
								</div>
							</section>
							<section className={sectionCard}>
								<div className={sectionHeading}>
									<div>
										<p className={sectionEyebrow}>Appearance</p>
										<h2 className={sectionTitle}>Theme</h2>
									</div>
								</div>
								<div className="grid gap-4 p-6 md:grid-cols-2">
									<label className="grid gap-1 text-sm">
										<span className="text-muted-foreground">Theme mode</span>
										<select
											className={inputBase}
											onChange={(e) =>
												setTheme(e.target.value as AppearanceTheme)
											}
											value={theme}
										>
											<option value="default">Default</option>
											<option value="calm">Calm</option>
											<option value="contrast">High contrast</option>
										</select>
									</label>
									<label className="grid gap-1 text-sm">
										<span className="text-muted-foreground">Accent color</span>
										<input
											className={`${inputBase} h-10`}
											onChange={(e) => setAccent(e.target.value)}
											type="color"
											value={accent}
										/>
									</label>
								</div>
							</section>
							<div className="flex flex-wrap items-center gap-2">
								<button
									className={`${buttonBase} bg-primary text-primary-foreground`}
									disabled={saving || !name.trim()}
									onClick={async () => {
										setSaving(true);
										setError(null);
										setMessage(null);
										try {
											const patched = await apiClient.spaces.patch(
												numericSpaceId,
												{
													name: name.trim(),
													description: description.trim(),
												},
											);
											const withSettings = await apiClient.spaces.patchSettings(
												numericSpaceId,
												{
													settings: {
														appearance: {
															theme,
															accent,
														},
													},
												},
											);
											patchSpaces((prev) =>
												prev
													? prev.map((s) =>
															String(s.id) === String(numericSpaceId)
																? {
																		...s,
																		...patched,
																		settings: withSettings.settings,
																	}
																: s,
														)
													: prev,
											);
											setMessage("Space settings saved.");
										} catch (e) {
											setError(
												e instanceof Error
													? e.message
													: "Failed to save space settings",
											);
										} finally {
											setSaving(false);
										}
									}}
									type="button"
								>
									{saving ? "Saving..." : "Save space settings"}
								</button>
								<Link
									className={buttonBase}
									to={
										settingsSurface
											? "/console/settings/spaces"
											: `/console/spaces/${encodeURIComponent(String(numericSpaceId))}/overview`
									}
								>
									{settingsSurface ? "Back to spaces" : "Back to overview"}
								</Link>
							</div>
							<section className={sectionCard}>
								<div className={sectionHeading}>
									<div>
										<p className={sectionEyebrow}>Space actions</p>
										<h2 className={sectionTitle}>Clone</h2>
									</div>
								</div>
								<div className="space-y-3 p-6">
									<p className="text-sm text-muted-foreground">
										Create a copy of this space. You will be switched to the new
										space when cloning finishes.
									</p>
									<button
										className={buttonBase}
										disabled={cloneBusy || saving || destructiveBusy}
										onClick={() => void handleCloneSpace()}
										type="button"
									>
										{cloneBusy ? "Cloning…" : "Clone space"}
									</button>
								</div>
							</section>
							<section className={sectionCard}>
								<div className={sectionHeading}>
									<div>
										<p className={sectionEyebrow}>Danger zone</p>
										<h2 className={sectionTitle}>Delete this space</h2>
									</div>
								</div>
								<div className="space-y-3 p-6">
									<p className="text-sm text-muted-foreground">
										Permanently removes this space and everything inside it:
										chat, expenses, splits, recurring items, and settings. This
										cannot be undone.
									</p>
									<button
										className={`${buttonBase} border-destructive/40 text-destructive hover:bg-destructive/10`}
										disabled={saving || cloneBusy || destructiveBusy}
										onClick={() => setPendingDestructive("delete")}
										type="button"
									>
										Delete space
									</button>
								</div>
							</section>
						</>
					)}
				</div>
			</div>
			<Dialog.Root
				onOpenChange={(open) => {
					if (!open) setPendingDestructive(null);
				}}
				open={pendingDestructive != null}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
					<Dialog.Content
						className="fixed left-1/2 top-1/2 z-[101] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-5 shadow-lg outline-none"
						onOpenAutoFocus={(e) => e.preventDefault()}
					>
						<Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
							{pendingDestructive === "delete" ? "Delete space" : "Leave space"}
						</Dialog.Title>
						<Dialog.Description className="mt-2 text-sm text-muted-foreground">
							{pendingDestructive === "delete"
								? `You are deleting "${space.name}". You will lose everything inside this space: chat history, expenses, splits, recurring items, and settings. This action cannot be undone.`
								: `You are leaving "${space.name}". You will lose access to this space and will need a new invite to join again.`}
						</Dialog.Description>
						<div className="mt-5 flex justify-end gap-2">
							<Dialog.Close asChild>
								<button
									className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									type="button"
								>
									Cancel
								</button>
							</Dialog.Close>
							<button
								className="inline-flex h-10 items-center rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								disabled={pendingDestructive == null || destructiveBusy}
								onClick={() => void handleConfirmDestructive()}
								type="button"
							>
								{pendingDestructive === "delete"
									? "Delete permanently"
									: "Leave space"}
							</button>
						</div>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	);
};
