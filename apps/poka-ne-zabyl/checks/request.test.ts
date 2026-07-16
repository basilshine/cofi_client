import assert from "node:assert/strict";
import test from "node:test";
import {
	ApiError,
	isQuotaExhaustedError,
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
