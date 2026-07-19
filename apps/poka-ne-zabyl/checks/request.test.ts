import assert from "node:assert/strict";
import test from "node:test";
import {
	ApiError,
	isQuotaExhaustedError,
	isServiceUnavailableError,
	requestError,
} from "../src/request.ts";

test("turns an aborted request into a useful retry message", () => {
	assert.equal(
		requestError(new DOMException("", "TimeoutError")).message,
		"Сервис не ответил. Попробуйте ещё раз",
	);
});

test("recognizes the server quota response", () => {
	assert.equal(
		isQuotaExhaustedError(new ApiError("limit", 402, "quota_exhausted")),
		true,
	);
	assert.equal(isQuotaExhaustedError(new ApiError("broken", 500)), false);
});

test("distinguishes service outages from ordinary client errors", () => {
	assert.equal(isServiceUnavailableError(new ApiError("down", 503)), true);
	assert.equal(isServiceUnavailableError(new TypeError("fetch failed")), true);
	assert.equal(isServiceUnavailableError(new ApiError("invalid", 400)), false);
});
