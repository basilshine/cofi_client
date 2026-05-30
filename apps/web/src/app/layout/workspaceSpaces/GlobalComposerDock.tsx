import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	type ComposerPayload,
	type ComposerState,
	SmartTextareaComposer,
	type SmartTextareaComposerHandle,
} from "../../../features/chatlog/components/SmartTextareaComposer";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	createManualDraftInSpace,
	parseCapturePhoto,
	parseCaptureText,
	parseCaptureVoice,
} from "../../../shared/lib/quickCaptureTransactions";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";
import { readGlobalComposerIntent } from "./globalComposerIntent";
import { hasNativeChatComposer } from "./globalComposerRoutePolicy";

const toDraftItems = (
	items:
		| {
				name: string;
				amount: number;
				tags?: string[];
		  }[]
		| undefined,
) =>
	(items ?? [])
		.filter((item) => item.name?.trim() && Number(item.amount) !== 0)
		.map((item) => ({
			name: item.name.trim(),
			amount: Number(item.amount),
			tags: item.tags,
		}));

const spaceIdFromPath = (pathname: string): string | null => {
	const match = pathname.match(/^\/console\/spaces\/([^/]+)/);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
};

const spaceIdFromSearch = (search: string): string | null => {
	const params = new URLSearchParams(search);
	return params.get("spaceId") ?? params.get("space_id");
};

const askPayloadToMessage = (
	payload: Extract<ComposerPayload, { composer_mode: "ask" }>,
) => {
	if (payload.ask_type === "period_expenses") {
		return payload.content
			? `How much did I spend on ${payload.content} ${payload.period.toLowerCase()}?`
			: `How much did I spend ${payload.period.toLowerCase()}?`;
	}
	if (payload.ask_type === "find_expense")
		return `Find expense: ${payload.content}`;
	if (payload.ask_type === "next_payment") {
		return `What's my next payment? (${payload.period})`;
	}
	if (payload.ask_type === "split_balance") {
		return payload.content
			? `Who owes whom? ${payload.content}`
			: "Who owes whom in this space?";
	}
	return payload.content;
};

type GlobalComposerDockProps = {
	isCollapsed: boolean;
	onCollapsedChange: (isCollapsed: boolean) => void;
};

