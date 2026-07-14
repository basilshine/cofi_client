import assert from "node:assert/strict";
import test from "node:test";
import { groupRowsByExpense } from "../src/expense-groups.ts";

test("groups visible items by their parent expense", () => {
	const rows = [
		{ expense: { id: 1 }, item: "Молоко" },
		{ expense: { id: 2 }, item: "Такси" },
		{ expense: { id: 1 }, item: "Кефир" },
	];
	assert.deepEqual(
		groupRowsByExpense(rows).map((group) => group.map((row) => row.item)),
		[["Молоко", "Кефир"], ["Такси"]],
	);
});
