export type SplitSettlementEvidence = {
	key: string;
	amount: number;
	note?: string;
	mediaObjectID?: number;
	sentAt?: string;
	obligationCount: number;
};

type SplitSettlementEvidenceInput = {
	splitID: number;
	amount: number;
	note?: string;
	mediaObjectID?: number;
	sentAt?: string;
};

const evidenceKey = (input: SplitSettlementEvidenceInput) => {
	if (input.mediaObjectID) return `media:${input.mediaObjectID}`;
	if (input.sentAt) return `sent:${input.sentAt}:${input.note || ""}`;
	return `split:${input.splitID}`;
};

export const mergeSplitSettlementEvidence = (
	current: SplitSettlementEvidence[],
	input: SplitSettlementEvidenceInput,
): SplitSettlementEvidence[] => {
	const key = evidenceKey(input);
	const existing = current.find((item) => item.key === key);
	const next = existing
		? current.map((item) =>
				item.key === key
					? {
							...item,
							amount: item.amount + input.amount,
							obligationCount: item.obligationCount + 1,
						}
					: item,
			)
		: [
				...current,
				{
					key,
					amount: input.amount,
					note: input.note,
					mediaObjectID: input.mediaObjectID,
					sentAt: input.sentAt,
					obligationCount: 1,
				},
			];

	return next.sort((left, right) =>
		(right.sentAt || "").localeCompare(left.sentAt || ""),
	);
};
