import assert from "node:assert/strict";
import test from "node:test";
import { captureSourceKind } from "../src/capture-source.ts";

test("recognizes canonical and historical capture source kinds", () => {
	assert.equal(captureSourceKind({ input_kind: "image" }), "image");
	assert.equal(captureSourceKind({ source_type: "receipt" }), "image");
	assert.equal(captureSourceKind({ input_kind: "audio" }), "voice");
	assert.equal(captureSourceKind({ input_kind: "text" }), "text");
	assert.equal(captureSourceKind(), null);
});
