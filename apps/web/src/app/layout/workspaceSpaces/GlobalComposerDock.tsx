import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import {
	type ComposerPayload,
	type ComposerState,
	SmartTextareaComposer,
	type SmartTextareaComposerHandle,
} from "../../../features/chatlog/components/SmartTextareaComposer";
import {
	createManualDraftInSpace,
	parseCaptureIntentText,
	parseCapturePhoto,
	parseCaptureText,
	parseCaptureVoice,
} from "../../../shared/lib/quickCaptureTransactions";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";
import {
	type GlobalComposerCandidateBundle,
	summarizeCaptureIntentPreview,
	summarizeCapturePreview,
} from "./globalComposerFlow";
import { readGlobalComposerIntent } from "./globalComposerIntent";
import {
	hasNativeChatComposer,
	hasSettingsActionDock,
} from "./globalComposerRoutePolicy";
import { useGlobalComposerFlow } from "./useGlobalComposerFlow";

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
	const match = pathname.match(
		/^\/console\/(?:spaces|settings\/spaces)\/([^/]+)/,
	);
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

const bundleHasAny = (
	bundle: GlobalComposerCandidateBundle,
	kinds: GlobalComposerCandidateBundle["candidates"][number]["kind"][],
) => bundle.candidates.some((candidate) => kinds.includes(candidate.kind));

const candidateOnlyStatus = (
	bundle: GlobalComposerCandidateBundle,
	spaceName: string,
) => {
	if (bundleHasAny(bundle, ["promo", "loyalty"])) {
		return `Benefits candidate ready in ${spaceName}`;
	}
	if (bundleHasAny(bundle, ["split", "participant"])) {
		return `Split candidate ready in ${spaceName}`;
	}
	if (
		bundleHasAny(bundle, [
			"payment_proof",
			"privacy",
			"merge",
			"supporting_document",
			"space_suggestion",
		])
	) {
		return `Document candidate ready for review in ${spaceName}`;
	}
	if (bundle.candidates.length) {
		return `Parsed result ready for review in ${spaceName}`;
	}
	if (bundle.capabilityNotice) {
		return `Basic parse finished in ${spaceName}; smart candidates are gated by plan.`;
	}
	return "Ceits parsed the input, but needs clearer expense details before creating a draft.";
};

