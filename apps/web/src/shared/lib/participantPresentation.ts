import type { SpaceParticipant } from "@cofi/api";
import type { EntityViewModel } from "./entityPresentation";

export const participantTypeLabel = (value?: string | null): string => {
	const normalized = value?.trim().toLowerCase() ?? "";
	if (normalized === "registered_member") return "Registered";
	if (normalized === "invited_member") return "Invited";
	if (normalized === "external_participant") return "External";
	if (normalized === "placeholder") return "Placeholder";
	return normalized ? normalized.replace(/_/g, " ") : "Participant";
};

export const participantStatusLabel = (value?: string | null): string => {
	const normalized = value?.trim().toLowerCase() ?? "";
	if (!normalized) return "Draft";
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const participantDisplayName = (participant: SpaceParticipant): string =>
	participant.display_name?.trim() ||
	participant.email?.trim() ||
	`Participant ${participant.id}`;

const contactString = (
	contactData: Record<string, unknown> | undefined,
	key: string,
): string => {
	const value = contactData?.[key];
	return typeof value === "string" ? value.trim() : "";
};

const cleanTelegram = (value: string): string =>
	value.trim().replace(/^@+/, "");

export const participantContactSummary = (
	participant: SpaceParticipant,
): string => {
	const phone = contactString(participant.contact_data, "phone");
	const whatsapp = contactString(participant.contact_data, "whatsapp");
	return [
		participant.email?.trim(),
		participant.telegram_username?.trim()
			? `@${cleanTelegram(participant.telegram_username)}`
			: "",
		phone ? `phone ${phone}` : "",
		whatsapp ? `WhatsApp ${whatsapp}` : "",
	]
		.filter(Boolean)
		.join(" · ");
};

export const participantNotes = (participant: SpaceParticipant): string =>
	contactString(participant.contact_data, "notes");

export const isPlaceholderParticipant = (
	participant: SpaceParticipant,
): boolean =>
	participant.participant_type === "placeholder" ||
	participant.status === "placeholder";

const participantStatusClass = (participant: SpaceParticipant): string => {
	const status = participant.status?.trim().toLowerCase() ?? "";
	if (status === "active" || status === "linked") {
		return "border-[rgba(72,107,82,0.18)] bg-[rgba(247,252,248,0.78)] text-[#365f42]";
	}
	if (status === "invited") {
		return "border-[rgba(172,124,35,0.18)] bg-[rgba(255,250,236,0.76)] text-[#7a5514]";
	}
	if (isPlaceholderParticipant(participant)) {
		return "border-[rgba(64,91,118,0.16)] bg-[rgba(249,253,255,0.78)] text-[#34556f]";
	}
	return "border-border/60 bg-muted/55 text-muted-foreground";
};

export const toSpaceParticipantEntity = (
	participant: SpaceParticipant,
	options: { selected?: boolean } = {},
): EntityViewModel => {
	const contact = participantContactSummary(participant);
	const type = participantTypeLabel(participant.participant_type);
	const user = participant.user_id ? `user ${participant.user_id}` : "";
	const isPlaceholder = isPlaceholderParticipant(participant);
	const status = participantStatusLabel(participant.status);
	const statusDuplicatesType =
		status.toLowerCase() === type.toLowerCase() ||
		(isPlaceholder && status.toLowerCase() === "placeholder");
	const placeholderSubtitle = user || "From capture, split, or manual entry";
	return {
		id: String(participant.id),
		visualKey: isPlaceholder ? "placeholder" : "people",
		label: isPlaceholder ? "Placeholder" : "Participant",
		title: participantDisplayName(participant),
		subtitle: isPlaceholder
			? placeholderSubtitle
			: [type, user].filter(Boolean).join(" · "),
		detail: contact || "No contact yet",
		meta: [],
		status: statusDuplicatesType ? undefined : status,
		statusClassName: participantStatusClass(participant),
		selected: options.selected,
	};
};
