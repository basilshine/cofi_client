import assert from "node:assert/strict";
import test from "node:test";
import { trackFirstExpenseGoal } from "../src/metrika.ts";

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
