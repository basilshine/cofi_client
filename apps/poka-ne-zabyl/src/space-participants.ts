export type SelectableSpaceParticipant = {
	id: number;
	space_id: number;
	user_id?: number;
	linked_user_id?: number;
	display_name: string;
	status: string;
	email?: string;
	canonical_participant_id?: number;
};

const participantIdentityKeys = (
	participant: SelectableSpaceParticipant,
): string[] => {
	const userID = participant.user_id || participant.linked_user_id;
	const email = participant.email?.trim().toLocaleLowerCase();
	const keys = [
		userID ? `user:${userID}` : "",
		email ? `email:${email}` : "",
	].filter(Boolean);
	return keys.length > 0 ? keys : [`participant:${participant.id}`];
};

const participantPriority = (participant: SelectableSpaceParticipant) =>
	(participant.user_id ? 4 : 0) +
	(["active", "accepted"].includes(participant.status) ? 2 : 0) +
	(participant.linked_user_id ? 1 : 0);

export const selectableParticipantsForSpace = <
	T extends SelectableSpaceParticipant,
>(
	participants: T[],
	spaceID: number,
): T[] => {
	const result: T[] = [];
	const indexByIdentity = new Map<string, number>();

	for (const participant of participants) {
		if (
			participant.space_id !== spaceID ||
			participant.status === "archived" ||
			participant.canonical_participant_id
		)
			continue;

		const keys = participantIdentityKeys(participant);
		const existingIndex = keys
			.map((key) => indexByIdentity.get(key))
			.find((index): index is number => index !== undefined);

		if (existingIndex === undefined) {
			const nextIndex = result.push(participant) - 1;
			for (const key of keys) indexByIdentity.set(key, nextIndex);
			continue;
		}

		if (
			participantPriority(participant) >
			participantPriority(result[existingIndex])
		) {
			result[existingIndex] = participant;
		}
		for (const key of keys) indexByIdentity.set(key, existingIndex);
	}

	return result;
};

export const nextGuestDisplayName = (
	participants: Pick<SelectableSpaceParticipant, "display_name">[],
	guestLabel: string,
) => {
	const names = new Set(
		participants.map((participant) =>
			participant.display_name.trim().toLocaleLowerCase(),
		),
	);
	let index = 1;
	while (names.has(`${guestLabel} ${index}`.toLocaleLowerCase())) index += 1;
	return `${guestLabel} ${index}`;
};
