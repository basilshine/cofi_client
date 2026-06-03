import type { SpaceMember, SpaceParticipant } from "@cofi/api";

export type SplitPercentRow = {
	user_id?: number | null;
	space_participant_id?: number | null;
	label: string;
	percent: string;
};

export const splitRowKey = (row: SplitPercentRow): string =>
	row.space_participant_id != null
		? `participant:${row.space_participant_id}`
		: `user:${row.user_id ?? "unknown"}`;

export const splitParticipantLabel = (participant: SpaceParticipant): string =>
	participant.display_name?.trim() ||
	participant.email?.trim() ||
	(participant.user_id != null
		? `User #${participant.user_id}`
		: `Participant #${participant.id}`);

const participantRowsFromMembers = (
	members: SpaceMember[],
): SplitPercentRow[] =>
	members.map((member) => ({
		user_id: Number(member.user_id),
		label:
			member.name?.trim() || member.email?.trim() || `User #${member.user_id}`,
		percent: "0",
	}));

export const splitRowsFromParticipants = (
	participants: SpaceParticipant[],
	members: SpaceMember[],
): SplitPercentRow[] => {
	if (participants.length === 0) return participantRowsFromMembers(members);
	return participants.map((participant) => ({
		user_id: participant.user_id ?? participant.linked_user_id ?? null,
		space_participant_id: participant.id,
		label: splitParticipantLabel(participant),
		percent: "0",
	}));
};

export const applyAmountsToSplitRows = (
	rows: SplitPercentRow[],
	splits: {
		user_id?: number | null;
		space_participant_id?: number | null;
		amount: number;
	}[],
	total: number,
): SplitPercentRow[] => {
	const byParticipant = new Map(
		splits
			.filter((split) => split.space_participant_id != null)
			.map((split) => [
				Number(split.space_participant_id),
				Number(split.amount) || 0,
			]),
	);
	const byUser = new Map(
		splits
			.filter((split) => split.user_id != null)
			.map((split) => [Number(split.user_id), Number(split.amount) || 0]),
	);
	return rows.map((row) => {
		const amount =
			row.space_participant_id != null
				? (byParticipant.get(Number(row.space_participant_id)) ?? 0)
				: row.user_id != null
					? (byUser.get(Number(row.user_id)) ?? 0)
					: 0;
		const pct = total > 0 ? (amount / total) * 100 : 0;
		return { ...row, percent: String(Math.round(pct * 100) / 100) };
	});
};

export const ownerHundredSplitRows = (
	rows: SplitPercentRow[],
	ownerUserId: number,
): SplitPercentRow[] => {
	let matchedOwner = false;
	const next = rows.map((row) => {
		const isOwner = row.user_id != null && Number(row.user_id) === ownerUserId;
		if (isOwner) matchedOwner = true;
		return { ...row, percent: isOwner ? "100" : "0" };
	});
	if (matchedOwner || next.length === 0) return next;
	return next.map((row, index) => ({
		...row,
		percent: index === 0 ? "100" : "0",
	}));
};

export const equalSplitRows = (rows: SplitPercentRow[]): SplitPercentRow[] => {
	const n = rows.length;
	if (n <= 0) return [];
	const eq = 100 / n;
	return rows.map((row, index) => ({
		...row,
		percent:
			index === n - 1
				? String(Math.round((100 - eq * (n - 1)) * 100) / 100)
				: String(Math.round(eq * 100) / 100),
	}));
};

/** Percents to amounts; last row absorbs rounding drift. */
export const percentsToAmounts = (pcts: number[], total: number): number[] => {
	const n = pcts.length;
	if (n === 0) return [];
	const raw = pcts.map((pct) => (total * pct) / 100);
	const rounded = raw.map((amount) => Math.round(amount * 100) / 100);
	const sum = rounded.reduce((acc, amount) => acc + amount, 0);
	const drift = Math.round((total - sum) * 100) / 100;
	if (n > 0 && Math.abs(drift) >= 0.001) {
		const lastIdx = n - 1;
		const last = rounded[lastIdx];
		if (last !== undefined) {
			rounded[lastIdx] = Math.round((last + drift) * 100) / 100;
		}
	}
	return rounded;
};

export const userCanManageExpenseSplits = (
	expenseOwnerUserId: number | null | undefined,
	members: SpaceMember[],
	currentUserId: number,
): boolean => {
	const isExpenseOwner =
		expenseOwnerUserId != null &&
		Number(expenseOwnerUserId) === Number(currentUserId);
	const isSpaceOwner = members.some(
		(member) =>
			Number(member.user_id) === Number(currentUserId) &&
			member.role === "owner",
	);
	return isExpenseOwner || isSpaceOwner;
};
