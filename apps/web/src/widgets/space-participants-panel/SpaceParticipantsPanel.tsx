import type { SpaceParticipant } from "@cofi/api";
import { Check, MailPlus, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";
import { InviteLinkSharePanel } from "../space-invite-management";

type ParticipantDraft = {
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
	selectedParticipantId?: string | number | null;
	showTopBorder?: boolean;
};

const participantTypeLabel = (value: string): string => {
	const normalized = value.trim().toLowerCase();
	if (normalized === "registered_member") return "Registered";
	if (normalized === "invited_member") return "Invited";
	if (normalized === "external_participant") return "External";
	if (normalized === "placeholder") return "Placeholder";
	return normalized ? normalized.replace(/_/g, " ") : "Participant";
};

const participantStatusLabel = (value: string): string => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return "Draft";
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const contactString = (
	contactData: Record<string, unknown> | undefined,
	key: string,
): string => {
	const value = contactData?.[key];
	return typeof value === "string" ? value : "";
};

const toDraft = (participant: SpaceParticipant): ParticipantDraft => ({
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
	draft: ParticipantDraft,
	existing: Record<string, unknown> | undefined,
): Record<string, unknown> => {
	const next = { ...(existing ?? {}) };
	const values = {
		phone: draft.phone.trim(),
		whatsapp: draft.whatsapp.trim(),
		notes: draft.notes.trim(),
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

export const SpaceParticipantsPanel = ({
	spaceId,
	participants,
	onParticipantSaved,
	selectedParticipantId = null,
	showTopBorder = true,
}: SpaceParticipantsPanelProps) => {
	const [editingId, setEditingId] = useState<number | null>(null);
	const [draft, setDraft] = useState<ParticipantDraft | null>(null);
	const [savingId, setSavingId] = useState<number | null>(null);
	const [invitingId, setInvitingId] = useState<number | null>(null);
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [inviteDelivery, setInviteDelivery] = useState<{
		status?: "sent" | "skipped" | "failed";
		message?: string;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);

	const visibleParticipants = useMemo(() => {
		return [...(participants ?? [])].sort((a, b) => {
			const aPlaceholder = a.status === "placeholder" ? 0 : 1;
			const bPlaceholder = b.status === "placeholder" ? 0 : 1;
			if (aPlaceholder !== bPlaceholder) return aPlaceholder - bPlaceholder;
			return a.display_name.localeCompare(b.display_name);
		});
	}, [participants]);

	const displayedParticipants = useMemo(() => {
		const first = visibleParticipants.slice(0, 8);
		if (selectedParticipantId == null) return first;
		const hasSelected = first.some(
			(participant) => String(participant.id) === String(selectedParticipantId),
		);
		if (hasSelected) return first;
		const selected = visibleParticipants.find(
			(participant) => String(participant.id) === String(selectedParticipantId),
		);
		return selected ? [...first, selected] : first;
	}, [selectedParticipantId, visibleParticipants]);

	useEffect(() => {
		if (selectedParticipantId == null) return;
		window.requestAnimationFrame(() => {
			document
				.getElementById(`space-participant-${String(selectedParticipantId)}`)
				?.scrollIntoView({ behavior: "smooth", block: "center" });
		});
	}, [selectedParticipantId, visibleParticipants.length]);

	const startEditing = (participant: SpaceParticipant) => {
		setEditingId(participant.id);
		setDraft(toDraft(participant));
		setError(null);
	};

	const stopEditing = () => {
		setEditingId(null);
		setDraft(null);
		setError(null);
	};

	const saveParticipant = async (participant: SpaceParticipant) => {
		if (!draft) return;
		const displayName = draft.displayName.trim();
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
					email: draft.email.trim(),
					telegram_username: cleanTelegram(draft.telegramUsername),
					contact_data: compactContactData(draft, participant.contact_data),
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

	return (
		<div
			className={[
				"px-5 py-5",
				showTopBorder ? "border-t border-[rgba(95,105,125,0.1)]" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="text-sm font-bold tracking-tight text-foreground">
						Split participants
					</h3>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						People from receipts and splits, including placeholders.
					</p>
				</div>
				<span className="rounded-full bg-[rgba(120,132,150,0.12)] px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground">
					{visibleParticipants.length}
				</span>
			</div>

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
						No split participants yet.
					</li>
				) : null}
				{displayedParticipants.map((participant) => {
					const isEditing = editingId === participant.id;
					const isSaving = savingId === participant.id;
					const isInviting = invitingId === participant.id;
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
					const label =
						participant.display_name?.trim() ||
						participant.email?.trim() ||
						`Participant ${participant.id}`;
					const phone = contactString(participant.contact_data, "phone").trim();
					const whatsapp = contactString(
						participant.contact_data,
						"whatsapp",
					).trim();
					const notes = contactString(participant.contact_data, "notes").trim();
					const contactLine = [
						participant.email?.trim(),
						participant.telegram_username?.trim()
							? `@${cleanTelegram(participant.telegram_username)}`
							: "",
						phone ? `phone ${phone}` : "",
						whatsapp ? `WhatsApp ${whatsapp}` : "",
					]
						.filter(Boolean)
						.join(" · ");

					return (
						<li
							className={[
								"rounded-xl border p-3 shadow-[0_8px_18px_-18px_rgba(45,48,58,0.25)] transition-[border-color,background-color,box-shadow]",
								isSelected
									? "border-[rgba(160,120,70,0.45)] bg-[rgba(255,249,235,0.9)] shadow-[0_14px_28px_-18px_rgba(120,75,28,0.32)] ring-2 ring-[rgba(200,155,95,0.2)]"
									: "border-[rgba(95,105,125,0.12)] bg-white/55",
							].join(" ")}
							id={`space-participant-${String(participant.id)}`}
							key={participant.id}
						>
							{isEditing && draft ? (
								<div className="grid gap-2">
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Name
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setDraft((current) =>
													current
														? {
																...current,
																displayName: event.target.value,
															}
														: current,
												)
											}
											value={draft.displayName}
										/>
									</label>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Email
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setDraft((current) =>
													current
														? { ...current, email: event.target.value }
														: current,
												)
											}
											type="email"
											value={draft.email}
										/>
									</label>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Telegram
										<input
											className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setDraft((current) =>
													current
														? {
																...current,
																telegramUsername: event.target.value,
															}
														: current,
												)
											}
											placeholder="@username"
											value={draft.telegramUsername}
										/>
									</label>
									<div className="grid gap-2 sm:grid-cols-2">
										<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
											Phone
											<input
												className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
												onChange={(event) =>
													setDraft((current) =>
														current
															? { ...current, phone: event.target.value }
															: current,
													)
												}
												type="tel"
												value={draft.phone}
											/>
										</label>
										<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
											WhatsApp
											<input
												className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
												onChange={(event) =>
													setDraft((current) =>
														current
															? { ...current, whatsapp: event.target.value }
															: current,
													)
												}
												type="tel"
												value={draft.whatsapp}
											/>
										</label>
									</div>
									<label className="grid gap-1 text-xs font-semibold text-muted-foreground">
										Contact notes
										<textarea
											className="min-h-16 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
											onChange={(event) =>
												setDraft((current) =>
													current
														? { ...current, notes: event.target.value }
														: current,
												)
											}
											value={draft.notes}
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
								<div className="flex items-start gap-3">
									<span
										aria-hidden
										className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(108,128,108,0.18)] text-sm font-bold uppercase text-[#2d3a2d]"
									>
										{label.charAt(0).toUpperCase()}
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex min-w-0 flex-wrap items-center gap-2">
											<p className="truncate text-sm font-semibold text-foreground">
												{label}
											</p>
											<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
												{participantStatusLabel(participant.status)}
											</span>
											{isSelected ? (
												<span className="rounded-full border border-[rgba(160,120,70,0.28)] bg-[rgba(255,236,200,0.58)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#68400e]">
													Selected
												</span>
											) : null}
										</div>
										<p className="mt-1 truncate text-xs text-muted-foreground">
											{participantTypeLabel(participant.participant_type)}
											{participant.user_id
												? ` · user ${participant.user_id}`
												: ""}
										</p>
										{contactLine ? (
											<p className="mt-1 truncate text-xs font-medium text-foreground/75">
												{contactLine}
											</p>
										) : (
											<p className="mt-1 text-xs text-muted-foreground/80">
												No contact yet
											</p>
										)}
										{notes ? (
											<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
												{notes}
											</p>
										) : null}
									</div>
									<button
										className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() => startEditing(participant)}
										title="Edit participant"
										type="button"
									>
										<Pencil className="h-4 w-4" />
									</button>
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
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
};
