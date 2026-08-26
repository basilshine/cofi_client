import assert from "node:assert/strict";
import test from "node:test";
import {
	emptyProductPromoState,
	nextProductPromo,
	parseProductPromoState,
	recordProductPromoImpression,
	snoozeProductPromo,
} from "../src/product-promos.ts";

const signals = {
	hasExpenses: true,
	hasSmartCapture: true,
	canSplitExpense: false,
	hasSplitExpense: false,
	canInviteToSpace: false,
	hasInvitedParticipant: false,
	canCreateSpace: false,
	hasExtraSpace: false,
	hasCustomCategory: true,
	hasPlus: true,
};

test("product promos choose the most relevant unused feature", () => {
	assert.equal(
		nextProductPromo(
			{ ...signals, hasSmartCapture: false },
			emptyProductPromoState(),
			new Date("2026-08-26T10:00:00Z"),
		),
		"aiCapture",
	);
	assert.equal(
		nextProductPromo(
			{ ...signals, canSplitExpense: true },
			emptyProductPromoState(),
			new Date("2026-08-26T10:00:00Z"),
		),
		"splitExpense",
	);
});

test("product promos respect the global cooldown and snooze", () => {
	const now = new Date("2026-08-26T10:00:00Z");
	const base = emptyProductPromoState();
	const shown = recordProductPromoImpression(base, "inviteSpace", now);
	assert.equal(
		nextProductPromo(
			{ ...signals, canInviteToSpace: true },
			shown,
			new Date("2026-08-26T20:00:00Z"),
		),
		null,
	);
	const snoozed = snoozeProductPromo(base, "inviteSpace", 7, false, now);
	assert.equal(
		nextProductPromo(
			{ ...signals, canInviteToSpace: true },
			snoozed,
			new Date("2026-08-28T10:00:00Z"),
		),
		null,
	);
});

test("product promo storage rejects malformed campaign data", () => {
	assert.deepEqual(parseProductPromoState("broken"), emptyProductPromoState());
	assert.deepEqual(parseProductPromoState('{"campaigns":{"unknown":{}}}'), {
		version: 1,
		campaigns: {},
	});
});
