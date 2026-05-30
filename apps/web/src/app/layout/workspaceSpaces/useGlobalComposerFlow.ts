import { useCallback, useReducer } from "react";
import {
	type GlobalComposerCandidateBundle,
	type GlobalComposerInputKind,
	globalComposerFlowReducer,
	initialGlobalComposerFlowState,
} from "./globalComposerFlow";

export const useGlobalComposerFlow = () => {
	const [flow, dispatch] = useReducer(
		globalComposerFlowReducer,
		initialGlobalComposerFlowState,
	);

	const beginDetecting = useCallback((inputKind: GlobalComposerInputKind) => {
		dispatch({ type: "detecting_intent", inputKind });
	}, []);

	const clarify = useCallback(
		(message: string, bundle?: GlobalComposerCandidateBundle) => {
			dispatch({ type: "clarifying", message, bundle });
		},
		[],
	);

	const showCandidateSummary = useCallback(
		(bundle: GlobalComposerCandidateBundle) => {
			dispatch({ type: "candidate_summary", bundle });
		},
		[],
	);

	const handoffToReview = useCallback(
		(bundle: GlobalComposerCandidateBundle, message?: string) => {
			dispatch({ type: "review_handoff", bundle, message });
		},
		[],
	);

	const complete = useCallback((message: string) => {
		dispatch({ type: "completed", message });
	}, []);

	const fail = useCallback((error: string) => {
		dispatch({ type: "failed", error });
	}, []);

	const reset = useCallback(() => {
		dispatch({ type: "reset" });
	}, []);

	return {
		flow,
		beginDetecting,
		clarify,
		showCandidateSummary,
		handoffToReview,
		complete,
		fail,
		reset,
	};
};
