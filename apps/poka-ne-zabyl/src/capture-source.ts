export type CaptureSource = {
	input_kind?: string;
	source_type?: string;
	document_type?: string;
};

export type CaptureSourceKind = "image" | "voice" | "text";
export type ReviewPresentation = "ready" | "editor";
export type ReviewCompletionBehavior = "open" | "background";
export type CaptureReviewSettings = {
	presentation: ReviewPresentation;
	completion: ReviewCompletionBehavior;
};

const recordValue = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

export const captureReviewSettings = (
	preferences: unknown,
	fallback: CaptureReviewSettings,
): CaptureReviewSettings => {
	const root = recordValue(preferences);
	const developer = recordValue(root.developer);
	const review = recordValue(developer.captureReview);
	return {
		presentation:
			review.presentation === "ready" || review.presentation === "editor"
				? review.presentation
				: fallback.presentation,
		completion:
			review.completion === "open" || review.completion === "background"
				? review.completion
				: fallback.completion,
	};
};

export const withCaptureReviewSettings = (
	preferences: unknown,
	settings: CaptureReviewSettings,
) => {
	const root = recordValue(preferences);
	const developer = recordValue(root.developer);
	return {
		...root,
		developer: {
			...developer,
			captureReview: settings,
		},
	};
};

export const captureSourceKind = (
	capture?: CaptureSource,
): CaptureSourceKind | null => {
	if (!capture) return null;
	const value = [capture.input_kind, capture.source_type, capture.document_type]
		.filter(Boolean)
		.join(" ")
		.toLocaleLowerCase("ru");
	if (/image|photo|receipt|scan/.test(value)) return "image";
	if (/voice|audio/.test(value)) return "voice";
	return "text";
};

export const shouldGuideFirstCapture = (
	purpose: "expense" | "purchase_plan",
	captureCount: number,
	candidateCount: number,
	pendingCount: number,
) =>
	purpose === "expense" &&
	captureCount === 0 &&
	candidateCount === 0 &&
	pendingCount === 0;

export const shouldAutoOpenReview = (
	sameSpace: boolean,
	behavior: ReviewCompletionBehavior,
	blockedByOpenEditor = false,
) => sameSpace && behavior === "open" && !blockedByOpenEditor;
