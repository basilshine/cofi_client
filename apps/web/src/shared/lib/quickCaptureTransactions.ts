import { httpClient } from "./httpClient";

export type ParsedApiItem = {
	name: string;
	amount: number;
	tags?: string[];
};

const mapParsedToManual = (items: ParsedApiItem[]) =>
	items
		.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
		.map((p) => ({
			name: p.name.trim(),
			amount: Number(p.amount),
			tags: p.tags,
		}));

/** Parse receipt image; use `accept="image/*"` without `capture` so mobile OS offers camera + library. */
export const parsePhotoInSpace = async (
	spaceId: string | number,
	file: File,
): Promise<{ name: string; amount: number; tags?: string[] }[]> => {
	const fd = new FormData();
	fd.append("image", file);
	const { data } = await httpClient.post<{ items?: ParsedApiItem[] }>(
		`/api/v1/spaces/${String(spaceId)}/transactions/parse/photo`,
		fd,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return mapParsedToManual(data?.items ?? []);
};

export const parseVoiceInSpace = async (
	spaceId: string | number,
	blob: Blob,
	mime: string,
): Promise<{
	items: { name: string; amount: number; tags?: string[] }[];
	transcription: string;
}> => {
	const fd = new FormData();
	fd.append(
		"voice",
		new File([blob], "voice.webm", { type: mime || "audio/webm" }),
	);
	const { data } = await httpClient.post<{
		items?: ParsedApiItem[];
		transcription?: string;
	}>(`/api/v1/spaces/${String(spaceId)}/transactions/parse/voice`, fd, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return {
		items: mapParsedToManual(data?.items ?? []),
		transcription: data?.transcription?.trim() ?? "",
	};
};

export const createManualDraftInSpace = async (
	spaceId: string | number,
	description: string,
	items: { name: string; amount: number; tags?: string[] }[],
) =>
	httpClient.post(`/api/v1/spaces/${String(spaceId)}/transactions/manual`, {
		description: description.trim(),
		items,
	});
