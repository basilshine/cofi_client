import assert from "node:assert/strict";
import test from "node:test";
import { initializeMetrika, trackFirstExpenseGoal } from "../src/metrika.ts";

test("initializes the counter on application-only pages", () => {
	const scripts: Array<{ async?: boolean; src: string }> = [];
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {},
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			scripts,
			createElement: () => ({ src: "" }),
			head: {
				appendChild: (script: { async?: boolean; src: string }) =>
					scripts.push(script),
			},
		},
	});

	assert.equal(initializeMetrika(), true);
	assert.equal(scripts[0]?.src, "https://mc.yandex.ru/metrika/tag.js");
	assert.equal(initializeMetrika(), false);

	Reflect.deleteProperty(globalThis, "document");
	Reflect.deleteProperty(globalThis, "window");
});

test("tracks the first expense once per user", () => {
	const stored = new Map<string, string>();
	const goals: string[] = [];
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			localStorage: {
				getItem: (key: string) => stored.get(key) || null,
				setItem: (key: string, value: string) => stored.set(key, value),
			},
			ym: (_counter: number, _method: string, goal: string) => goals.push(goal),
		},
	});

	assert.equal(trackFirstExpenseGoal(7, 0), true);
	assert.equal(trackFirstExpenseGoal(7, 0), false);
	assert.equal(trackFirstExpenseGoal(8, 1), false);
	assert.deepEqual(goals, ["first_expense"]);
	Reflect.deleteProperty(globalThis, "window");
});
