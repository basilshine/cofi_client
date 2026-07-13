import assert from "node:assert/strict";
import test from "node:test";
import { expenseAmountInCurrency, expenseDisplayMoney } from "../src/money.ts";

const expense = {
	total: 320,
	currency: "RUB",
	space_total: 3.5,
	space_currency: "USD",
	items: [{ amount: 320, space_amount: 3.5 }],
};

test("uses the amount that matches the profile currency", () => {
	assert.equal(expenseAmountInCurrency(expense, "RUB"), 320);
	assert.equal(expenseAmountInCurrency(expense, "USD"), 3.5);
	assert.equal(expenseAmountInCurrency(expense, "THB"), null);
	assert.deepEqual(expenseDisplayMoney(expense, "THB"), {
		amount: 320,
		currency: "RUB",
	});
});

test("does not label the converted ledger total as the source amount", () => {
	const convertedExpense = {
		total: 20,
		currency: "USD",
		source_currency: "RUB",
		space_total: 20,
		space_currency: "USD",
		items: [
			{
				amount: 20,
				source_amount: 1600,
				source_currency: "RUB",
				space_amount: 20,
				space_currency: "USD",
			},
		],
	};

	assert.equal(expenseAmountInCurrency(convertedExpense, "RUB"), 1600);
	assert.equal(expenseAmountInCurrency(convertedExpense, "USD"), 20);
});
