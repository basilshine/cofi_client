import type { Location, NavigateFunction } from "react-router-dom";

export type GlobalComposerIntent = "expense" | "ask" | "message";

export type GlobalComposerLocationState = {
	globalComposerIntent?: GlobalComposerIntent;
};

const globalComposerIntents = new Set<GlobalComposerIntent>([
	"expense",
	"ask",
	"message",
]);

export const readGlobalComposerIntent = (
	state: unknown,
): GlobalComposerIntent | null => {
	if (state == null || typeof state !== "object") return null;
	const intent = (state as { globalComposerIntent?: unknown })
		.globalComposerIntent;
	return typeof intent === "string" &&
		globalComposerIntents.has(intent as GlobalComposerIntent)
		? (intent as GlobalComposerIntent)
		: null;
};

export const globalComposerIntentState = (
	intent: GlobalComposerIntent,
): GlobalComposerLocationState => ({
	globalComposerIntent: intent,
});

export const openGlobalComposerIntent = (
	navigate: NavigateFunction,
	location: Pick<Location, "hash" | "pathname" | "search">,
	intent: GlobalComposerIntent,
) => {
	navigate(
		{
			hash: location.hash,
			pathname: location.pathname,
			search: location.search,
		},
		{
			replace: true,
			state: globalComposerIntentState(intent),
		},
	);
};
