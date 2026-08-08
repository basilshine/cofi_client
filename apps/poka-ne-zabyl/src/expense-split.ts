export const equalSplitAmounts = (total: number, participantIDs: number[]) => {
	const amounts = new Map<number, number>();
	if (participantIDs.length === 0) return amounts;
	const cents = Math.round(total * 100);
	const base = Math.floor(cents / participantIDs.length);
	let remainder = cents - base * participantIDs.length;
	for (const participantID of participantIDs) {
		const amount = base + (remainder > 0 ? 1 : 0);
		if (remainder > 0) remainder -= 1;
		amounts.set(participantID, amount / 100);
	}
	return amounts;
};

export const fullSplitAmount = (total: number, participantID: number) =>
	new Map([[participantID, Math.round(total * 100) / 100]]);

export const splitDistributionIsValid = (
	total: number,
	amounts: Map<number, number>,
	payerParticipantID: number,
) => {
	if (payerParticipantID <= 0 || amounts.size === 0) return false;
	const distributed = Array.from(amounts.values()).reduce(
		(sum, amount) => sum + amount,
		0,
	);
	return Math.abs(total - distributed) <= 0.02;
};
