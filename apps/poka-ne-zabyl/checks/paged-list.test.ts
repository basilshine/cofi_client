import assert from "node:assert/strict";
import test from "node:test";
import { appendUniquePage, nextPageOffset } from "../src/paged-list.ts";

test("appends a page without duplicating records already on screen", () => {
	assert.deepEqual(
		appendUniquePage(
			[
				{ id: 1, title: "First" },
				{ id: 2, title: "Second" },
			],
			[
				{ id: 2, title: "Second again" },
				{ id: 3, title: "Third" },
				{ id: 3, title: "Third duplicate" },
			],
		),
		[
			{ id: 1, title: "First" },
			{ id: 2, title: "Second" },
			{ id: 3, title: "Third" },
		],
	);
});

test("advances from the requested offset when the server omits next_offset", () => {
	assert.equal(nextPageOffset(undefined, 20, 20), 40);
	assert.equal(nextPageOffset(75, 40, 20), 75);
	assert.equal(nextPageOffset(0, 40, 20), 0);
});
