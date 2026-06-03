import type { Space, SpaceMember, SpaceParticipant } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { SpaceHeader } from "../../app/layout/workspaceSpaces/SpaceHeader";
import { SpaceWorkspaceLayout } from "../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";
import {
	isPlaceholderParticipant,
	participantContactSummary,
} from "../../shared/lib/participantPresentation";
import { SpaceParticipantsPanel } from "../../widgets/space-participants-panel";

const toNumericId = (value: string | number | undefined): number | null => {
	if (value == null) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const isRegisteredParticipant = (participant: SpaceParticipant): boolean =>
	participant.participant_type === "registered_member" ||
	participant.status === "active" ||
	participant.status === "linked" ||
	participant.user_id != null ||
	participant.linked_user_id != null;

const isInvitedParticipant = (participant: SpaceParticipant): boolean =>
	participant.participant_type === "invited_member" ||
	participant.status === "invited";

const needsContact = (participant: SpaceParticipant): boolean =>
	!participant.email?.trim() &&
	!participant.telegram_username?.trim() &&
	!participantContactSummary(participant);

const isAliasParticipant = (participant: SpaceParticipant): boolean =>
	participant.canonical_participant_id != null;

const memberRoleLabel = (members: SpaceMember[] | null): string => {
	if (!members?.length) return "No registered members loaded";
	const owners = members.filter((member) =>
		String(member.role ?? "")
			.toLowerCase()
			.includes("owner"),
	).length;
	const admins = members.filter((member) =>
		String(member.role ?? "")
			.toLowerCase()
			.includes("admin"),
	).length;
	return [
		`${members.length} registered user${members.length === 1 ? "" : "s"}`,
		owners ? `${owners} owner${owners === 1 ? "" : "s"}` : null,
		admins ? `${admins} admin${admins === 1 ? "" : "s"}` : null,
	]
		.filter(Boolean)
		.join(" · ");
};

export const SpaceMembersPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const [searchParams] = useSearchParams();
	const { user } = useAuth();
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();
	const numericSpaceId = useMemo(() => toNumericId(spaceId), [spaceId]);
	const selectedParticipantId =
		searchParams.get("participantId")?.trim() || null;

	const space: Space | null = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return spaces.find((entry) => String(entry.id) === String(spaceId)) ?? null;
	}, [spaceId, spaces]);

	useConsoleHeaderTitle("Members", space?.name ?? null);

	const [participants, setParticipants] = useState<SpaceParticipant[] | null>(
		null,
	);
	const [members, setMembers] = useState<SpaceMember[] | null>(null);
	const [canManageMemberRoles, setCanManageMemberRoles] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	useEffect(() => {
		if (numericSpaceId == null) return;
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		setParticipants(null);
		setMembers(null);
		void (async () => {
			try {
				const [participantRes, memberRes] = await Promise.all([
					apiClient.spaces.listParticipants(numericSpaceId),
					apiClient.spaces.listMembers(numericSpaceId).catch(() => null),
				]);
				if (cancelled) return;
				setParticipants(participantRes.participants ?? []);
				setMembers(memberRes?.members ?? null);
				setCanManageMemberRoles(Boolean(memberRes?.can_manage_member_roles));
			} catch (error) {
				if (!cancelled) {
					setLoadError(
						error instanceof Error
							? error.message
							: "Failed to load members for this space.",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [numericSpaceId]);

	const handleParticipantSaved = (participant: SpaceParticipant) => {
		setParticipants((current) => {
			if (!current) return [participant];
			const exists = current.some((item) => item.id === participant.id);
			if (!exists) return [...current, participant];
			return current.map((item) =>
				item.id === participant.id ? participant : item,
			);
		});
	};

	const handleParticipantDeleted = (participantId: string | number) => {
		setParticipants((current) =>
			current
				? current.filter((item) => String(item.id) !== String(participantId))
				: current,
		);
	};

	const participantRows = participants ?? [];
	const activeParticipantRows = participantRows.filter(
		(participant) => !isAliasParticipant(participant),
	);
	const aliasCount = participantRows.length - activeParticipantRows.length;
	const registeredCount = activeParticipantRows.filter(
		isRegisteredParticipant,
	).length;
	const invitedCount =
		activeParticipantRows.filter(isInvitedParticipant).length;
	const placeholderCount = activeParticipantRows.filter(
		isPlaceholderParticipant,
	).length;
	const needsContactCount = activeParticipantRows.filter(needsContact).length;
	const inviteReadyCount = activeParticipantRows.filter(
		(participant) =>
			participant.email?.trim() &&
			!isRegisteredParticipant(participant) &&
			participant.status !== "invited",
	).length;

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	const spaceName = space?.name?.trim() || "Space";

	const rightRail = (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[rgba(95,105,125,0.12)] bg-card/88 p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					People model
				</p>
				<h2 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
					Participants are the working people in this space
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					Registered users, invited people, and placeholders from captures or
					splits all live here before Ceits can assign balances cleanly.
				</p>
			</section>

			<section className="rounded-2xl border border-[rgba(120,154,124,0.18)] bg-[rgba(247,252,248,0.72)] p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#365f42]">
					Invite readiness
				</p>
				<dl className="mt-4 space-y-3 text-sm">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Ready to invite</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{inviteReadyCount}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Need contact</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{needsContactCount}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-muted-foreground">Pending invite</dt>
						<dd className="font-semibold tabular-nums text-foreground">
							{invitedCount}
						</dd>
					</div>
				</dl>
			</section>

			<section className="rounded-2xl border border-[rgba(95,105,125,0.12)] bg-[rgba(255,252,246,0.72)] p-5 shadow-sm">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					Registered access
				</p>
				<p className="mt-2 text-sm font-semibold text-foreground">
					{memberRoleLabel(members)}
				</p>
				<p className="mt-1 text-xs font-medium text-muted-foreground">
					{canManageMemberRoles
						? "You can manage roles and invites for this space."
						: "Role changes stay in settings for owners and admins."}
				</p>
				<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
					Space settings still own role and access controls. This page focuses
					on the people Ceits can use for captures, splits, and invites.
				</p>
				<Link
					className="mt-4 inline-flex h-9 items-center rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-accent active:scale-[0.96]"
					to={`/console/settings/spaces/${encodeURIComponent(String(numericSpaceId))}#space-settings-members`}
				>
					Open settings
				</Link>
			</section>
		</div>
	);

	return (
		<SpaceWorkspaceLayout
			rightRail={rightRail}
			rightRailLabel={`${spaceName} members rail`}
		>
			<SpaceHeader
				currentUserId={user?.id ?? null}
				space={
					space ??
					({ id: numericSpaceId, name: "Space", tenant_id: 0 } as Space)
				}
			/>

			<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[
					{
						key: "participants",
						label: "Participants",
						value: String(activeParticipantRows.length),
						note: "Visible people after aliases are resolved.",
					},
					{
						key: "registered",
						label: "Registered",
						value: String(registeredCount),
						note: "People with an account linked to this space.",
					},
					{
						key: "placeholders",
						label: "Placeholders",
						value: String(placeholderCount),
						note: "Names found before contact or invite is known.",
					},
					{
						key: "aliases",
						label: "Aliases",
						value: String(aliasCount),
						note: "Merged names kept for provenance and stats.",
					},
				].map((metric) => (
					<div
						className="rounded-xl border border-border/60 bg-card px-4 py-3 soft-shadow"
						key={metric.key}
					>
						<p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
							{metric.label}
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
							{isLoading ? "…" : metric.value}
						</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							{metric.note}
						</p>
					</div>
				))}
			</section>

			{loadError ? (
				<div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{loadError}
				</div>
			) : null}

			<section className="overflow-hidden rounded-2xl border border-[rgba(95,105,125,0.12)] bg-gradient-to-b from-[#faf8f5] to-[#f0ece6] shadow-[0_8px_26px_-22px_rgba(45,48,58,0.1)] ring-1 ring-inset ring-white/50">
				<SpaceParticipantsPanel
					canLinkParticipants={
						space?.owner_user_id != null &&
						user?.id != null &&
						Number(space.owner_user_id) === Number(user.id)
					}
					canRemoveParticipants={
						space?.owner_user_id != null &&
						user?.id != null &&
						Number(space.owner_user_id) === Number(user.id)
					}
					description="Registered members, invited people, external participants, and placeholders. Add contacts here so Ceits can send invites and keep split decisions readable."
					emptyText="No participants yet. Captures, split review, or invites can add people here."
					maxVisible={null}
					onParticipantDeleted={handleParticipantDeleted}
					onParticipantSaved={handleParticipantSaved}
					participants={participants}
					selectedParticipantId={selectedParticipantId}
					showTopBorder={false}
					spaceId={numericSpaceId}
					title="Members and participants"
				/>
			</section>

			<div className="xl:hidden">{rightRail}</div>
		</SpaceWorkspaceLayout>
	);
};
