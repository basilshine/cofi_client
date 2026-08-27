import assert from "node:assert/strict";
import test from "node:test";
import {
	expenseItemSelectionKey,
	expenseSelectionState,
	setExpenseSelectionKeys,
	toggleExpenseItemSelection,
	toggleExpenseSelection,
} from "../src/expense-selection.ts";

const expense = {
	id: 42,
	items: [{ id: 7 }, { id: 8 }, {}],
};

test("selects and clears a whole receipt without duplicate keys", () => {
	const selected = toggleExpenseSelection(new Set<string>(), expense);
	assert.deepEqual([...selected], ["42:7", "42:8", "42:index-2"]);
	assert.equal(expenseSelectionState(expense, selected), "complete");
	assert.equal(toggleExpenseSelection(selected, expense).size, 0);
});

test("reports a partially selected receipt after one item is removed", () => {
	const selected = toggleExpenseSelection(new Set<string>(), expense);
	const partial = toggleExpenseItemSelection(selected, 42, expense.items[1], 1);
	assert.equal(expenseSelectionState(expense, partial), "partial");
	assert.equal(
		partial.has(expenseItemSelectionKey(42, expense.items[1], 1)),
		false,
	);
});

test("uses the item index only when a saved item id is unavailable", () => {
	assert.equal(expenseItemSelectionKey(9, { id: 3 }, 5), "9:3");
	assert.equal(expenseItemSelectionKey(9, {}, 5), "9:index-5");
});

test("keeps earlier selections while a filtered subset is excluded", () => {
	const allKeys = ["42:7", "42:8", "42:index-2", "51:9"];
	const selected = setExpenseSelectionKeys(new Set(), allKeys, true);
	const withoutFilteredRows = setExpenseSelectionKeys(
		selected,
		["42:8"],
		false,
	);
	assert.deepEqual([...withoutFilteredRows], ["42:7", "42:index-2", "51:9"]);
	assert.equal(selected.size, 4, "the previous selection remains immutable");
});