export const GlobalComposerDock = ({
	isCollapsed,
	onCollapsedChange,
}: GlobalComposerDockProps) => {
	const location = useLocation();
	const navigate = useNavigate();
	const { selectedSpaceId, spaces, isLoading } = useWorkspaceSpaces();
	const composerRef = useRef<SmartTextareaComposerHandle | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const [busy, setBusy] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [pendingComposerState, setPendingComposerState] =
		useState<ComposerState | null>(null);
	const [statusText, setStatusText] = useState<string | null>(null);
	const [errorText, setErrorText] = useState<string | null>(null);

	const hasNativeComposer = hasNativeChatComposer(location.pathname);
	const routeSpaceId = spaceIdFromPath(location.pathname);
	const querySpaceId = spaceIdFromSearch(location.search);
	const activeSpaceId = routeSpaceId ?? querySpaceId ?? selectedSpaceId;
	const activeSpace = useMemo(
		() =>
			activeSpaceId == null
				? null
				: ((spaces ?? []).find(
						(space) => String(space.id) === String(activeSpaceId),
					) ?? null),
		[activeSpaceId, spaces],
	);
	const activeSpaceName =
		activeSpace?.name?.trim() ||
		(activeSpaceId == null ? "Choose a space" : `Space ${activeSpaceId}`);
	const hasSpaceContext = activeSpaceId != null;
	const contextSource = routeSpaceId
		? "page"
		: querySpaceId
			? "linked page"
			: selectedSpaceId != null
				? "workspace"
				: null;

	const disabled = busy || isLoading || !hasSpaceContext;
	const composerNotice =
		errorText ??
		statusText ??
		(!hasSpaceContext
			? "Choose a space before capturing expenses or posting messages."
			: null);

	const showTransientStatus = useCallback((message: string) => {
		setStatusText(message);
		window.setTimeout(() => {
			setStatusText((current) => (current === message ? null : current));
		}, 2600);
	}, []);

	const createDraftFromParsed = useCallback(
		async (
			spaceId: string | number,
			description: string,
			items:
				| {
						name: string;
						amount: number;
						tags?: string[];
				  }[]
				| undefined,
		) => {
			const draftItems = toDraftItems(items);
			if (!draftItems.length) {
				throw new Error("Nothing parsed - try clearer amounts and item names.");
			}
			await createManualDraftInSpace(spaceId, description, draftItems);
		},
		[],
	);

	const handleSubmit = useCallback(
		async (payload: ComposerPayload) => {
			if (activeSpaceId == null) return;
			setBusy(true);
			setErrorText(null);
			try {
				if (payload.composer_mode === "expense") {
					if (payload.expense_input_type === "text") {
						const text = payload.content.trim();
						const parsed = await parseCaptureText(text, {
							spaceId: activeSpaceId,
						});
						await createDraftFromParsed(activeSpaceId, text, parsed.items);
						showTransientStatus(`Draft saved to ${activeSpaceName}`);
					} else if (payload.expense_input_type === "photo") {
						const parsed = await parseCapturePhoto(payload.file, {
							spaceId: activeSpaceId,
						});
						await createDraftFromParsed(
							activeSpaceId,
							payload.file.name || "Receipt photo",
							parsed.items,
						);
						showTransientStatus(`Receipt draft saved to ${activeSpaceName}`);
					}
					return;
				}

				const text =
					payload.composer_mode === "message"
						? payload.content.trim()
						: askPayloadToMessage(payload).trim();
				if (!text) return;
				await apiClient.chatlog.postNote(activeSpaceId, { text });
				showTransientStatus(`Message posted to ${activeSpaceName}`);
			} catch (error) {
				setErrorText(
					error instanceof Error ? error.message : "Composer failed",
				);
			} finally {
				setBusy(false);
			}
		},
		[
			activeSpaceId,
			activeSpaceName,
			createDraftFromParsed,
			showTransientStatus,
		],
	);

	const handleStartRecording = useCallback(async () => {
		if (disabled) return;
		setErrorText(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			mediaChunksRef.current = [];
			recorder.addEventListener("dataavailable", (event) => {
				if (event.data.size > 0) mediaChunksRef.current.push(event.data);
			});
			recorder.addEventListener(
				"stop",
				() => {
					for (const track of stream.getTracks()) {
						track.stop();
					}
				},
				{ once: true },
			);
			mediaRecorderRef.current = recorder;
			recorder.start();
			setIsRecording(true);
		} catch (error) {
			setErrorText(
				error instanceof Error
					? error.message
					: "Microphone permission denied.",
			);
		}
	}, [disabled]);

	const handleStopRecording = useCallback(async () => {
		if (activeSpaceId == null) return;
		const recorder = mediaRecorderRef.current;
		if (!recorder || recorder.state !== "recording") return;
		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), { once: true });
		});
		recorder.stop();
		await stopped;
		setIsRecording(false);

		const blob = new Blob(mediaChunksRef.current, {
			type: recorder.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		if (!blob.size) return;

		setBusy(true);
		setErrorText(null);
		try {
			const parsed = await parseCaptureVoice(
				blob,
				recorder.mimeType || "audio/webm",
				{ spaceId: activeSpaceId },
			);
			await createDraftFromParsed(
				activeSpaceId,
				parsed.transcription?.trim() || "Voice expense",
				parsed.items,
			);
			showTransientStatus(`Voice draft saved to ${activeSpaceName}`);
		} catch (error) {
			setErrorText(
				error instanceof Error ? error.message : "Failed to parse voice",
			);
		} finally {
			setBusy(false);
		}
	}, [
		activeSpaceId,
		activeSpaceName,
		createDraftFromParsed,
		showTransientStatus,
	]);

	const handleCancelRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (recorder?.state === "recording") recorder.stop();
		mediaRecorderRef.current = null;
		mediaChunksRef.current = [];
		setIsRecording(false);
	}, []);

	useEffect(() => {
		if (isCollapsed || !pendingComposerState) return;
		composerRef.current?.navigateTo(pendingComposerState);
		setPendingComposerState(null);
	}, [isCollapsed, pendingComposerState]);

	const expandTo = useCallback(
		(state?: ComposerState) => {
			setPendingComposerState(state ?? null);
			onCollapsedChange(false);
		},
		[onCollapsedChange],
	);

	const handleCollapseToggle = useCallback(() => {
		if (isCollapsed) {
			expandTo();
			return;
		}
		handleCancelRecording();
		onCollapsedChange(true);
	}, [expandTo, handleCancelRecording, isCollapsed, onCollapsedChange]);

	useEffect(() => {
		const intent = readGlobalComposerIntent(location.state);
		if (!intent || hasNativeComposer) return;

		if (intent === "expense") {
			expandTo("expense_method_select");
		} else if (intent === "ask") {
			expandTo("ask_topic_select");
		} else if (intent === "message") {
			expandTo("message_text");
		}

		navigate(
			{
				hash: location.hash,
				pathname: location.pathname,
				search: location.search,
			},
			{ replace: true, state: null },
		);
	}, [
		expandTo,
		hasNativeComposer,
		location.hash,
		location.pathname,
		location.search,
		location.state,
		navigate,
	]);

	if (hasNativeComposer) return null;

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-2 z-40 flex justify-center px-3 sm:bottom-3">
			<div className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-background/94 shadow-[0_18px_48px_-30px_rgba(44,32,18,0.58)] ring-1 ring-white/55 backdrop-blur-xl">
				<div className="flex items-center justify-between gap-3 border-b border-border/40 px-3.5 py-1.5">
					<p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Context: {activeSpaceName}
						{contextSource ? ` · ${contextSource}` : ""}
					</p>
					<div className="flex shrink-0 items-center gap-3">
						<button
							aria-label={
								isCollapsed
									? "Expand global composer"
									: "Collapse global composer"
							}
							aria-pressed={isCollapsed}
							className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={handleCollapseToggle}
							type="button"
						>
							{isCollapsed ? "Expand" : "Collapse"}
						</button>
						{hasSpaceContext ? (
							<Link
								className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
								to={`/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`}
							>
								Open chat
							</Link>
						) : (
							<Link
								className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
								to="/console/spaces"
							>
								Choose space
							</Link>
						)}
					</div>
				</div>
				{isCollapsed ? (
					<div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
						<button
							className="rounded-full border border-[rgba(120,100,80,0.28)] bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
							disabled={disabled}
							onClick={() => expandTo("expense_method_select")}
							type="button"
						>
							Add expense
						</button>
						<button
							className="rounded-full border border-[rgba(120,100,80,0.28)] bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
							disabled={disabled}
							onClick={() => expandTo("ask_topic_select")}
							type="button"
						>
							Ask Ceits
						</button>
						<button
							className="rounded-full border border-[rgba(120,100,80,0.28)] bg-card/90 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
							disabled={disabled}
							onClick={() => expandTo("message_text")}
							type="button"
						>
							Message
						</button>
					</div>
				) : (
					<SmartTextareaComposer
						ref={composerRef}
						disabled={disabled}
						isRecording={isRecording}
						onCancelRecording={handleCancelRecording}
						onComposerSubmit={(payload) => void handleSubmit(payload)}
						onStartExpenseRecording={() => void handleStartRecording()}
						onStopRecording={() => void handleStopRecording()}
						spaceId={activeSpaceId ?? "0"}
						surface="dock"
					/>
				)}
				{composerNotice ? (
					<div
						aria-live="polite"
						className={[
							"border-t px-4 py-2 text-xs",
							errorText
								? "border-destructive/20 bg-destructive/10 text-destructive"
								: statusText
									? "border-[rgba(90,130,96,0.18)] bg-[rgba(230,246,232,0.9)] text-[#355a3c]"
									: "border-border/50 bg-muted/45 text-muted-foreground",
						].join(" ")}
					>
						{composerNotice}
					</div>
				) : null}
			</div>
		</div>
	);
};