const CandidateBundlePanel = ({
	bundle,
	expensesHref,
	benefitsHref,
	splitsHref,
	reviewHref,
}: {
	bundle: GlobalComposerCandidateBundle;
	expensesHref: string;
	benefitsHref: string;
	splitsHref: string;
	reviewHref: string;
}) => {
	if (!bundle.candidates.length && !bundle.capabilityNotice) return null;

	const hasExpense = bundleHasAny(bundle, ["expense", "expense_item"]);
	const hasBenefits = bundleHasAny(bundle, ["promo", "loyalty"]);
	const hasSplits = bundleHasAny(bundle, ["split", "participant"]);
	const hasReviewFlowSignals = bundleHasAny(bundle, [
		"payment_proof",
		"privacy",
		"merge",
		"supporting_document",
		"space_suggestion",
		"recurring",
		"membership",
		"reminder",
	]);
	const visibleCandidates = bundle.candidates.slice(0, 5);
	const hiddenCount = bundle.candidates.length - visibleCandidates.length;

	return (
		<div
			className="border-t border-border/45 bg-muted/25 px-3.5 py-2"
			data-testid="global-composer-candidate-summary"
		>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Parsed result
					</p>
					{visibleCandidates.length ? (
						<div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
							{visibleCandidates.map((candidate) => (
								<span
									className="inline-flex h-6 items-center rounded-full border border-[rgba(120,100,80,0.18)] bg-background px-2 text-[11px] font-semibold text-foreground/78"
									key={candidate.kind}
								>
									{candidate.count > 1
										? `${candidate.count} ${candidate.label}`
										: candidate.label}
								</span>
							))}
							{hiddenCount > 0 ? (
								<span className="inline-flex h-6 items-center rounded-full border border-dashed border-border bg-transparent px-2 text-[11px] font-semibold text-muted-foreground">
									+{hiddenCount} more
								</span>
							) : null}
						</div>
					) : null}
					{bundleHasAny(bundle, [
						"payment_proof",
						"privacy",
						"merge",
						"supporting_document",
					]) ? (
						<p className="mt-1.5 max-w-3xl text-[11px] leading-4 text-muted-foreground">
							This result should be reviewed as a document signal, not saved as
							a duplicate expense automatically.
						</p>
					) : null}
					{bundle.capabilityNotice ? (
						<p className="mt-1.5 max-w-3xl text-[11px] leading-4 text-muted-foreground">
							{bundle.capabilityNotice}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
					{hasExpense ? (
						<Link className={reviewActionClass} to={expensesHref}>
							Review expenses
						</Link>
					) : null}
					{hasBenefits ? (
						<Link className={reviewActionClass} to={benefitsHref}>
							Review benefits
						</Link>
					) : null}
					{hasSplits ? (
						<Link className={reviewActionClass} to={splitsHref}>
							Review splits
						</Link>
					) : null}
					{hasReviewFlowSignals ? (
						<Link className={reviewActionClass} to={reviewHref}>
							Review flow
						</Link>
					) : null}
				</div>
			</div>
		</div>
	);
};

const reviewActionClass =
	"inline-flex h-7 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.22)] bg-card px-2.5 text-[11px] font-semibold text-foreground/82 transition hover:border-[rgba(120,100,80,0.34)] hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const clarificationActionClass =
	"inline-flex h-8 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.22)] bg-background px-3 text-xs font-semibold text-foreground/82 transition hover:border-[rgba(120,100,80,0.34)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45";

const ClarificationActionsPanel = ({
	chatHref,
	disabled,
	hasSpaceContext,
	onAddExpense,
	onAskCeits,
	onCreateSpace,
	spacesHref,
}: {
	chatHref: string;
	disabled: boolean;
	hasSpaceContext: boolean;
	onAddExpense: () => void;
	onAskCeits: () => void;
	onCreateSpace: () => void;
	spacesHref: string;
}) => (
	<div
		className="border-t border-border/45 bg-card/55 px-3.5 py-2"
		data-testid="global-composer-clarification-actions"
	>
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					Choose next step
				</p>
				<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
					Ceits is not sure whether this should become a record, a question, or
					a chat message.
				</p>
			</div>
			<div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
				<button
					className={clarificationActionClass}
					disabled={disabled}
					onClick={onAddExpense}
					type="button"
				>
					Add expense
				</button>
				<button
					className={clarificationActionClass}
					disabled={disabled}
					onClick={onAskCeits}
					type="button"
				>
					Ask Ceits
				</button>
				{hasSpaceContext ? (
					<Link className={clarificationActionClass} to={chatHref}>
						Open chat
					</Link>
				) : (
					<>
						<Link className={clarificationActionClass} to={spacesHref}>
							Choose space
						</Link>
						<button
							className={clarificationActionClass}
							onClick={onCreateSpace}
							type="button"
						>
							New space
						</button>
					</>
				)}
			</div>
		</div>
	</div>
);

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
	const { user } = useAuth();
	const { selectedSpaceId, spaces, isLoading, setCreateSpaceDialogOpen } =
		useWorkspaceSpaces();
	const composerRef = useRef<SmartTextareaComposerHandle | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const [busy, setBusy] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [pendingComposerState, setPendingComposerState] =
		useState<ComposerState | null>(null);
	const [statusText, setStatusText] = useState<string | null>(null);
	const [errorText, setErrorText] = useState<string | null>(null);
	const {
		flow: composerFlow,
		beginDetecting,
		clarify,
		complete,
		fail,
		showCandidateSummary,
	} = useGlobalComposerFlow();

	const hasNativeComposer = hasNativeChatComposer(location.pathname);
	const settingsActionDock = hasSettingsActionDock(location.pathname);
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
	const userDisplay =
		user?.name?.trim() || user?.email?.split("@")[0] || "Account";
	const userInitial = userDisplay.trim().charAt(0).toUpperCase() || "?";
	const spaceSettingsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/settings/spaces/${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceOverviewHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/overview`;
	const activeSpaceChatHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceBenefitsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/benefits`;
	const activeSpaceSplitsHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/spaces/${encodeURIComponent(String(activeSpaceId))}/splits`;
	const activeSpaceExpensesHref =
		activeSpaceId == null
			? "/console/settings/spaces"
			: `/console/chat/expenses?spaceId=${encodeURIComponent(String(activeSpaceId))}`;
	const activeSpaceReviewHref =
		activeSpaceId == null
			? "/console/review"
			: `/console/review?spaceId=${encodeURIComponent(String(activeSpaceId))}`;

	const disabled = busy || isLoading || !hasSpaceContext;
	const composerNotice =
		errorText ??
		statusText ??
		(!hasSpaceContext
			? "Choose a space before capturing expenses or posting messages."
			: (composerFlow.message ?? null));

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
				return false;
			}
			await createManualDraftInSpace(spaceId, description, draftItems);
			return true;
		},
		[],
	);

	const handleSubmit = useCallback(
		async (payload: ComposerPayload) => {
			if (activeSpaceId == null) {
				clarify(
					"Choose a space first. Soon Ceits will also help create or suggest the right space from here.",
				);
				return;
			}
			setBusy(true);
			setErrorText(null);
			try {
				if (payload.composer_mode === "expense") {
					if (payload.expense_input_type === "text") {
						beginDetecting("text");
						const text = payload.content.trim();
						const parsed = await parseCaptureText(text, {
							spaceId: activeSpaceId,
						});
						const bundle = summarizeCapturePreview(parsed, {
							fallbackIntent: "expense",
							inputKind: "text",
							spaceId: activeSpaceId,
						});
						showCandidateSummary(bundle);
						const savedDraft = await createDraftFromParsed(
							activeSpaceId,
							text,
							parsed.items,
						);
						showTransientStatus(
							savedDraft
								? `Draft saved to ${activeSpaceName}`
								: candidateOnlyStatus(bundle, activeSpaceName),
						);
					} else if (payload.expense_input_type === "photo") {
						beginDetecting("photo");
						const parsed = await parseCapturePhoto(payload.file, {
							spaceId: activeSpaceId,
						});
						const bundle = summarizeCapturePreview(parsed, {
							fallbackIntent: "expense",
							inputKind: "photo",
							spaceId: activeSpaceId,
						});
						showCandidateSummary(bundle);
						const savedDraft = await createDraftFromParsed(
							activeSpaceId,
							payload.file.name || "Receipt photo",
							parsed.items,
						);
						showTransientStatus(
							savedDraft
								? `Receipt draft saved to ${activeSpaceName}`
								: candidateOnlyStatus(bundle, activeSpaceName),
						);
					}
					return;
				}

				const text =
					payload.composer_mode === "message"
						? payload.content.trim()
						: askPayloadToMessage(payload).trim();
				if (!text) return;
				beginDetecting(payload.composer_mode === "message" ? "message" : "ask");
				const intentPreview = await parseCaptureIntentText(text, {
					spaceId: activeSpaceId,
				});
				const bundle = summarizeCaptureIntentPreview(intentPreview, {
					fallbackIntent: payload.composer_mode,
					inputKind: payload.composer_mode === "message" ? "message" : "ask",
					spaceId: activeSpaceId,
				});
				if (bundle.clarificationMessage) {
					clarify(bundle.clarificationMessage);
					return;
				}
				if (bundle.candidates.length > 0 || bundle.capabilityNotice) {
					showCandidateSummary(bundle);
					showTransientStatus(candidateOnlyStatus(bundle, activeSpaceName));
					return;
				}
				if (
					intentPreview.next_action === "open_chat" ||
					intentPreview.intent === "chat_message"
				) {
					complete(`Open chat to send this in ${activeSpaceName}`);
					showTransientStatus(`Open chat to send this in ${activeSpaceName}`);
					return;
				}
				complete(`Ceits understood this as ${intentPreview.intent}.`);
				showTransientStatus(
					`Ceits understood this as ${intentPreview.intent}.`,
				);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Composer failed";
				fail(message);
				setErrorText(message);
			} finally {
				setBusy(false);
			}
		},
		[
			activeSpaceId,
			activeSpaceName,
			beginDetecting,
			clarify,
			complete,
			createDraftFromParsed,
			fail,
			showCandidateSummary,
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
			beginDetecting("voice");
			const parsed = await parseCaptureVoice(
				blob,
				recorder.mimeType || "audio/webm",
				{ spaceId: activeSpaceId },
			);
			const bundle = summarizeCapturePreview(parsed, {
				fallbackIntent: "expense",
				inputKind: "voice",
				spaceId: activeSpaceId,
			});
			showCandidateSummary(bundle);
			const savedDraft = await createDraftFromParsed(
				activeSpaceId,
				parsed.transcription?.trim() || "Voice expense",
				parsed.items,
			);
			showTransientStatus(
				savedDraft
					? `Voice draft saved to ${activeSpaceName}`
					: candidateOnlyStatus(bundle, activeSpaceName),
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to parse voice";
			fail(message);
			setErrorText(message);
		} finally {
			setBusy(false);
		}
	}, [
		activeSpaceId,
		activeSpaceName,
		beginDetecting,
		createDraftFromParsed,
		fail,
		showCandidateSummary,
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

	const actionButtonClass =
		"inline-flex h-8 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.22)] bg-card/90 px-3 text-xs font-semibold text-foreground/85 transition hover:border-[rgba(120,100,80,0.34)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45";
	const dockLinkClass =
		"inline-flex h-8 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.22)] bg-card/90 px-3 text-xs font-semibold text-foreground/85 transition-[background-color,border-color,transform] hover:border-[rgba(120,100,80,0.34)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]";
	const userLinkClass =
		"inline-flex h-8 min-w-0 shrink-0 items-center gap-2 rounded-full border border-border/70 bg-background px-2.5 text-xs font-semibold text-foreground/85 shadow-sm transition-[background-color,transform] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]";
	const settingsActionClass =
		"inline-flex h-9 shrink-0 items-center rounded-full border border-[rgba(120,100,80,0.22)] bg-card/90 px-3.5 text-xs font-semibold text-foreground/85 transition-[background-color,border-color,transform] hover:border-[rgba(120,100,80,0.34)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]";

	if (settingsActionDock) {
		return (
			<div
				className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center border-t border-border/55 bg-background/80 px-3 pb-3 pt-2 shadow-[0_-18px_44px_-36px_rgba(44,32,18,0.45)] backdrop-blur-xl sm:px-5"
				data-testid="global-composer-dock"
			>
				<div
					className="pointer-events-auto flex w-full max-w-5xl flex-col gap-2 rounded-2xl border border-border/70 bg-background/94 p-2.5 shadow-[0_18px_52px_-34px_rgba(44,32,18,0.5)] ring-1 ring-white/55 sm:flex-row sm:items-center sm:justify-between"
					data-testid="settings-action-dock"
				>
					<div className="min-w-0 px-1">
						<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							Settings surface
						</p>
						<p className="mt-0.5 truncate text-sm font-semibold text-foreground">
							{activeSpaceId == null
								? "Account and workspace settings"
								: `${activeSpaceName} settings`}
						</p>
					</div>
					<div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
						<Link
							className={settingsActionClass}
							to="/console/settings/account"
						>
							Account
						</Link>
						<Link className={settingsActionClass} to="/console/settings/spaces">
							All spaces
						</Link>
						{hasSpaceContext ? (
							<>
								<Link className={settingsActionClass} to={spaceSettingsHref}>
									Space settings
								</Link>
								<Link
									className={settingsActionClass}
									to={activeSpaceOverviewHref}
								>
									Open space
								</Link>
								<Link className={settingsActionClass} to={activeSpaceChatHref}>
									Open chat
								</Link>
							</>
						) : (
							<button
								className={settingsActionClass}
								onClick={() => setCreateSpaceDialogOpen(true)}
								type="button"
							>
								New space
							</button>
						)}
						<Link className={userLinkClass} to="/console/settings/account">
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase text-secondary-foreground">
								{userInitial}
							</span>
							<span className="hidden max-w-[8rem] truncate sm:inline">
								{userDisplay}
							</span>
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center border-t border-border/55 bg-background/80 px-3 pb-3 pt-2 shadow-[0_-18px_44px_-36px_rgba(44,32,18,0.45)] backdrop-blur-xl sm:px-5"
			data-testid="global-composer-dock"
		>
			<div className="pointer-events-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-border/70 bg-background/94 shadow-[0_18px_52px_-34px_rgba(44,32,18,0.5)] ring-1 ring-white/55">
				{isCollapsed ? (
					<div className="grid gap-2 p-2.5 xl:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_auto_auto] xl:items-center">
						<div className="min-w-0 px-1">
							<p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
								Context: {activeSpaceName}
							</p>
							{contextSource ? (
								<p className="mt-0.5 truncate text-[11px] text-muted-foreground/75">
									{contextSource}
								</p>
							) : null}
						</div>
						<button
							aria-label="Expand global composer"
							className="flex h-11 min-w-0 items-center rounded-xl border border-[rgba(120,100,80,0.18)] bg-card/82 px-3.5 text-left text-sm text-muted-foreground shadow-inner transition hover:border-[rgba(120,100,80,0.3)] hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
							disabled={disabled}
							onClick={() => expandTo("message_text")}
							type="button"
						>
							<span className="truncate">What would you like to do?</span>
						</button>
						<div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
							<button
								className={actionButtonClass}
								disabled={disabled}
								onClick={() => expandTo("expense_method_select")}
								type="button"
							>
								Add expense
							</button>
							<button
								className={actionButtonClass}
								disabled={disabled}
								onClick={() => expandTo("ask_topic_select")}
								type="button"
							>
								Ask Ceits
							</button>
							<Link className={dockLinkClass} to={spaceSettingsHref}>
								Space settings
							</Link>
							{hasSpaceContext ? (
								<Link
									className={dockLinkClass}
									to={`/console/chat?spaceId=${encodeURIComponent(String(activeSpaceId))}`}
								>
									Open chat
								</Link>
							) : (
								<Link className={dockLinkClass} to="/console/settings/spaces">
									Choose space
								</Link>
							)}
						</div>
						<Link className={userLinkClass} to="/console/settings/account">
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold uppercase text-secondary-foreground">
								{userInitial}
							</span>
							<span className="hidden max-w-[8rem] truncate sm:inline">
								{userDisplay}
							</span>
						</Link>
					</div>
				) : (
					<>
						<div className="flex items-center justify-between gap-3 border-b border-border/40 px-3.5 py-1.5">
							<p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Context: {activeSpaceName}
								{contextSource ? ` · ${contextSource}` : ""}
							</p>
							<div className="flex shrink-0 items-center gap-3">
								<button
									aria-label="Collapse global composer"
									aria-pressed={isCollapsed}
									className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={handleCollapseToggle}
									type="button"
								>
									Collapse
								</button>
								{hasSpaceContext ? (
									<Link
										className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
										to={spaceSettingsHref}
									>
										Space settings
									</Link>
								) : (
									<Link
										className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
										to="/console/settings/spaces"
									>
										Spaces
									</Link>
								)}
								<Link
									className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
									to="/console/settings/account"
								>
									Account
								</Link>
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
					</>
				)}
				{composerFlow.bundle ? (
					<CandidateBundlePanel
						benefitsHref={activeSpaceBenefitsHref}
						bundle={composerFlow.bundle}
						expensesHref={activeSpaceExpensesHref}
						reviewHref={activeSpaceReviewHref}
						splitsHref={activeSpaceSplitsHref}
					/>
				) : null}
				{composerFlow.step === "clarifying" ? (
					<ClarificationActionsPanel
						chatHref={activeSpaceChatHref}
						disabled={busy || isLoading || !hasSpaceContext}
						hasSpaceContext={hasSpaceContext}
						onAddExpense={() => expandTo("expense_method_select")}
						onAskCeits={() => expandTo("ask_topic_select")}
						onCreateSpace={() => setCreateSpaceDialogOpen(true)}
						spacesHref="/console/settings/spaces"
					/>
				) : null}
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
