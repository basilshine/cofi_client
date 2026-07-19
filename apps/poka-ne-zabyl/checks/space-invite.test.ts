import assert from "node:assert/strict";
import test from "node:test";
import { availableInviteSuggestions } from "../src/space-invite.ts";

test("offers people from other spaces without duplicate pending invites", () => {
	const suggestions = [
		{ user_id: 1, name: "Анна", email: "anna@example.com" },
		{ user_id: 2, name: "Борис", email: "boris@example.com" },
	];
	const pending = [
		{
			id: 7,
			invitee_email: "ANNA@example.com",
			token: "pending-anna",
			expires_at: "2026-07-24T00:00:00Z",
		},
	];

	assert.deepEqual(
		availableInviteSuggestions(suggestions, pending, "бор").map(
			({ user_id }) => user_id,
		),
		[2],
	);
});
