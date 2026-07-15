import assert from "node:assert/strict";
import test from "node:test";
import { requestError } from "../src/request.ts";

test("turns an aborted request into a useful retry message", () => {
	assert.equal(
		requestError(new DOMException("", "TimeoutError")).message,
		"Сервис не ответил. Попробуйте ещё раз",
	);
});
