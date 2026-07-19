export type SpaceInviteSuggestion = {
	user_id: number;
	name: string;
	email?: string;
	relationship_label?: string;
};

export type PendingSpaceInvite = {
	id: number;
	invitee_email: string;
	token: string;
	expires_at: string;
};

export const availableInviteSuggestions = (
	suggestions: SpaceInviteSuggestion[],
	pending: PendingSpaceInvite[],
	query: string,
) => {
	const value = query.trim().toLocaleLowerCase("ru");
	const pendingEmails = new Set(
		pending.map(({ invitee_email }) => invitee_email.toLocaleLowerCase()),
	);
	return suggestions.filter(({ name, email = "" }) => {
		const matches =
			!value ||
			name.toLocaleLowerCase("ru").includes(value) ||
			email.toLocaleLowerCase().includes(value);
		return matches && !pendingEmails.has(email.toLocaleLowerCase());
	});
};
