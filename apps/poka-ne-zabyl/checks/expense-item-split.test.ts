import assert from "node:assert/strict";
import test from "node:test";
import {
	aggregateItemAssignments,
	itemAssignmentsAreComplete,
} from "../src/expense-item-split.ts";

test("aggregates personal and shared receipt items without losing cents", () => {
	const items = [
		{ id: 1, amount: 600 },
		{ id: 2, amount: 100 },
	];
	const assignments = new Map([
		[1, [3]],
		[2, [1, 2, 3]],
	]);

	assert.equal(itemAssignmentsAreComplete(items, assignments), true);
	assert.deepEqual(Array.from(aggregateItemAssignments(items, assignments)), [
		[3, 633.33],
		[1, 33.34],
		[2, 33.33],
	]);
});

test("does not accept a receipt with an unassigned item", () => {
	assert.equal(
		itemAssignmentsAreComplete(
			[
				{ id: 1, amount: 10 },
				{ id: 2, amount: 20 },
			],
			new Map([[1, [7]]]),
		),
		false,
	);
});
