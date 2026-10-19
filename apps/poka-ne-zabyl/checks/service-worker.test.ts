import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("activating a PWA update preserves open forms instead of navigating clients", async () => {
	type Listener = (event: { waitUntil: (work: Promise<void>) => void }) => void;
	const listeners = new Map<string, Listener>();
	let claimed = 0;
	let navigated = 0;
	vm.runInNewContext(
		readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
		{
			self: {
				location: { hostname: "poka-ne-zabyl.ru" },
				addEventListener: (name: string, listener: Listener) =>
					listeners.set(name, listener),
				clients: {
					claim: async () => {
						claimed++;
					},
					matchAll: async () => [
						{
							url: "https://poka-ne-zabyl.ru/app",
							navigate: async () => {
								navigated++;
							},
						},
					],
				},
			},
			caches: { keys: async () => [] },
		},
	);
	let activation: Promise<void> | undefined;
	listeners.get("activate")?.({
		waitUntil: (work) => {
			activation = work;
		},
	});
	assert.ok(activation);
	await activation;
	assert.equal(claimed, 1);
	assert.equal(navigated, 0);
});
