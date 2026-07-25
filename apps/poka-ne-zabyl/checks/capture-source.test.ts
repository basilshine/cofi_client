import assert from "node:assert/strict";
import test from "node:test";
import {
	captureSourceKind,
	shouldAutoOpenFirstReview,
	shouldGuideFirstCapture,
} from "../src/capture-source.ts";

test("recognizes canonical and historical capture source kinds", () => {
	assert.equal(captureSourceKind({ input_kind: "image" }), "image");
	assert.equal(captureSourceKind({ source_type: "receipt" }), "image");
	assert.equal(captureSourceKind({ input_kind: "audio" }), "voice");
	assert.equal(captureSourceKind({ input_kind: "text" }), "text");
	assert.equal(captureSourceKind(), null);
});

test("guides only the first AI expense capture", () => {
	assert.equal(shouldGuideFirstCapture("expense", 0, 0, 0), true);
	assert.equal(shouldGuideFirstCapture("purchase_plan", 0, 0, 0), false);
	assert.equal(shouldGuideFirstCapture("expense", 1, 0, 0), false);
	assert.equal(shouldGuideFirstCapture("expense", 0, 1, 0), false);
	assert.equal(shouldGuideFirstCapture("expense", 0, 0, 1), false);
});

test("auto-opens the first result only in the active foreground flow", () => {
	assert.equal(shouldAutoOpenFirstReview(true, true, "open"), true);
	assert.equal(shouldAutoOpenFirstReview(true, true, "background"), false);
	assert.equal(shouldAutoOpenFirstReview(true, false, "open"), false);
});
