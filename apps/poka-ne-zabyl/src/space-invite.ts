export type SpaceInviteSuggestion = {
	user_id: number;
	name: string;
	email?: string;
	relationship_label?: string;
};

export type PendingSpaceInvite = {
	id: number;
	invitee_user_id?: number;
	invitee_name?: string;
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
	const pendingUserIDs = new Set(
		pending.flatMap(({ invitee_user_id }) =>
			invitee_user_id ? [invitee_user_id] : [],
		),
	);
	return suggestions.filter(({ user_id, name, email = "" }) => {
		const matches =
			!value ||
			name.toLocaleLowerCase("ru").includes(value) ||
			email.toLocaleLowerCase().includes(value);
		return (
			matches &&
			!pendingUserIDs.has(user_id) &&
			(!email || !pendingEmails.has(email.toLocaleLowerCase()))
		);
	});
};
