import type { ChatMessage, Space } from "@cofi/api";
import { useCallback } from "react";
import { httpClient } from "../../../shared/lib/httpClient";
import {
	parseCapturePhoto,
	parseCaptureText,
	parseCaptureVoice,
} from "../../../shared/lib/quickCaptureTransactions";
import { wsClient } from "../../../shared/lib/wsClient";
import type { ChatComposerPurpose } from "../components/ChatComposerOrientation";
import type { ComposerPayload } from "../components/SmartTextareaComposer";
import type { BuilderItem } from "../components/transactionBuilderTypes";
import { parseTags, toNumber } from "../components/transactionBuilderTypes";

type UseNativeChatComposerActionsArgs = {
	loadSpaceTransactions: () => Promise<void>;
	patchSpaces: (updater: (prev: Space[] | null) => Space[] | null) => void;
	selectedSpaceId: string | number | null;
	setComposerPurpose: (purpose: ChatComposerPurpose) => void;
	setErrorMessage: (message: string | null) => void;
	setIsLoading: (loading: boolean) => void;
	setMessages: (
		updater: (prev: ChatMessage[] | null) => ChatMessage[] | null,
	) => void;
	setOldestMessageId: (
		updater: (prev: string | number | null) => string | number | null,
	) => void;
	setStickToLatest: (stickToLatest: boolean) => void;
};

const parsedItemsToBuilderItems = (
	items: Array<{
		name?: string | null;
		amount?: number | string | null;
		tags?: string[] | null;
		notes?: string | null;
	}>,
): BuilderItem[] =>
	items
		.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
		.map((p) => ({
			id: crypto.randomUUID(),
			name: p.name?.trim() ?? "",
			amount: String(p.amount),
			tags: (p.tags ?? []).join(", "),
			notes: p.notes?.trim() ?? "",
		}));

