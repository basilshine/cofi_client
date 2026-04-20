import type {
	DashboardQuickCapture,
	DashboardQuickCaptureSpace,
	Space,
} from "@cofi/api";
import {
	type ChangeEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import {
	createManualDraftInSpace,
	parsePhotoInSpace,
	parseVoiceInSpace,
} from "../../../shared/lib/quickCaptureTransactions";
import {
	orderSpacesByRecent,
	touchRecentSpaceId,
} from "../../../shared/lib/recentSpaceIds";

const PAGE_SIZE = 2;

const chipCore =
	"min-h-[2.5rem] min-w-0 rounded-xl border px-2.5 py-1.5 text-center text-sm font-medium tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]";

/** Full-width space chips (not for the pager — that needs auto width). */
const spaceChipBase = `${chipCore} w-full`;

const pagerChip = `${chipCore} box-border flex size-10 shrink-0 items-center justify-center border-dashed border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/35 p-0 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-muted))]/60`;

const IconChevronRight = ({
	className = "h-5 w-5",
}: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		viewBox="0 0 24 24"
	>
		<title>Next</title>
		<path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const IconChevronLeft = ({ className = "h-5 w-5" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		viewBox="0 0 24 24"
	>
		<title>Previous</title>
		<path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const IconCamera = ({ className = "h-10 w-10" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.6}
		viewBox="0 0 24 24"
	>
		<title>Camera</title>
		<path
			d="M4 7.5A2.5 2.5 0 016.5 5h2L10 3h4l1.5 2h2A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5v-9z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M12 16a4 4 0 100-8 4 4 0 000 8z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconMic = ({ className = "h-10 w-10" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.6}
		viewBox="0 0 24 24"
	>
		<title>Microphone</title>
		<path
			d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M5 11a7 7 0 0014 0M12 18v3"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconStop = ({ className = "h-10 w-10" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="currentColor"
		viewBox="0 0 24 24"
	>
		<title>Stop</title>
		<rect height="14" rx="1.5" width="14" x="5" y="5" />
	</svg>
);

const IconCompose = ({ className = "h-10 w-10" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.6}
		viewBox="0 0 24 24"
	>
		<title>Compose</title>
		<path
			d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const IconChat = ({ className = "h-10 w-10" }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={1.6}
		viewBox="0 0 24 24"
	>
		<title>Chat</title>
		<path
			d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const asNum = (id: string | number | undefined): number =>
	id == null ? 0 : Number(id);

type Props = {
	qc: DashboardQuickCapture;
	/** Tenant scope for Chat navigation and scoped space lists. */
	chatWorkspace: ChatWorkspaceScope | null;
	/** Updates dashboard shell title, e.g. “Quick capture · Personal”. */
	onActiveSpacePresented?: (spaceName: string | null) => void;
	/** Optional external space selection (shared dashboard context). */
	selectedSpaceId?: number | null;
	/** Called when selection changes in-widget. */
	onSelectedSpaceChange?: (spaceId: number) => void;
	/** Show internal space picker. Set false when parent provides shared picker. */
	showSpacePicker?: boolean;
	/** High-contrast tiles for the dark dashboard hero. */
	visualVariant?: "default" | "heroDark";
};

export const QuickCaptureWidget = ({
	qc,
	chatWorkspace,
	onActiveSpacePresented,
	selectedSpaceId = null,
	onSelectedSpaceChange,
	showSpacePicker = true,
	visualVariant = "default",
}: Props): ReactNode => {
	const navigate = useNavigate();
	const photoInputRef = useRef<HTMLInputElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const [selectedId, setSelectedId] = useState<number>(() => {
		const d = asNum(qc.default_space_id);
		if (d > 0) return d;
		return asNum(qc.spaces[0]?.id);
	});
	const [storageRev, setStorageRev] = useState(0);
	const [spacePage, setSpacePage] = useState(0);
	const [allSpaces, setAllSpaces] = useState<Space[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);
	const [isRecording, setIsRecording] = useState(false);

	const catalogOrdered = useMemo(() => {
		if (allSpaces != null && allSpaces.length > 0) {
			return orderSpacesByRecent(allSpaces);
		}
		return orderSpacesByRecent(qc.spaces);
	}, [allSpaces, qc.spaces, storageRev]);

	const totalPages = Math.max(1, Math.ceil(catalogOrdered.length / PAGE_SIZE));
	const pageSlice = useMemo(() => {
		const start = spacePage * PAGE_SIZE;
		return catalogOrdered.slice(start, start + PAGE_SIZE);
	}, [catalogOrdered, spacePage]);

	const activeSpaceName = useMemo(() => {
		const row = catalogOrdered.find((s) => asChipId(s) === selectedId);
		return row?.name?.trim() ?? null;
	}, [catalogOrdered, selectedId]);

	useEffect(() => {
		setSpacePage((p) => (p >= totalPages ? 0 : p));
	}, [totalPages]);

	useEffect(() => {
		if (!qc.spaces.length) return;
		setSelectedId((prev) => {
			if (prev > 0 && catalogOrdered.some((s) => asChipId(s) === prev)) {
				return prev;
			}
			const d = asNum(qc.default_space_id);
			if (d > 0 && catalogOrdered.some((s) => asChipId(s) === d)) return d;
			return catalogOrdered[0]
				? asChipId(catalogOrdered[0])
				: asChipId(qc.spaces[0]);
		});
	}, [qc.default_space_id, qc.spaces, catalogOrdered]);

	useEffect(() => {
		if (selectedSpaceId == null) return;
		if (!Number.isFinite(Number(selectedSpaceId))) return;
		setSelectedId(Number(selectedSpaceId));
	}, [selectedSpaceId]);

	useEffect(() => {
		onActiveSpacePresented?.(activeSpaceName);
	}, [activeSpaceName, onActiveSpacePresented]);

	useEffect(() => {
		return () => {
			onActiveSpacePresented?.(null);
		};
	}, [onActiveSpacePresented]);

	const handlePickChip = useCallback(
		(space: DashboardQuickCaptureSpace | Space) => {
			const id = asChipId(space);
			if (id <= 0) return;
			touchRecentSpaceId(id);
			setStorageRev((v) => v + 1);
			setSelectedId(id);
			onSelectedSpaceChange?.(id);
		},
		[onSelectedSpaceChange],
	);

	const handleMoreSpaces = useCallback(async () => {
		if (busy) return;
		if (chatWorkspace == null) {
			setLocalError("Workspace context is not ready yet.");
			return;
		}
		setLocalError(null);
		let list = allSpaces;
		if (list == null) {
			try {
				list = await apiClient.spaces.list({ tenantId: null });
				setAllSpaces(list);
			} catch (e) {
				setLocalError(
					e instanceof Error ? e.message : "Could not load more spaces",
				);
				return;
			}
		}
		const ordered =
			list && list.length > 0
				? orderSpacesByRecent(list)
				: orderSpacesByRecent(qc.spaces);
		const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
		setSpacePage((p) => (p + 1) % pages);
	}, [allSpaces, busy, chatWorkspace, qc.spaces]);

	const goToChatAfterCapture = useCallback(() => {
		if (selectedId <= 0) return;
		if (chatWorkspace == null) return;
		touchRecentSpaceId(selectedId);
		navigate("/console/chat", {
			state: {
				chatWorkspace,
				selectSpaceId: selectedId,
			},
		});
	}, [chatWorkspace, navigate, selectedId]);

	const submitParsed = useCallback(
		async (
			description: string,
			items: { name: string; amount: number; tags?: string[] }[],
		) => {
			if (selectedId <= 0 || !items.length) return;
			await createManualDraftInSpace(selectedId, description, items);
			goToChatAfterCapture();
		},
		[goToChatAfterCapture, selectedId],
	);

	const handlePhotoChange = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0] ?? null;
			e.target.value = "";
			if (!file || selectedId <= 0) return;
			setBusy(true);
			setLocalError(null);
			try {
				const items = await parsePhotoInSpace(selectedId, file);
				if (!items.length) {
					setLocalError("Nothing parsed from this image — try another photo.");
					return;
				}
				const description = `Photo: ${file.name}`;
				await submitParsed(description, items);
			} catch (err) {
				setLocalError(
					err instanceof Error ? err.message : "Could not process photo",
				);
			} finally {
				setBusy(false);
			}
		},
		[selectedId, submitParsed],
	);

	const handleStopRecordingAndSend = useCallback(async () => {
		const rec = mediaRecorderRef.current;
		if (!rec) return;
		if (rec.state !== "recording") return;

		const stopPromise = new Promise<void>((resolve) => {
			rec.addEventListener("stop", () => resolve(), { once: true });
		});
		rec.stop();
		await stopPromise;

		const blob = new Blob(mediaChunksRef.current, {
			type: rec.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];
		mediaRecorderRef.current = null;
		setIsRecording(false);

		if (!blob.size || selectedId <= 0) return;
		setBusy(true);
		setLocalError(null);
		try {
			const { items, transcription } = await parseVoiceInSpace(
				selectedId,
				blob,
				rec.mimeType || "audio/webm",
			);
			if (!items.length) {
				setLocalError(
					"Nothing parsed from voice — try speaking amounts clearly.",
				);
				return;
			}
			const description = transcription.trim() || "Voice expense";
			await submitParsed(description, items);
		} catch (err) {
			setLocalError(
				err instanceof Error ? err.message : "Could not process voice",
			);
		} finally {
			setBusy(false);
		}
	}, [selectedId, submitParsed]);

	const handleMicClick = useCallback(async () => {
		if (selectedId <= 0 || busy) return;
		setLocalError(null);
		if (isRecording) {
			await handleStopRecordingAndSend();
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const rec = new MediaRecorder(stream);
			mediaRecorderRef.current = rec;
			mediaChunksRef.current = [];
			rec.addEventListener("dataavailable", (ev) => {
				if (ev.data?.size) mediaChunksRef.current.push(ev.data);
			});
			rec.addEventListener(
				"stop",
				() => {
					for (const t of stream.getTracks()) {
						t.stop();
					}
				},
				{ once: true },
			);
			rec.start();
			setIsRecording(true);
		} catch (e) {
			setIsRecording(false);
			setLocalError(
				e instanceof Error ? e.message : "Microphone permission denied",
			);
		}
	}, [busy, handleStopRecordingAndSend, isRecording, selectedId]);

	const handleBeforeNavigate = useCallback(() => {
		if (selectedId > 0) touchRecentSpaceId(selectedId);
	}, [selectedId]);

	const chipSelected = (id: number) =>
		id === selectedId
			? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/12 text-[hsl(var(--text-primary))] shadow-sm ring-1 ring-[hsl(var(--accent))]/35"
			: "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))]/90 text-[hsl(var(--text-primary))] shadow-sm hover:border-[hsl(var(--accent))]/25 hover:bg-[hsl(var(--surface-muted))]";

	const isHeroDark = visualVariant === "heroDark";

	const iconClass = isHeroDark
		? "pointer-events-none h-9 w-9 shrink-0 text-amber-300 sm:h-10 sm:w-10"
		: "pointer-events-none h-10 w-10 shrink-0 text-[hsl(var(--accent))]";

	const actionTile = isHeroDark
		? "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-white/15 bg-white/10 px-2 py-2.5 text-zinc-50 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.85)] backdrop-blur-sm transition hover:border-amber-400/35 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-45 sm:min-h-[5rem]"
		: "flex size-[4.75rem] sm:size-20 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--border-subtle))] bg-gradient-to-b from-[hsl(var(--surface))] to-[hsl(var(--surface-muted))]/50 text-[hsl(var(--text-primary))] shadow-sm transition hover:border-[hsl(var(--accent))]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-45";

	const recordingTile = isHeroDark
		? "border-red-400/50 bg-red-500/15 text-red-100 animate-pulse"
		: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300 animate-pulse";

	const actionsDisabled = selectedId <= 0 || busy;
	/** Pager until full catalog is known; then hide if everything fits one page. */
	const showMoreButton = allSpaces == null || totalPages > 1;
	const atLastSpacePage = totalPages > 1 && spacePage >= totalPages - 1;

	return (
		<div className="relative">
			{busy ? (
				<div
					aria-live="polite"
					className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[hsl(var(--bg))]/35 backdrop-blur-[1px]"
				>
					<span className="flex items-center gap-2 rounded-full bg-[hsl(var(--surface))] px-4 py-2 text-sm font-medium text-[hsl(var(--text-primary))] shadow-md">
						<Spinner />
						Working…
					</span>
				</div>
			) : null}

			<div className="space-y-3">
				<div
					aria-label={`Capture actions for ${activeSpaceName ?? "selected space"}`}
					className={
						isHeroDark
							? "mx-auto grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3"
							: "mx-auto grid w-full max-w-md grid-cols-3 place-items-center gap-4 sm:max-w-lg sm:gap-5"
					}
					role="group"
				>
					<label
						className={`${actionTile} ${actionsDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
					>
						<input
							ref={photoInputRef}
							accept="image/*"
							aria-label="Add photo — choose file or camera"
							className="sr-only"
							disabled={actionsDisabled}
							onChange={(e) => void handlePhotoChange(e)}
							type="file"
						/>
						<IconCamera className={iconClass} />
						{isHeroDark ? (
							<span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
								Photo
							</span>
						) : null}
					</label>

					<button
						aria-label={isRecording ? "Stop and send voice" : "Record voice"}
						aria-pressed={isRecording}
						className={`${actionTile} ${isRecording ? recordingTile : ""}`}
						disabled={actionsDisabled}
						onClick={() => void handleMicClick()}
						type="button"
					>
						{isRecording ? (
							<IconStop
								className={
									isHeroDark
										? "pointer-events-none h-9 w-9 shrink-0 sm:h-10 sm:w-10"
										: "pointer-events-none h-10 w-10 shrink-0"
								}
							/>
						) : (
							<IconMic className={iconClass} />
						)}
						{isHeroDark ? (
							<span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
								{isRecording ? "Stop" : "Voice"}
							</span>
						) : null}
					</button>

					{isHeroDark ? (
						<Link
							aria-disabled={actionsDisabled || chatWorkspace == null}
							aria-label="Write a message in chat"
							className={`${actionTile} ${actionsDisabled || chatWorkspace == null ? "pointer-events-none opacity-45" : ""}`}
							onClick={(e) => {
								if (actionsDisabled || chatWorkspace == null)
									e.preventDefault();
								else handleBeforeNavigate();
							}}
							state={
								chatWorkspace
									? {
											chatWorkspace,
											selectSpaceId: selectedId,
											focusMessageComposer: true,
										}
									: undefined
							}
							to="/console/chat"
						>
							<IconCompose className={iconClass} />
							<span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
								Write
							</span>
						</Link>
					) : null}

					<Link
						aria-disabled={actionsDisabled || chatWorkspace == null}
						aria-label="Open chat"
						className={`${actionTile} ${actionsDisabled || chatWorkspace == null ? "pointer-events-none opacity-45" : ""}`}
						onClick={(e) => {
							if (actionsDisabled || chatWorkspace == null) e.preventDefault();
							else handleBeforeNavigate();
						}}
						state={
							chatWorkspace
								? { chatWorkspace, selectSpaceId: selectedId }
								: undefined
						}
						to="/console/chat"
					>
						<IconChat
							className={
								isHeroDark
									? "pointer-events-none h-9 w-9 shrink-0 text-zinc-200 sm:h-10 sm:w-10"
									: "pointer-events-none h-10 w-10 shrink-0 text-[hsl(var(--text-secondary))]"
							}
						/>
						{isHeroDark ? (
							<span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
								Chat
							</span>
						) : null}
					</Link>
				</div>

				{showSpacePicker ? (
					<section
						aria-labelledby="quick-capture-spaces-heading"
						className="space-y-3 border-t border-[hsl(var(--border-subtle))]/60 pt-4"
					>
						<header className="space-y-1.5">
							<div className="flex items-center gap-2.5">
								<span
									aria-hidden
									className="h-2 w-0.5 shrink-0 rounded-full bg-[hsl(var(--accent))] ring-2 ring-[hsl(var(--accent))]/35"
								/>
								<h3
									className="font-heading text-sm font-semibold tracking-tight text-[hsl(var(--text-primary))]"
									id="quick-capture-spaces-heading"
								>
									Spaces
								</h3>
							</div>
							<p className="border-l-2 border-[hsl(var(--accent))]/20 pl-3 text-[10px] leading-tight text-[hsl(var(--text-secondary))] sm:text-[10px]">
								Pick a space for capture.
							</p>
						</header>
						<p className="sr-only">
							Choose a space. Two recent spaces at a time; the arrow control
							shows more or returns to the start. Currently{" "}
							{activeSpaceName ?? "a space"} is selected.
						</p>
						<div
							className="flex min-w-0 flex-nowrap items-stretch gap-2 sm:gap-2.5"
							role="toolbar"
						>
							<div
								className={`grid min-w-0 flex-1 gap-2 sm:gap-2.5 ${pageSlice.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
							>
								{pageSlice.map((s) => {
									const id = asChipId(s);
									return (
										<button
											aria-pressed={id === selectedId}
											className={`${spaceChipBase} ${chipSelected(id)}`}
											disabled={busy}
											key={id}
											onClick={() => handlePickChip(s)}
											type="button"
										>
											<span className="block truncate">{s.name}</span>
										</button>
									);
								})}
							</div>
							{showMoreButton ? (
								<button
									aria-label={
										atLastSpacePage
											? "Back to first spaces"
											: "Show more spaces"
									}
									className={`${pagerChip} text-[hsl(var(--text-primary))]`}
									disabled={busy}
									onClick={() => void handleMoreSpaces()}
									type="button"
								>
									{atLastSpacePage ? (
										<IconChevronLeft className="pointer-events-none shrink-0" />
									) : (
										<IconChevronRight className="pointer-events-none shrink-0" />
									)}
								</button>
							) : null}
						</div>
					</section>
				) : null}

				{localError ? (
					<p
						className="text-center text-xs text-red-600 dark:text-red-400"
						role="alert"
					>
						{localError}
					</p>
				) : null}
			</div>
		</div>
	);
};

const Spinner = () => (
	<svg
		aria-hidden
		className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--accent))]"
		fill="none"
		viewBox="0 0 24 24"
	>
		<title>Loading</title>
		<circle
			className="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
		/>
		<path
			className="opacity-75"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			fill="currentColor"
		/>
	</svg>
);

const asChipId = (s: DashboardQuickCaptureSpace | Space): number => asNum(s.id);
