import assert from "node:assert/strict";
import test from "node:test";
import {
	normalizeExpenseRecord,
	normalizeExpenseRecords,
} from "../src/expense-record.ts";

test("normalizes raw model tags returned immediately after expense save", () => {
	const expense = normalizeExpenseRecord({
		id: 7,
		items: [
			{
				name: "Milk",
				tags: [{ id: 1, name: "food", color: "#fff" }, " receipt "],
			},
		],
	});

	assert.deepEqual(expense.items[0].tags, ["food", "receipt"]);
});

test("uses an empty item list for incomplete expense payloads", () => {
	assert.deepEqual(normalizeExpenseRecord({ id: 8, items: null }).items, []);
	assert.deepEqual(normalizeExpenseRecords(undefined), []);
});
