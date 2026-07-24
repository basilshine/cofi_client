import assert from "node:assert/strict";
import test from "node:test";
import {
	expenseAmountInCurrency,
	expenseDisplayMoney,
	formatMoney,
	itemDisplayMoney,
	moneyAmountsMatch,
	profileReportingCurrency,
} from "../src/money.ts";

test("keeps kopecks without padding whole ruble amounts", () => {
	assert.equal(formatMoney(13.99, "RUB"), "13,99 ₽");
	assert.equal(formatMoney(14, "RUB"), "14 ₽");
});

test("compares receipt totals to the kopeck", () => {
	assert.equal(moneyAmountsMatch(0.1 + 0.2, 0.3), true);
	assert.equal(moneyAmountsMatch(7173.33, 7173.34), false);
});

test("uses the profile currency for reporting without changing stored money", () => {
	assert.equal(profileReportingCurrency("usd", "RUB"), "USD");
	assert.equal(profileReportingCurrency("", "eur"), "EUR");
});

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

test("uses server reporting amounts for profile totals", () => {
	const reportedExpense = {
		total: 320,
		currency: "USD",
		space_total: 320,
		space_currency: "USD",
		reporting_total: 25600,
		reporting_currency: "RUB",
		items: [{ amount: 320, reporting_amount: 25600 }],
	};

	assert.equal(expenseAmountInCurrency(reportedExpense, "RUB"), 25600);
	assert.deepEqual(expenseDisplayMoney(reportedExpense, "RUB"), {
		amount: 25600,
		currency: "RUB",
	});
});

test("shows one expense item in the requested profile currency", () => {
	const convertedExpense = {
		total: 320,
		currency: "USD",
		reporting_total: 25600,
		reporting_currency: "RUB",
		items: [{ amount: 320, reporting_amount: 25600 }],
	};

	assert.deepEqual(
		itemDisplayMoney(convertedExpense.items[0], convertedExpense, "RUB"),
		{ amount: 25600, currency: "RUB" },
	);
	assert.deepEqual(
		itemDisplayMoney(
			{ amount: 12, source_currency: "EUR" },
			{ currency: "EUR", items: [] },
			"THB",
		),
		{ amount: 12, currency: "EUR" },
	);
});
