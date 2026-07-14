export type CaptureSource = {
	input_kind?: string;
	source_type?: string;
	document_type?: string;
};

export type CaptureSourceKind = "image" | "voice" | "text";

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
