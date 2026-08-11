import assert from "node:assert/strict";
import test from "node:test";
import { mergeSplitSettlementEvidence } from "../src/split-settlement.ts";

test("keeps every settlement proof in an aggregated balance", () => {
	const first = mergeSplitSettlementEvidence([], {
		splitID: 11,
		amount: 500,
		note: "First transfer",
		mediaObjectID: 101,
		sentAt: "2026-08-11T10:00:00Z",
	});
	const result = mergeSplitSettlementEvidence(first, {
		splitID: 12,
		amount: 700,
		note: "Second transfer",
		mediaObjectID: 102,
		sentAt: "2026-08-11T11:00:00Z",
	});

	assert.equal(result.length, 2);
	assert.deepEqual(
		result.map((proof) => proof.mediaObjectID),
		[102, 101],
	);
});

test("shows one proof when one transfer covers several obligations", () => {
	const first = mergeSplitSettlementEvidence([], {
		splitID: 11,
		amount: 500,
		mediaObjectID: 101,
		sentAt: "2026-08-11T10:00:00Z",
	});
	const result = mergeSplitSettlementEvidence(first, {
		splitID: 12,
		amount: 700,
		mediaObjectID: 101,
		sentAt: "2026-08-11T10:00:00Z",
	});

	assert.equal(result.length, 1);
	assert.equal(result[0].amount, 1200);
	assert.equal(result[0].obligationCount, 2);
});
