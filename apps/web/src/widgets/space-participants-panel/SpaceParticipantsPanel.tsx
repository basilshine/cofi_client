import type { SpaceParticipant } from "@cofi/api";
import {
	Check,
	Link2,
	MailPlus,
	Pencil,
	Trash2,
	Unlink2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";
import { EntityIcon } from "../../shared/lib/entityPresentation";
import {
	isPlaceholderParticipant,
	participantDisplayName,
	participantNotes,
	toSpaceParticipantEntity,
} from "../../shared/lib/participantPresentation";
import { WorkspaceEntityCard } from "../../shared/ui/WorkspaceListingPage";
import { InviteLinkSharePanel } from "../space-invite-management";

type ParticipantFormState = {
	displayName: string;
	email: string;
	telegramUsername: string;
	phone: string;
	whatsapp: string;
	notes: string;
};

type SpaceParticipantsPanelProps = {
	spaceId: string | number;
	participants: SpaceParticipant[] | null;
	onParticipantSaved: (participant: SpaceParticipant) => void;
	onParticipantDeleted?: (participantId: string | number) => void;
	selectedParticipantId?: string | number | null;
	canRemoveParticipants?: boolean;
	canLinkParticipants?: boolean;
	readOnly?: boolean;
	registeredFirst?: boolean;
	stateOnly?: boolean;
	title?: string;
	description?: string;
	emptyText?: string;
	maxVisible?: number | null;
	showAliases?: boolean;
	showHeader?: boolean;
	showTopBorder?: boolean;
};

const contactString = (
	contactData: Record<string, unknown> | undefined,
	key: string,
): string => {
	const value = contactData?.[key];
	return typeof value === "string" ? value : "";
};

const toFormState = (participant: SpaceParticipant): ParticipantFormState => ({
	displayName: participant.display_name ?? "",
	email: participant.email ?? "",
	telegramUsername: participant.telegram_username ?? "",
	phone: contactString(participant.contact_data, "phone"),
	whatsapp: contactString(participant.contact_data, "whatsapp"),
	notes: contactString(participant.contact_data, "notes"),
});

const cleanTelegram = (value: string): string =>
	value.trim().replace(/^@+/, "");

const compactContactData = (
	formState: ParticipantFormState,
	existing: Record<string, unknown> | undefined,
): Record<string, unknown> => {
	const next = { ...(existing ?? {}) };
	const values = {
		phone: formState.phone.trim(),
		whatsapp: formState.whatsapp.trim(),
		notes: formState.notes.trim(),
	};
	for (const [key, value] of Object.entries(values)) {
		if (value) {
			next[key] = value;
		} else {
			delete next[key];
		}
	}
	return next;
};

const isAliasParticipant = (participant: SpaceParticipant): boolean =>
	participant.canonical_participant_id != null;

const participantStateLabel = (participant: SpaceParticipant): string => {
	if (
		participant.participant_type === "registered_member" ||
		participant.status === "active" ||
		participant.status === "linked" ||
		participant.user_id != null ||
		participant.linked_user_id != null
	) {
		return "Registered user";
	}
	if (
		participant.participant_type === "invited_member" ||
		participant.status === "invited" ||
		participant.invitation_id != null
	) {
		return "Invite pending";
	}
	if (isPlaceholderParticipant(participant)) {
		return "Placeholder";
	}
	if (participant.participant_type === "external_participant") {
		return "External";
	}
	return "Participant";
};

const participantStateClassName = (participant: SpaceParticipant): string => {
	if (
		participant.participant_type === "registered_member" ||
		participant.status === "active" ||
		participant.status === "linked" ||
		participant.user_id != null ||
		participant.linked_user_id != null
	) {
		return "border-[rgba(72,107,82,0.2)] bg-[rgba(235,247,238,0.82)] text-[#31583a]";
	}
	if (
		participant.participant_type === "invited_member" ||
		participant.status === "invited" ||
		participant.invitation_id != null
	) {
		return "border-[rgba(172,124,35,0.22)] bg-[rgba(255,247,222,0.86)] text-[#785312]";
	}
	if (isPlaceholderParticipant(participant)) {
		return "border-[rgba(64,91,118,0.18)] bg-[rgba(241,248,252,0.86)] text-[#34556f]";
	}
	return "border-border/60 bg-muted/55 text-muted-foreground";
};

const sourceCaptureReviewHref = (
	spaceId: string | number,
	sourceDocumentId: number,
) =>
	`/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`;

export const SpaceParticipantsPanel = ({
	spaceId,
	participants,
	onParticipantSaved,
	onParticipantDeleted,
	selectedParticipantId = null,
	canRemoveParticipants = false,
	canLinkParticipants = false,
	readOnly = false,
	registeredFirst = false,
	stateOnly = false,
	title = "Participants",
	description = "People in this space, including members, invitees, and placeholders from captures and splits.",
	emptyText = "No participants yet.",
	maxVisible = 8,
	showAliases = true,
	showHeader = true,
	showTopBorder = true,
}: SpaceParticipantsPanelProps) => {
	const [editingId, setEditingId] = useState<number | null>(null);
	const [formState, setFormState] = useState<ParticipantFormState | null>(null);
	const [savingId, setSavingId] = useState<number | null>(null);
	const [invitingId, setInvitingId] = useState<number | null>(null);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
	const [linkingId, setLinkingId] = useState<number | null>(null);
	const [linkTargetId, setLinkTargetId] = useState<number | null>(null);
	const [savingLinkId, setSavingLinkId] = useState<number | null>(null);
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [inviteDelivery, setInviteDelivery] = useState<{
		status?: "sent" | "skipped" | "failed";
		message?: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);

	const participantsById = useMemo(() => {
		const map = new Map<number, SpaceParticipant>();
		for (const participant of participants ?? []) {
			map.set(Number(participant.id), participant);
		}
		return map;
	}, [participants]);

	const aliasesByCanonicalId = useMemo(() => {
		const map = new Map<number, SpaceParticipant[]>();
		if (!showAliases) return map;
		for (const participant of participants ?? []) {
			if (participant.canonical_participant_id == null) continue;
			const canonicalId = Number(participant.canonical_participant_id);
			const current = map.get(canonicalId) ?? [];
			current.push(participant);
			map.set(canonicalId, current);
		}
		for (const aliases of map.values()) {
			aliases.sort((a, b) => a.display_name.localeCompare(b.display_name));
		}
		return map;
	}, [participants, showAliases]);

	const sortedParticipants = useMemo(() => {
		return [...(participants ?? [])].sort((a, b) => {
			if (registeredFirst) {
				const aRegistered =
					a.participant_type === "registered_member" ||
					a.status === "active" ||
					a.status === "linked" ||
					a.user_id != null ||
					a.linked_user_id != null
						? 0
						: 1;
				const bRegistered =
					b.participant_type === "registered_member" ||
					b.status === "active" ||
					b.status === "linked" ||
					b.user_id != null ||
					b.linked_user_id != null
						? 0
						: 1;
				if (aRegistered !== bRegistered) return aRegistered - bRegistered;
			}
			const aPlaceholder = isPlaceholderParticipant(a) ? 0 : 1;
			const bPlaceholder = isPlaceholderParticipant(b) ? 0 : 1;
			if (aPlaceholder !== bPlaceholder) return aPlaceholder - bPlaceholder;
			return a.display_name.localeCompare(b.display_name);
		});
	}, [participants, registeredFirst]);

	const visibleParticipants = useMemo(
		() =>
			sortedParticipants.filter(
				(participant) => !isAliasParticipant(participant),
			),
		[sortedParticipants],
	);

	const displayedParticipants = useMemo(() => {
		const first =
			maxVisible == null
				? visibleParticipants
				: visibleParticipants.slice(0, maxVisible);
		if (selectedParticipantId == null) return first;
		const hasSelected = first.some(
			(participant) => String(participant.id) === String(selectedParticipantId),
		);
		if (hasSelected) return first;
		const selected = visibleParticipants.find(
			(participant) => String(participant.id) === String(selectedParticipantId),
		);
		if (selected) return [...first, selected];
		const selectedAlias = participantsById.get(Number(selectedParticipantId));
		if (selectedAlias?.canonical_participant_id == null) return first;
		const selectedCanonical = visibleParticipants.find(
			(participant) =>
				Number(participant.id) ===
				Number(selectedAlias.canonical_participant_id),
		);
		if (!selectedCanonical) return first;
		const hasCanonical = first.some(
			(participant) => Number(participant.id) === Number(selectedCanonical.id),
		);
		if (hasCanonical) return first;
		return [...first, selectedCanonical];
	}, [
		maxVisible,
		participantsById,
		selectedParticipantId,
		visibleParticipants,
	]);

	const visibleAliasCount = useMemo(() => {
		let count = 0;
		for (const aliases of aliasesByCanonicalId.values()) {
			count += aliases.length;
		}
		return count;
	}, [aliasesByCanonicalId]);

	useEffect(() => {
		if (selectedParticipantId == null) return;
		window.requestAnimationFrame(() => {
			document
				.getElementById(`space-participant-${String(selectedParticipantId)}`)
				?.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	}, [selectedParticipantId, visibleParticipants.length]);

	const startEditing = (participant: SpaceParticipant) => {
		if (readOnly) return;
		setEditingId(participant.id);
		setFormState(toFormState(participant));
		setError(null);
	};

	const stopEditing = () => {
		setEditingId(null);
		setFormState(null);
		setError(null);
	};

	const canAliasParticipant = (participant: SpaceParticipant): boolean =>
		!readOnly &&
		canLinkParticipants &&
		participant.participant_type !== "registered_member" &&
		participant.status !== "active" &&
		participant.status !== "linked" &&
		participant.status !== "archived" &&
		participant.user_id == null &&
		participant.linked_user_id == null;

	const aliasTargetsFor = (participant: SpaceParticipant): SpaceParticipant[] =>
		visibleParticipants.filter(
			(candidate) =>
				Number(candidate.id) !== Number(participant.id) &&
				candidate.status !== "archived",
		);

	const startLinking = (participant: SpaceParticipant) => {
		if (!canAliasParticipant(participant)) return;
		const targets = aliasTargetsFor(participant);
		setLinkingId(participant.id);
		setLinkTargetId(
			participant.canonical_participant_id ?? targets[0]?.id ?? null,
		);
		setError(null);
	};

	const stopLinking = () => {
		setLinkingId(null);
		setLinkTargetId(null);
		setError(null);
	};

	const canDeleteParticipant = (participant: SpaceParticipant): boolean =>
		!readOnly &&
		canRemoveParticipants &&
		participant.participant_type !== "registered_member" &&
		participant.status !== "active" &&
		participant.status !== "linked" &&
		participant.user_id == null &&
		participant.linked_user_id == null;

	const saveParticipant = async (participant: SpaceParticipant) => {
		if (!formState) return;
		const displayName = formState.displayName.trim();
		if (!displayName) {
			setError("Name is required.");
			return;
		}

		setSavingId(participant.id);
		setError(null);
		try {
			const updated = await apiClient.spaces.patchParticipant(
				spaceId,
				participant.id,
				{
					display_name: displayName,
					email: formState.email.trim(),
					telegram_username: cleanTelegram(formState.telegramUsername),
					contact_data: compactContactData(formState, participant.contact_data),
				},
			);
			onParticipantSaved(updated);
			stopEditing();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Failed to update participant.",
			);
		} finally {
			setSavingId(null);
		}
	};

	const inviteParticipant = async (participant: SpaceParticipant) => {
		if (readOnly) return;
		if (!participant.email?.trim()) {
			setError("Add an email before inviting this participant.");
			startEditing(participant);
			return;
		}

		setInvitingId(participant.id);
		setInviteToken(null);
		setInviteDelivery(null);
		setError(null);
		try {
			const result = await apiClient.spaces.inviteParticipant(
				spaceId,
				participant.id,
			);
			onParticipantSaved(result.participant);
			setInviteToken(result.token);
			setInviteDelivery({
				status: result.email_delivery_status,
				message: result.email_delivery_message,
			});
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Failed to invite participant.",
			);
		} finally {
			setInvitingId(null);
		}
	};

	const deleteParticipant = async (participant: SpaceParticipant) => {
		if (readOnly) return;
		setDeletingId(participant.id);
		setError(null);
		try {
			await apiClient.spaces.deleteParticipant(spaceId, participant.id);
			onParticipantDeleted?.(participant.id);
			setConfirmDeleteId(null);
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Failed to remove participant.",
			);
		} finally {
			setDeletingId(null);
		}
	};

	const saveParticipantAlias = async (participant: SpaceParticipant) => {
		if (!linkTargetId) {
			setError("Choose who this participant should resolve to.");
			return;
		}
		setSavingLinkId(participant.id);
		setError(null);
		try {
			const updated = await apiClient.spaces.linkParticipant(
				spaceId,
				participant.id,
				{ canonical_participant_id: linkTargetId },
			);
			onParticipantSaved(updated);
			stopLinking();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to link participant.");
		} finally {
			setSavingLinkId(null);
		}
	};

	const unlinkParticipantAlias = async (participant: SpaceParticipant) => {
		setSavingLinkId(participant.id);
		setError(null);
		try {
			const updated = await apiClient.spaces.linkParticipant(
				spaceId,
				participant.id,
				{ canonical_participant_id: null },
			);
			onParticipantSaved(updated);
			if (linkingId === participant.id) stopLinking();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "Failed to unlink participant.",
			);
		} finally {
			setSavingLinkId(null);
		}
	};

	return (
		<div
			className={[
				"px-5 py-5",
				showTopBorder ? "border-t border-[rgba(95,105,125,0.1)]" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{showHeader ? (
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h3 className="text-sm font-bold tracking-tight text-foreground">
							{title}
						</h3>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							{description}
						</p>
					</div>
					<span className="rounded-full bg-[rgba(120,132,150,0.12)] px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
						{visibleParticipants.length}
						{visibleAliasCount ? ` +${visibleAliasCount}` : ""}
					</span>
				</div>
			) : null}

			{error ? (
				<div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			) : null}
			{inviteToken ? (
				<div className="mt-3">
					<div className="mb-2 rounded-lg border border-[rgba(90,130,98,0.24)] bg-[rgba(120,154,124,0.12)] px-3 py-2 text-xs font-medium text-[#214027]">
						{inviteDelivery?.status === "sent"
							? "Invite email sent. You can also share this link manually."
							: inviteDelivery?.status === "failed"
								? "Invite created, but email delivery failed. Share this link manually."
								: "Invite created. Share this link with the participant."}
						{inviteDelivery?.message ? (
							<span className="mt-1 block text-[11px] text-[#5a3920]">
								{inviteDelivery.message}
							</span>
						) : null}
					</div>
					<InviteLinkSharePanel token={inviteToken} />
				</div>
			) : null}

			<ul className="mt-4 space-y-2">
				{visibleParticipants.length === 0 ? (
					<li className="rounded-xl border border-dashed border-[rgba(95,105,125,0.2)] bg-white/45 px-4 py-3 text-sm text-muted-foreground">
						{emptyText}
					</li>
				) : null}
				{displayedParticipants.map((participant) => {
					const isEditing = editingId === participant.id;
					const isSaving = savingId === participant.id;
					const isInviting = invitingId === participant.id;
					const isDeleting = deletingId === participant.id;
					const isConfirmingDelete = confirmDeleteId === participant.id;
					const isSelected =
						selectedParticipantId != null &&
						String(selectedParticipantId) === String(participant.id);
					const isRegistered =
						participant.participant_type === "registered_member" ||
						participant.status === "active" ||
						participant.status === "linked";
					const canInvite =
						participant.email?.trim() &&
						!isRegistered &&
						participant.status !== "invited";
					const canDelete = canDeleteParticipant(participant);
					const notes = participantNotes(participant);
					const baseEntity = toSpaceParticipantEntity(participant, {
						selected: isSelected,
					});
					const entity = stateOnly
						? {
								...baseEntity,
								label: participantStateLabel(participant),
								subtitle: undefined,
								detail: undefined,
								meta: [],
								status: undefined,
							}
						: baseEntity;
					const aliasTarget =
						participant.canonical_participant_id != null
							? participantsById.get(
									Number(participant.canonical_participant_id),
								)
							: null;
					const canAlias = canAliasParticipant(participant);
					const aliasTargets = canAlias ? aliasTargetsFor(participant) : [];
					const isLinking = linkingId === participant.id;
					const isSavingLink = savingLinkId === participant.id;
					const aliases =
						aliasesByCanonicalId.get(Number(participant.id)) ?? [];
					const sourceDocumentId = participant.source_document_id;
					const participantActions = readOnly ? null : (
						<span className="flex shrink-0 flex-wrap items-center gap-2">
							{isSelected ? (
								<span className="rounded-full border border-[rgba(160,120,70,0.28)] bg-[rgba(255,236,200,0.58)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#68400e]">
									Selected
								</span>
							) : null}
							<button
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								onClick={() => startEditing(participant)}
								title="Edit participant"
								type="button"
							>
								<Pencil className="h-4 w-4" />
							</button>
							{canAlias ? (
								aliasTarget ? (
									<button
										className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(100,118,160,0.24)] bg-[rgba(100,118,160,0.1)] text-[#2f426b] transition hover:bg-[rgba(100,118,160,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
										disabled={isSavingLink}
										onClick={() => void unlinkParticipantAlias(participant)}
										title="Unlink participant alias"
										type="button"
									>
										<Unlink2 className="h-4 w-4" />
									</button>
								) : (
									<button
										className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(100,118,160,0.24)] bg-[rgba(100,118,160,0.1)] text-[#2f426b] transition hover:bg-[rgba(100,118,160,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
										disabled={isSavingLink || aliasTargets.length === 0}
										onClick={() => startLinking(participant)}
										title="Link participant alias"
										type="button"
									>
										<Link2 className="h-4 w-4" />
									</button>
								)
							) : null}
							<button
								className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(90,130,98,0.28)] bg-[rgba(120,154,124,0.14)] text-[#24452b] transition hover:bg-[rgba(120,154,124,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
								disabled={isInviting || !canInvite}
								onClick={() => void inviteParticipant(participant)}
								title={
									canInvite
										? "Invite participant"
										: participant.status === "invited"
											? "Invite already created"
											: isRegistered
												? "Participant already registered"
												: "Add email before inviting"
								}
								type="button"
							>
								<MailPlus className="h-4 w-4" />
							</button>
							{canDelete ? (
								isConfirmingDelete ? (
									<span className="inline-flex items-center gap-1 rounded-full border border-[rgba(150,70,45,0.28)] bg-[rgba(150,70,45,0.08)] px-1.5 py-1">
										<button
											className="inline-flex h-7 items-center rounded-full px-2 text-[11px] font-bold text-[#74341f] transition hover:bg-[rgba(150,70,45,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
											disabled={isDeleting}
											onClick={() => void deleteParticipant(participant)}
											type="button"
										>
											{isDeleting ? "Removing..." : "Remove"}
										</button>
										<button
											className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											disabled={isDeleting}
											onClick={() => setConfirmDeleteId(null)}
											title="Cancel remove"
											type="button"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</span>
								) : (
									<button
										className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(150,70,45,0.22)] bg-[rgba(150,70,45,0.08)] text-[#74341f] transition hover:bg-[rgba(150,70,45,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => setConfirmDeleteId(participant.id)}
										title="Remove participant"
										type="button"
									>
										<Trash2 className="h-4 w-4" />
									</button>
								)
							) : null}
						</span>
					);

					return (
						<li
							className={[
								"scroll-mt-28 transition-[border-color,background-color,box-shadow]",
								isEditing
									? [
											"rounded-xl border p-3 shadow-[0_8px_18px_-18px_rgba(45,48,58,0.25)]",
											isSelected
												? "border-[rgba(160,120,70,0.45)] bg-[rgba(255,249,235,0.9)] shadow-[0_14px_28px_-18px_rgba(120,75,28,0.32)] ring-2 ring-[rgba(200,155,95,0.2)]"
												: "border-[rgba(95,105,125,0.12)] bg-white/55",
										].join(" ")
									: "",
							].join(" ")}
							id={`space-participant-${String(participant.id)}`}
							key={participant.id}
						>
							{isEditing && formState ? (
								<div className="grid gap-2">
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Name
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setFormState((current) =>
													current
														? {
																...current,
																displayName: event.target.value,
															}
														: current,
												)
											}
											value={formState.displayName}
										/>
									</label>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Email
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setFormState((current) =>
													current
														? { ...current, email: event.target.value }
														: current,
												)
											}
											type="email"
											value={formState.email}
										/>
									</label>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Telegram
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setFormState((current) =>
													current
														? {
																...current,
																telegramUsername: event.target.value,
															}
														: current,
												)
											}
											placeholder="@username"
											value={formState.telegramUsername}
										/>
									</label>
									<div className="grid gap-2 sm:grid-cols-2">
										<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
											Phone
											<input
												className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
												onChange={(event) =>
													setFormState((current) =>
														current
															? { ...current, phone: event.target.value }
															: current,
													)
												}
												type="tel"
												value={formState.phone}
											/>
										</label>
										<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
											WhatsApp
											<input
												className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
												onChange={(event) =>
													setFormState((current) =>
														current
															? { ...current, whatsapp: event.target.value }
															: current,
													)
												}
												type="tel"
												value={formState.whatsapp}
											/>
										</label>
									</div>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Contact notes
										<textarea
											className="min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setFormState((current) =>
													current
														? { ...current, notes: event.target.value }
														: current,
												)
											}
											value={formState.notes}
										/>
									</label>
									<div className="flex items-center justify-end gap-2 pt-1">
										<button
											className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											disabled={isSaving}
											onClick={stopEditing}
											title="Cancel"
											type="button"
										>
											<X className="h-4 w-4" />
										</button>
										<button
											className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
											disabled={isSaving}
											onClick={() => void saveParticipant(participant)}
											title="Save"
											type="button"
										>
											<Check className="h-4 w-4" />
										</button>
									</div>
								</div>
							) : (
								<div className="space-y-2">
									{stateOnly ? (
										<>
											<div
												className={[
													"flex min-w-0 items-center gap-2 rounded-xl border bg-white/48 px-2.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.75)]",
													isSelected
														? "border-[rgba(160,120,70,0.38)] ring-2 ring-[rgba(200,155,95,0.18)]"
														: "border-[rgba(95,105,125,0.12)]",
												].join(" ")}
											>
												<EntityIcon
													size="sm"
													visualKey={baseEntity.visualKey}
												/>
												<span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
													{participantDisplayName(participant)}
												</span>
												<span
													className={[
														"shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
														participantStateClassName(participant),
													].join(" ")}
												>
													{participantStateLabel(participant)}
												</span>
											</div>
											{sourceDocumentId != null ? (
												<div className="ml-9 flex flex-wrap gap-1.5">
													<a
														className="inline-flex w-fit items-center rounded-full border border-blue-200/80 bg-blue-50/70 px-2.5 py-1 text-[11px] font-semibold text-blue-900 transition hover:bg-blue-100"
														href={sourceCaptureReviewHref(
															spaceId,
															sourceDocumentId,
														)}
													>
														Source capture #{sourceDocumentId}
													</a>
													<a
														className="inline-flex w-fit items-center rounded-full border border-blue-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-blue-900 transition hover:bg-blue-50"
														href={sourceCaptureReviewHref(
															spaceId,
															sourceDocumentId,
														)}
													>
														Review capture
													</a>
												</div>
											) : null}
										</>
									) : (
										<WorkspaceEntityCard
											footer={
												participantActions ? (
													<div className="flex justify-end">
														{participantActions}
													</div>
												) : null
											}
											selected={isSelected}
											summary={
												<div className="flex min-w-0 items-start gap-3">
													<EntityIcon
														className="mt-0.5 h-11 w-11 rounded-xl shadow-inner"
														size="md"
														visualKey={entity.visualKey}
													/>
													<div className="min-w-0 flex-1">
														<div className="flex flex-wrap items-center gap-2">
															<span
																className={[
																	"rounded-full border px-2 py-0.5 text-[11px] font-semibold",
																	participantStateClassName(participant),
																].join(" ")}
															>
																{participantStateLabel(participant)}
															</span>
															{entity.status ? (
																<span
																	className={[
																		"rounded-full border px-2 py-0.5 text-[11px] font-semibold",
																		entity.statusClassName,
																	].join(" ")}
																>
																	{entity.status}
																</span>
															) : null}
														</div>
														<p className="mt-1 line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground">
															{entity.title}
														</p>
														{entity.subtitle ? (
															<p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
																{entity.subtitle}
															</p>
														) : null}
														{entity.detail ? (
															<p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
																{entity.detail}
															</p>
														) : null}
													</div>
												</div>
											}
											tone={
												isPlaceholderParticipant(participant) ||
												isAliasParticipant(participant)
													? "muted"
													: participant.status === "invited"
														? "attention"
														: "default"
											}
										>
											<div className="space-y-2">
												{notes ? (
													<p className="text-xs leading-relaxed text-muted-foreground">
														{notes}
													</p>
												) : null}
												{aliasTarget ? (
													<p className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(100,118,160,0.18)] bg-[rgba(100,118,160,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#2f426b]">
														<Link2 className="h-3.5 w-3.5" />
														Alias of {aliasTarget.display_name}. Stats resolve
														there.
													</p>
												) : null}
												{sourceDocumentId != null ? (
													<div className="flex flex-wrap gap-1.5">
														<a
															className="inline-flex w-fit items-center rounded-full border border-blue-200/80 bg-blue-50/70 px-2.5 py-1 text-[11px] font-semibold text-blue-900 transition hover:bg-blue-100"
															href={sourceCaptureReviewHref(
																spaceId,
																sourceDocumentId,
															)}
														>
															Source capture #{sourceDocumentId}
														</a>
														<a
															className="inline-flex w-fit items-center rounded-full border border-blue-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-blue-900 transition hover:bg-blue-50"
															href={sourceCaptureReviewHref(
																spaceId,
																sourceDocumentId,
															)}
														>
															Review capture
														</a>
													</div>
												) : null}
												{aliases.length > 0 ? (
													<div className="rounded-xl border border-[rgba(100,118,160,0.16)] bg-background/45 px-3 py-2">
														<p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4b5c80]">
															Aliases
														</p>
														<div className="mt-2 flex flex-wrap gap-2">
															{aliases.map((alias) => {
																const isAliasUnlinking =
																	savingLinkId === alias.id;
																return (
																	<span
																		className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(100,118,160,0.2)] bg-background/72 px-2.5 py-1 text-[11px] font-semibold text-[#2f426b]"
																		key={alias.id}
																	>
																		<Link2 className="h-3.5 w-3.5" />
																		{alias.display_name}
																		{canLinkParticipants && !readOnly ? (
																			<button
																				className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#2f426b] transition hover:bg-[rgba(100,118,160,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
																				disabled={isAliasUnlinking}
																				onClick={() =>
																					void unlinkParticipantAlias(alias)
																				}
																				title={`Restore ${alias.display_name} as a separate participant`}
																				type="button"
																			>
																				<Unlink2 className="h-3.5 w-3.5" />
																			</button>
																		) : null}
																	</span>
																);
															})}
														</div>
													</div>
												) : null}
												{isLinking ? (
													<div className="rounded-xl border border-[rgba(100,118,160,0.2)] bg-background/45 p-3">
														<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
															Resolve this name to
															<select
																className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
																onChange={(event) =>
																	setLinkTargetId(Number(event.target.value))
																}
																value={linkTargetId ?? ""}
															>
																{aliasTargets.map((target) => (
																	<option key={target.id} value={target.id}>
																		{target.display_name} ·{" "}
																		{target.participant_type}
																	</option>
																))}
															</select>
														</label>
														<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
															The original name stays visible, but split stats
															and future attribution can resolve to the selected
															participant.
														</p>
														<div className="mt-3 flex justify-end gap-2">
															<button
																className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
																disabled={isSavingLink}
																onClick={stopLinking}
																type="button"
															>
																Cancel
															</button>
															<button
																className="inline-flex h-8 items-center rounded-full bg-foreground px-3 text-xs font-bold text-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
																disabled={isSavingLink || !linkTargetId}
																onClick={() =>
																	void saveParticipantAlias(participant)
																}
																type="button"
															>
																{isSavingLink ? "Linking..." : "Link alias"}
															</button>
														</div>
													</div>
												) : null}
											</div>
										</WorkspaceEntityCard>
									)}
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
};
