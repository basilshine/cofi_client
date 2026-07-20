import assert from "node:assert/strict";
import test from "node:test";

import { AVATAR_IMAGE_SIZE, avatarCropLayout } from "../src/avatar-crop.ts";

test("avatar crop always covers the square and clamps dragging", () => {
	const landscape = avatarCropLayout(1200, 600, 1, 999, 999);
	assert.equal(landscape.height, AVATAR_IMAGE_SIZE);
	assert.equal(landscape.offsetX, 128);
	assert.equal(landscape.offsetY, 0);

	const zoomed = avatarCropLayout(600, 1200, 2, -999, -999);
	assert.equal(zoomed.width, AVATAR_IMAGE_SIZE * 2);
	assert.equal(zoomed.offsetX, -128);
	assert.equal(zoomed.offsetY, -384);
});
