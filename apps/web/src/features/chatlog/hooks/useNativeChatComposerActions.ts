import type { ChatMessage, Space } from "@cofi/api";
import { useCallback } from "react";
import {
	type CaptureResponse,
	capturePhoto,
	captureText,
	captureVoice,
} from "../../../shared/lib/quickCapture";
import { wsClient } from "../../../shared/lib/wsClient";
import type { ChatComposerPurpose } from "../components/ChatComposerOrientation";
import type { ComposerPayload } from "../components/SmartTextareaComposer";

export type CaptureProgressStage =
	| "received"
	| "uploading"
	| "extracting"
	| "review_ready"
	| "ready"
	| "failed";

export type CaptureProgressInputKind = "text" | "photo" | "voice";

export type CaptureProgressEvent = {
	id: string;
	inputKind: CaptureProgressInputKind;
	stage: CaptureProgressStage;
	title: string;
	detail?: string;
	candidateCount?: number;
	mediaId?: number;
	sourceDocumentId?: number;
};

type UseNativeChatComposerActionsArgs = {
	onCaptureProgress?: (event: CaptureProgressEvent) => void;
	onCaptureSettled?: () => void;
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

const captureCandidateCount = (response: CaptureResponse) =>
	response.candidates?.length ?? 0;

const hasReviewCandidates = (response: CaptureResponse) =>
	captureCandidateCount(response) > 0;

export const useNativeChatComposerActions = ({
	onCaptureProgress,
	onCaptureSettled,
	patchSpaces,
	selectedSpaceId,
	setComposerPurpose,
	setErrorMessage,
	setIsLoading,
	setMessages,
	setOldestMessageId,
	setStickToLatest,
}: UseNativeChatComposerActionsArgs) => {
	const emitProgress = useCallback(
		(
			id: string,
			inputKind: CaptureProgressInputKind,
			stage: CaptureProgressStage,
			detail?: string,
			extra?: Partial<CaptureProgressEvent>,
		) => {
			const title =
				inputKind === "photo"
					? "Receipt image"
					: inputKind === "voice"
						? "Voice capture"
						: "Text capture";
			onCaptureProgress?.({
				id,
				inputKind,
				stage,
				title,
				...(detail ? { detail } : {}),
				...extra,
			});
		},
		[onCaptureProgress],
	);

	const userFacingCaptureError = useCallback(
		(err: unknown, inputKind: CaptureProgressInputKind) => {
			const raw = err instanceof Error ? err.message : "";
			if (inputKind === "voice") {
				if (/permission|notallowed|not allowed|denied/i.test(raw)) {
					return "Microphone access is blocked in this browser. Allow microphone access or use text/photo.";
				}
				if (/500|internal server/i.test(raw)) {
					return "Voice capture failed. Your recording was not saved as a final expense. Try again or use text.";
				}
			}
			if (inputKind === "photo" && /500|internal server/i.test(raw)) {
				return "Image capture failed. The receipt was not saved as a final expense. Try another image or use text.";
			}
			return raw || `Failed to capture ${inputKind}`;
		},
		[],
	);

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

	const capturePhotoFile = useCallback(
		async (file: File) => {
			if (!selectedSpaceId) return;
			const progressId = crypto.randomUUID();
			setIsLoading(true);
			setErrorMessage(null);
			emitProgress(progressId, "photo", "received", file.name);
			try {
				emitProgress(progressId, "photo", "uploading", "Uploading image");
				emitProgress(
					progressId,
					"photo",
					"extracting",
					"Reading receipt and document signals",
				);
				const res = await capturePhoto(file, { spaceId: selectedSpaceId });
				if (!hasReviewCandidates(res)) {
					setErrorMessage(
						"No review candidates were created from this image — try another photo.",
					);
					emitProgress(
						progressId,
						"photo",
						"failed",
						"No review candidates were created",
						{
							mediaId: res.media_id,
							sourceDocumentId: res.source_document_id,
						},
					);
					return;
				}
				emitProgress(progressId, "photo", "review_ready", "Ready for review", {
					candidateCount: captureCandidateCount(res),
					mediaId: res.media_id,
					sourceDocumentId: res.source_document_id,
				});
				setComposerPurpose("message");
				setStickToLatest(true);
				bumpSelectedSpaceActivity();
				onCaptureSettled?.();
				emitProgress(progressId, "photo", "ready", "Ready for review", {
					candidateCount: captureCandidateCount(res),
					mediaId: res.media_id,
					sourceDocumentId: res.source_document_id,
				});
			} catch (e) {
				const message = userFacingCaptureError(e, "photo");
				setErrorMessage(message);
				emitProgress(progressId, "photo", "failed", message);
			} finally {
				setIsLoading(false);
			}
		},
		[
			selectedSpaceId,
			bumpSelectedSpaceActivity,
			emitProgress,
			onCaptureSettled,
			setComposerPurpose,
			setErrorMessage,
			setIsLoading,
			setStickToLatest,
			userFacingCaptureError,
		],
	);

	const captureVoiceBlob = useCallback(
		async (blob: Blob) => {
			if (!selectedSpaceId) return;
			const progressId = crypto.randomUUID();
			setIsLoading(true);
			setErrorMessage(null);
			emitProgress(progressId, "voice", "received", "Recording received");
			try {
				emitProgress(progressId, "voice", "uploading", "Uploading recording");
				emitProgress(
					progressId,
					"voice",
					"extracting",
					"Transcribing and extracting",
				);
				const res = await captureVoice(blob, blob.type || "audio/webm", {
					spaceId: selectedSpaceId,
				});
				if (!hasReviewCandidates(res)) {
					setErrorMessage(
						"No review candidates were created from voice — try speaking amounts clearly.",
					);
					emitProgress(
						progressId,
						"voice",
						"failed",
						"No review candidates were created",
						{
							mediaId: res.media_id,
							sourceDocumentId: res.source_document_id,
						},
					);
					return;
				}
				emitProgress(progressId, "voice", "review_ready", "Ready for review", {
					candidateCount: captureCandidateCount(res),
					mediaId: res.media_id,
					sourceDocumentId: res.source_document_id,
				});
				setComposerPurpose("message");
				setStickToLatest(true);
				bumpSelectedSpaceActivity();
				onCaptureSettled?.();
				emitProgress(progressId, "voice", "ready", "Ready for review", {
					candidateCount: captureCandidateCount(res),
					mediaId: res.media_id,
					sourceDocumentId: res.source_document_id,
				});
			} catch (e) {
				const message = userFacingCaptureError(e, "voice");
				setErrorMessage(message);
				emitProgress(progressId, "voice", "failed", message);
			} finally {
				setIsLoading(false);
			}
		},
		[
			selectedSpaceId,
			bumpSelectedSpaceActivity,
			emitProgress,
			onCaptureSettled,
			setComposerPurpose,
			setErrorMessage,
			setIsLoading,
			setStickToLatest,
			userFacingCaptureError,
		],
	);

	const sendVoiceBlobAsChatMessage = useCallback(
		async (blob: Blob) => {
			if (!selectedSpaceId) return;
			setIsLoading(true);
			setErrorMessage(null);
			try {
				const res = await captureVoice(blob, blob.type || "audio/webm", {
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
					const progressId = crypto.randomUUID();
					setIsLoading(true);
					setErrorMessage(null);
					emitProgress(progressId, "text", "received", "Text received");
					try {
						emitProgress(
							progressId,
							"text",
							"extracting",
							"Understanding expense details",
						);
						const res = await captureText(text, {
							spaceId: selectedSpaceId,
						});
						if (!hasReviewCandidates(res)) {
							setErrorMessage(
								"No review candidates were created — try clearer amounts and item names.",
							);
							emitProgress(
								progressId,
								"text",
								"failed",
								"No review candidates were created",
								{
									sourceDocumentId: res.source_document_id,
								},
							);
							return;
						}
						emitProgress(
							progressId,
							"text",
							"review_ready",
							"Ready for review",
							{
								candidateCount: captureCandidateCount(res),
								sourceDocumentId: res.source_document_id,
							},
						);
						setComposerPurpose("message");
						setStickToLatest(true);
						bumpSelectedSpaceActivity();
						onCaptureSettled?.();
						emitProgress(progressId, "text", "ready", "Ready for review", {
							candidateCount: captureCandidateCount(res),
							sourceDocumentId: res.source_document_id,
						});
					} catch (err) {
						const message = userFacingCaptureError(err, "text");
						setErrorMessage(message);
						emitProgress(progressId, "text", "failed", message);
					} finally {
						setIsLoading(false);
					}
				} else if (payload.expense_input_type === "photo") {
					await capturePhotoFile(payload.file);
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
			bumpSelectedSpaceActivity,
			emitProgress,
			onCaptureSettled,
			capturePhotoFile,
			sendChatText,
			setComposerPurpose,
			setErrorMessage,
			setIsLoading,
			setStickToLatest,
			userFacingCaptureError,
		],
	);

	return {
		handleComposerSubmit,
		captureVoiceBlob,
		sendVoiceBlobAsChatMessage,
	};
};