export const useNativeChatComposerActions = ({
	loadSpaceTransactions,
	patchSpaces,
	selectedSpaceId,
	setComposerPurpose,
	setErrorMessage,
	setIsLoading,
	setMessages,
	setOldestMessageId,
	setStickToLatest,
}: UseNativeChatComposerActionsArgs) => {
	const bumpSelectedSpaceActivity = useCallback(() => {
		if (selectedSpaceId == null) return;
		const nowIso = new Date().toISOString();
		patchSpaces((prev) => {
			if (!prev) return prev;
			return prev.map((s) =>
				String(s.id) === String(selectedSpaceId)
					? { ...s, last_activity_at: nowIso }
					: s,
			);
		});
	}, [patchSpaces, selectedSpaceId]);

	const sendChatText = useCallback(
		async (text: string) => {
			if (selectedSpaceId === null) return;
			const t = text.trim();
			if (!t) return;
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const created = await wsClient.rpc<ChatMessage>("chat.send", {
					spaceId: selectedSpaceId,
					text: t,
				});
				setStickToLatest(true);
				setMessages((prev) => [...(prev ?? []), created]);
				setOldestMessageId((prev) => prev ?? created.id);
				bumpSelectedSpaceActivity();
			} catch (err) {
				setErrorMessage(
					err instanceof Error ? err.message : "Failed to send message",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[
			bumpSelectedSpaceActivity,
			selectedSpaceId,
			setErrorMessage,
			setIsLoading,
			setMessages,
			setOldestMessageId,
			setStickToLatest,
		],
	);

	const finalizeParsedDraft = useCallback(
		async (description: string, builderItems: BuilderItem[]) => {
			if (!selectedSpaceId) return;
			const payloadItems = builderItems
				.map((it) => {
					const lineNotes = (it.notes ?? "").trim();
					return {
						name: it.name.trim(),
						amount: toNumber(it.amount),
						tags: parseTags(it.tags),
						...(lineNotes ? { notes: lineNotes } : {}),
					};
				})
				.filter((it) => it.name && it.amount !== 0);
			if (!payloadItems.length) {
				setErrorMessage(
					"Nothing to save — parsed lines need a name and amount.",
				);
				return;
			}

			const res = await httpClient.post<{
				expense?: { id: string | number };
				message?: ChatMessage;
			}>("/api/v1/capture", {
				input_kind: "manual",
				space_id: Number(selectedSpaceId),
				description: description.trim(),
				items: payloadItems,
			});

			const msg = res.data?.message;
			if (msg) {
				setMessages((prev) => {
					const list = prev ?? [];
					if (list.some((m) => String(m.id) === String(msg.id))) {
						return list;
					}
					return [...list, msg];
				});
			}

			setComposerPurpose("message");
			setStickToLatest(true);
			bumpSelectedSpaceActivity();
			void loadSpaceTransactions();
		},
		[
			bumpSelectedSpaceActivity,
			loadSpaceTransactions,
			selectedSpaceId,
			setComposerPurpose,
			setErrorMessage,
			setMessages,
			setStickToLatest,
		],
	);

	const parsePhotoFile = useCallback(
		async (file: File) => {
			if (!selectedSpaceId) return;
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const res = await parseCapturePhoto(file, { spaceId: selectedSpaceId });
				const builderItems = parsedItemsToBuilderItems(res.items ?? []);
				if (!builderItems.length) {
					setErrorMessage(
						"Nothing parsed from this image — try another photo.",
					);
					return;
				}
				await finalizeParsedDraft(`Photo: ${file.name}`, builderItems);
			} catch (e) {
				setErrorMessage(
					e instanceof Error ? e.message : "Failed to parse photo",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[selectedSpaceId, finalizeParsedDraft, setErrorMessage, setIsLoading],
	);

	const parseVoiceBlob = useCallback(
		async (blob: Blob) => {
			if (!selectedSpaceId) return;
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const res = await parseCaptureVoice(blob, blob.type || "audio/webm", {
					spaceId: selectedSpaceId,
				});
				const builderItems = parsedItemsToBuilderItems(res.items ?? []);
				if (!builderItems.length) {
					setErrorMessage(
						"Nothing parsed from voice — try speaking amounts clearly.",
					);
					return;
				}
				const description = res.transcription?.trim() || "Voice expense";
				await finalizeParsedDraft(description, builderItems);
			} catch (e) {
				setErrorMessage(
					e instanceof Error ? e.message : "Failed to parse voice",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[selectedSpaceId, finalizeParsedDraft, setErrorMessage, setIsLoading],
	);

	const sendVoiceBlobAsChatMessage = useCallback(
		async (blob: Blob) => {
			if (!selectedSpaceId) return;
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const res = await parseCaptureVoice(blob, blob.type || "audio/webm", {
					spaceId: selectedSpaceId,
				});
				const text = res.transcription?.trim();
				if (!text) {
					setErrorMessage("Nothing transcribed — try again.");
					return;
				}
				await sendChatText(text);
			} catch (e) {
				setErrorMessage(
					e instanceof Error ? e.message : "Failed to send voice message",
				);
			} finally {
				setIsLoading(false);
			}
		},
		[selectedSpaceId, sendChatText, setErrorMessage, setIsLoading],
	);

	const handleComposerSubmit = useCallback(
		async (payload: ComposerPayload) => {
			if (selectedSpaceId === null) return;

			if (payload.composer_mode === "expense") {
				if (payload.expense_input_type === "text") {
					const text = payload.content.trim();
					if (!text) return;
					setIsLoading(true);
					setErrorMessage(null);
					try {
						const res = await parseCaptureText(text, {
							spaceId: selectedSpaceId,
						});
						const builderItems = parsedItemsToBuilderItems(res.items ?? []);
						if (!builderItems.length) {
							setErrorMessage(
								"Nothing parsed — try clearer amounts and item names.",
							);
							return;
						}
						await finalizeParsedDraft(text, builderItems);
					} catch (err) {
						setErrorMessage(
							err instanceof Error ? err.message : "Failed to parse text",
						);
					} finally {
						setIsLoading(false);
					}
				} else if (payload.expense_input_type === "photo") {
					await parsePhotoFile(payload.file);
				}
				return;
			}

			if (payload.composer_mode === "ask") {
				let text = "";
				if (payload.ask_type === "period_expenses") {
					text = payload.content
						? `How much did I spend on ${payload.content} ${payload.period.toLowerCase()}?`
						: `How much did I spend ${payload.period.toLowerCase()}?`;
				} else if (payload.ask_type === "find_expense") {
					text = `Find expense: ${payload.content}`;
				} else if (payload.ask_type === "next_payment") {
					text = `What's my next payment? (${payload.period})`;
				} else if (payload.ask_type === "split_balance") {
					text = payload.content
						? `Who owes whom? ${payload.content}`
						: "Who owes whom in this space?";
				} else if (payload.ask_type === "custom") {
					text = payload.content;
				}
				if (text.trim()) await sendChatText(text);
				return;
			}

			if (payload.composer_mode === "message") {
				await sendChatText(payload.content);
			}
		},
		[
			selectedSpaceId,
			finalizeParsedDraft,
			parsePhotoFile,
			sendChatText,
			setErrorMessage,
			setIsLoading,
		],
	);

	return {
		handleComposerSubmit,
		parseVoiceBlob,
		sendVoiceBlobAsChatMessage,
	};
};
