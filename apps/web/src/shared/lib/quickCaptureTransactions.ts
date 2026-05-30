import { httpClient } from "./httpClient";

export type ParsedApiItem = {
	name: string;
	amount: number;
	tags?: string[];
	notes?: string;
};

export type CaptureParsePreview = {
	items?: ParsedApiItem[];
	transcription?: string;
	vendor_name?: string;
	payee_text?: string;
	intent?: string;
	confidence?: number;
	requires_review?: boolean;
	requires_deep_parse?: boolean;
	clarification_message?: string;
	source_document_id?: number;
	model_policy?: {
		profile?: string;
		max_profile?: string;
		cost_class?: string;
		quota_units?: number;
	};
	data?: Record<string, unknown>;
	draft?: Record<string, unknown>;
	split_draft?: Record<string, unknown>;
	participants_draft?: Record<string, unknown>;
	space_suggestion?: Record<string, unknown>;
};

const mapParsedToManual = (items: ParsedApiItem[]) =>
	items
		.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
		.map((p) => ({
			name: p.name.trim(),
			amount: Number(p.amount),
			tags: p.tags,
		}));

export const parseCaptureText = async (
	text: string,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureParsePreview> => {
	const { data } = await httpClient.post<CaptureParsePreview>(
		"/api/v1/capture/parse",
		{
			input_kind: "text",
			text,
			space_id:
				options.spaceId === undefined ? undefined : Number(options.spaceId),
			channel: options.channel ?? "web",
		},
	);
	return data ?? {};
};

export const parseCapturePhoto = async (
	file: File,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureParsePreview> => {
	const fd = new FormData();
	fd.append("input_kind", "image");
	fd.append("image", file);
	if (options.spaceId !== undefined) {
		fd.append("space_id", String(options.spaceId));
	}
	fd.append("channel", options.channel ?? "web");

	const { data } = await httpClient.post<CaptureParsePreview>(
		"/api/v1/capture/parse",
		fd,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data ?? {};
};

export const parseCaptureVoice = async (
	blob: Blob,
	mime: string,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureParsePreview> => {
	const fd = new FormData();
	fd.append("input_kind", "voice");
	fd.append(
		"voice",
		new File([blob], "voice.webm", { type: mime || "audio/webm" }),
	);
	if (options.spaceId !== undefined) {
		fd.append("space_id", String(options.spaceId));
	}
	fd.append("channel", options.channel ?? "web");

	const { data } = await httpClient.post<CaptureParsePreview>(
		"/api/v1/capture/parse",
		fd,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data ?? {};
};

/** Parse receipt image; use `accept="image/*"` without `capture` so mobile OS offers camera + library. */
export const parsePhotoInSpace = async (
	spaceId: string | number,
	file: File,
): Promise<{ name: string; amount: number; tags?: string[] }[]> => {
	const data = await parseCapturePhoto(file, { spaceId });
	return mapParsedToManual(data.items ?? []);
};

export const parseVoiceInSpace = async (
	spaceId: string | number,
	blob: Blob,
	mime: string,
): Promise<{
	items: { name: string; amount: number; tags?: string[] }[];
	transcription: string;
}> => {
	const data = await parseCaptureVoice(blob, mime, { spaceId });
	return {
		items: mapParsedToManual(data.items ?? []),
		transcription: data?.transcription?.trim() ?? "",
	};
};

export const parseTextInSpace = async (
	spaceId: string | number,
	text: string,
): Promise<{ name: string; amount: number; tags?: string[] }[]> => {
	const data = await parseCaptureText(text, { spaceId });
	return mapParsedToManual(data.items ?? []);
};

export const createManualDraftInSpace = async (
	spaceId: string | number,
	description: string,
	items: { name: string; amount: number; tags?: string[] }[],
) =>
	httpClient.post("/api/v1/capture", {
		input_kind: "manual",
		space_id: Number(spaceId),
		description: description.trim(),
		items,
	});
