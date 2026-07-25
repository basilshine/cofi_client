import assert from "node:assert/strict";
import test from "node:test";
import {
	captureReviewSettings,
	captureSourceKind,
	shouldAutoOpenReview,
	shouldGuideFirstCapture,
	withCaptureReviewSettings,
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

test("auto-opens every result in the active foreground flow", () => {
	assert.equal(shouldAutoOpenReview(true, "open"), true);
	assert.equal(shouldAutoOpenReview(true, "background"), false);
	assert.equal(shouldAutoOpenReview(false, "open"), false);
});

test("persists capture review settings without replacing other preferences", () => {
	const preferences = withCaptureReviewSettings(
		{ appearance: { theme: "ceits-editorial" }, developer: { debug: true } },
		{ presentation: "ready", completion: "background" },
	);
	assert.deepEqual(
		captureReviewSettings(preferences, {
			presentation: "editor",
			completion: "open",
		}),
		{ presentation: "ready", completion: "background" },
	);
	assert.deepEqual(preferences.appearance, { theme: "ceits-editorial" });
	assert.equal((preferences.developer as Record<string, unknown>).debug, true);
});
