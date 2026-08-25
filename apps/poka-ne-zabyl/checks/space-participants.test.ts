import assert from "node:assert/strict";
import test from "node:test";
import { selectableParticipantsForSpace } from "../src/space-participants.ts";

test("keeps only unique selectable participants from the active space", () => {
	const participants = selectableParticipantsForSpace(
		[
			{
				id: 11,
				space_id: 7,
				user_id: 3,
				display_name: "Василий",
				status: "active",
				email: "owner@example.com",
			},
			{
				id: 12,
				space_id: 7,
				linked_user_id: 3,
				display_name: "Василий",
				status: "accepted",
				email: "OWNER@example.com",
			},
			{
				id: 21,
				space_id: 2,
				user_id: 4,
				display_name: "Участник другого пространства",
				status: "active",
			},
			{
				id: 13,
				space_id: 7,
				display_name: "Приглашённый участник",
				status: "invited",
				email: "invite@example.com",
			},
			{
				id: 14,
				space_id: 7,
				display_name: "Старый участник",
				status: "archived",
			},
		],
		7,
	);

	assert.deepEqual(
		participants.map(({ id }) => id),
		[11, 13],
	);
});

test("does not merge different invited participants with the same display name", () => {
	const participants = selectableParticipantsForSpace(
		[
			{
				id: 31,
				space_id: 7,
				display_name: "Участник",
				status: "invited",
				email: "first@example.com",
			},
			{
				id: 32,
				space_id: 7,
				display_name: "Участник",
				status: "invited",
				email: "second@example.com",
			},
		],
		7,
	);

	assert.deepEqual(
		participants.map(({ id }) => id),
		[31, 32],
	);
});
