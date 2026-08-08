import assert from "node:assert/strict";
import test from "node:test";
import {
	captureReviewSettings,
	captureSourceKind,
	mergeCaptureResultForSpace,
	pendingCapturesForSpace,
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
	assert.equal(shouldAutoOpenReview(true, "open", true), false);
});

test("shows pending captures only in their source space", () => {
	const pending = [
		{ sourceDocumentID: 41, spaceID: 2 },
		{ sourceDocumentID: 42, spaceID: 7 },
	];
	assert.deepEqual(pendingCapturesForSpace(pending, 7), [pending[1]]);
	assert.deepEqual(pendingCapturesForSpace(pending, 9), []);
});

test("does not merge a finished capture into another space", () => {
	const current = [{ source_document_id: 11, title: "Личное" }];
	const incoming = [{ source_document_id: 42, title: "Ремонт" }];
	assert.deepEqual(
		mergeCaptureResultForSpace(current, incoming, 42, 7, 2),
		current,
	);
	assert.deepEqual(mergeCaptureResultForSpace(current, incoming, 42, 7, 7), [
		...current,
		...incoming,
	]);
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
