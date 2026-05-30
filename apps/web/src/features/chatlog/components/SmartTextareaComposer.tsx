import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

// ─── State machine ──────────────────────────────────────────────────────────

export type ComposerState =
	| "idle"
	| "expense_method_select"
	| "expense_text"
	| "expense_voice"
	| "expense_photo"
	| "ask_topic_select"
	| "ask_period_expenses"
	| "ask_find_expense"
	| "ask_next_payment"
	| "ask_split_balance"
	| "ask_custom"
	| "message_text";

// ─── Payload types ───────────────────────────────────────────────────────────

export type ComposerPayload =
	| {
			composer_mode: "expense";
			expense_input_type: "text";
			space_id: string | number;
			content: string;
	  }
	| {
			composer_mode: "expense";
			expense_input_type: "photo";
			space_id: string | number;
			file: File;
	  }
	| {
			composer_mode: "ask";
			ask_type: "period_expenses";
			space_id: string | number;
			period: string;
			content?: string;
	  }
	| {
			composer_mode: "ask";
			ask_type: "find_expense";
			space_id: string | number;
			content: string;
	  }
	| {
			composer_mode: "ask";
			ask_type: "next_payment";
			space_id: string | number;
			period: string;
	  }
	| {
			composer_mode: "ask";
			ask_type: "split_balance";
			space_id: string | number;
			content?: string;
	  }
	| {
			composer_mode: "ask";
			ask_type: "custom";
			space_id: string | number;
			content: string;
	  }
	| {
			composer_mode: "message";
			space_id: string | number;
			content: string;
	  };

// ─── Imperative handle ───────────────────────────────────────────────────────

export type SmartTextareaComposerHandle = {
	navigateTo: (state: ComposerState) => void;
	composeText: (state: ComposerState, text: string) => void;
	insertMessage: (text: string) => void;
	triggerPhotoUpload: () => void;
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
	spaceId: string | number;
	disabled?: boolean;
	isRecording: boolean;
	onComposerSubmit: (payload: ComposerPayload) => void;
	onStartExpenseRecording: () => void;
	onStopRecording: () => void | Promise<void>;
	onCancelRecording?: () => void;
	surface?: "chat" | "dock";
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TEXT_STATES: ComposerState[] = [
	"expense_text",
	"ask_period_expenses",
	"ask_find_expense",
	"ask_split_balance",
	"ask_custom",
	"message_text",
];

const PERIOD_OPTIONS = [
	"Today",
	"Yesterday",
	"This week",
	"This month",
	"Choose period",
] as const;

const FIND_FILTERS = [
	"By amount",
	"By merchant",
	"By date",
	"By keyword",
] as const;

const PAYMENT_FILTERS = [
	"Nearest",
	"This week",
	"This month",
	"Subscriptions",
] as const;

const BALANCE_FILTERS = [
	"Overall balance",
	"In this space",
	"Last trip",
	"By member",
] as const;

// ─── Chip sub-component ──────────────────────────────────────────────────────

type ChipProps = {
	label: string;
	selected?: boolean;
	disabled?: boolean;
	onClick: () => void;
};

const ComposerChip = ({
	label,
	selected = false,
	disabled = false,
	onClick,
}: ChipProps) => (
	<button
		aria-pressed={selected}
		className={[
			"rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
			selected
				? "border-[rgba(70,110,70,0.48)] bg-[rgba(70,110,70,0.1)] text-[hsl(140_35%_20%)] dark:text-[hsl(140_40%_72%)]"
				: "border-[rgba(120,100,80,0.32)] bg-[rgba(255,248,235,0.88)] text-[hsl(220_40%_22%)] hover:border-[rgba(120,100,80,0.52)] hover:bg-[rgba(215,185,135,0.28)] dark:border-[rgba(180,160,120,0.28)] dark:bg-[rgba(255,248,235,0.07)] dark:text-foreground dark:hover:bg-[rgba(215,185,135,0.12)]",
		].join(" ")}
		disabled={disabled}
		onClick={onClick}
		tabIndex={0}
		type="button"
	>
		{label}
	</button>
);

// ─── Main component ──────────────────────────────────────────────────────────

export const SmartTextareaComposer = forwardRef<
	SmartTextareaComposerHandle,
	Props
>(
	(
		{
			spaceId,
			disabled = false,
			isRecording,
			onComposerSubmit,
			onStartExpenseRecording,
			onStopRecording,
			onCancelRecording,
			surface = "chat",
		},
		ref,
	) => {
		const reduceMotion = useReducedMotion();

		const [state, setState] = useState<ComposerState>("idle");
		const [navStack, setNavStack] = useState<ComposerState[]>([]);
		const [textInput, setTextInput] = useState("");
		const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
		const [selectedChip, setSelectedChip] = useState<string | null>(null);

		const textareaRef = useRef<HTMLTextAreaElement>(null);
		const photoInputRef = useRef<HTMLInputElement>(null);

		const spring = reduceMotion
			? { duration: 0.01 }
			: ({ type: "spring", stiffness: 440, damping: 32 } as const);

		const transition = reduceMotion
			? { duration: 0.12 }
			: ({ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] } as const);

		// ── Internal navigation ──────────────────────────────────────────────

		const resetDraft = useCallback(() => {
			setTextInput("");
			setSelectedPeriod(null);
			setSelectedChip(null);
		}, []);

		const goTo = useCallback(
			(next: ComposerState) => {
				setNavStack((prev) => [...prev, state]);
				setState(next);
				resetDraft();
			},
			[state, resetDraft],
		);

		const goBack = useCallback(() => {
			const prev = navStack[navStack.length - 1];
			if (!prev) return;
			if (state === "expense_voice" && isRecording) {
				onCancelRecording?.();
			}
			setNavStack((s) => s.slice(0, -1));
			setState(prev);
			resetDraft();
		}, [navStack, state, isRecording, onCancelRecording, resetDraft]);

		const cancelToIdle = useCallback(() => {
			if (state === "expense_voice" && isRecording) {
				onCancelRecording?.();
			}
			setState("idle");
			setNavStack([]);
			resetDraft();
		}, [state, isRecording, onCancelRecording, resetDraft]);

		// ── Imperative handle ────────────────────────────────────────────────

		useImperativeHandle(ref, () => ({
			navigateTo: (target: ComposerState) => {
				setState(target);
				setNavStack([]);
				resetDraft();
			},
			composeText: (target: ComposerState, text: string) => {
				setState(target);
				setNavStack([]);
				setTextInput(text);
				setSelectedPeriod(null);
				setSelectedChip(null);
				window.setTimeout(() => textareaRef.current?.focus(), 100);
			},
			insertMessage: (text: string) => {
				setState("message_text");
				setNavStack([]);
				setTextInput((prev) => {
					const sep = prev.length > 0 && !/\s$/.test(prev) ? " " : "";
					return `${prev}${sep}${text}`;
				});
				window.setTimeout(() => textareaRef.current?.focus(), 100);
			},
			triggerPhotoUpload: () => {
				photoInputRef.current?.click();
			},
		}));

		// ── Auto-focus textarea on text states ───────────────────────────────

		useEffect(() => {
			if (!TEXT_STATES.includes(state)) return;
			const t = window.setTimeout(() => textareaRef.current?.focus(), 120);
			return () => window.clearTimeout(t);
		}, [state]);

		// ── Auto-resize textarea ─────────────────────────────────────────────

		useLayoutEffect(() => {
			const el = textareaRef.current;
			if (!el) return;
			el.style.height = "auto";
			el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 120)}px`;
		}, [textInput]);

		// ── Escape → cancel ──────────────────────────────────────────────────

		useEffect(() => {
			if (state === "idle") return;
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === "Escape") cancelToIdle();
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [state, cancelToIdle]);

		// ── Submit handlers ──────────────────────────────────────────────────

		const handlePhotoFile = (file: File) => {
			onComposerSubmit({
				composer_mode: "expense",
				expense_input_type: "photo",
				space_id: spaceId,
				file,
			});
			cancelToIdle();
		};

		const handleExpenseTextSubmit = () => {
			const text = textInput.trim();
			if (!text) return;
			onComposerSubmit({
				composer_mode: "expense",
				expense_input_type: "text",
				space_id: spaceId,
				content: text,
			});
			cancelToIdle();
		};

		const handleMessageSubmit = () => {
			const text = textInput.trim();
			if (!text) return;
			onComposerSubmit({
				composer_mode: "message",
				space_id: spaceId,
				content: text,
			});
			cancelToIdle();
		};

		const handleAskPeriodSubmit = () => {
			if (!selectedPeriod) return;
			onComposerSubmit({
				composer_mode: "ask",
				ask_type: "period_expenses",
				space_id: spaceId,
				period: selectedPeriod,
				...(textInput.trim() ? { content: textInput.trim() } : {}),
			});
			cancelToIdle();
		};

		const handleAskFindSubmit = () => {
			const text = textInput.trim();
			if (!text) return;
			onComposerSubmit({
				composer_mode: "ask",
				ask_type: "find_expense",
				space_id: spaceId,
				content: text,
			});
			cancelToIdle();
		};

		const handleAskNextPaymentSubmit = () => {
			onComposerSubmit({
				composer_mode: "ask",
				ask_type: "next_payment",
				space_id: spaceId,
				period: selectedChip ?? "Nearest",
			});
			cancelToIdle();
		};

		const handleAskSplitBalanceSubmit = () => {
			onComposerSubmit({
				composer_mode: "ask",
				ask_type: "split_balance",
				space_id: spaceId,
				...(textInput.trim() ? { content: textInput.trim() } : {}),
			});
			cancelToIdle();
		};

		const handleAskCustomSubmit = () => {
			const text = textInput.trim();
			if (!text) return;
			onComposerSubmit({
				composer_mode: "ask",
				ask_type: "custom",
				space_id: spaceId,
				content: text,
			});
			cancelToIdle();
		};

		const handleTextKeyDown = (
			e: React.KeyboardEvent<HTMLTextAreaElement>,
			onSubmit: () => void,
		) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				onSubmit();
			}
		};

		const handleVoiceToggle = async () => {
			if (!isRecording) {
				onStartExpenseRecording();
			} else {
				await onStopRecording();
				cancelToIdle();
			}
		};

		// ── Primitive UI pieces ──────────────────────────────────────────────

		const renderNav = (showCancel = true) => (
			<div className="mb-2.5 flex min-h-[1.5rem] items-center justify-between">
				<button
					aria-label="Go back"
					className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-[hsl(220_40%_42%)] transition-colors hover:text-[hsl(220_40%_22%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:text-[hsl(220_40%_64%)] dark:hover:text-[hsl(220_40%_84%)]"
					disabled={disabled}
					onClick={goBack}
					tabIndex={0}
					type="button"
				>
					<span aria-hidden className="text-sm leading-none">
						←
					</span>
					<span>Back</span>
				</button>
				{showCancel && (
					<button
						aria-label="Cancel and return to main"
						className="rounded px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={cancelToIdle}
						tabIndex={0}
						type="button"
					>
						Cancel
					</button>
				)}
			</div>
		);

		const renderStateTitle = (title: string) => (
			<p className="mb-2.5 text-xs font-semibold text-[hsl(220_40%_22%)] dark:text-[hsl(220_40%_82%)]">
				{title}
			</p>
		);

		const renderTextarea = (placeholder: string, onSubmit: () => void) => (
			<textarea
				ref={textareaRef}
				aria-label="Text input"
				className="min-h-[2.5rem] w-full resize-none bg-transparent text-sm leading-snug text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
				disabled={disabled}
				onChange={(e) => setTextInput(e.target.value)}
				onKeyDown={(e) => handleTextKeyDown(e, onSubmit)}
				placeholder={placeholder}
				rows={2}
				value={textInput}
			/>
		);

		const renderSubmitButton = (
			label: string,
			onSubmit: () => void,
			canSubmit: boolean,
		) => (
			<div className="mt-2.5 flex justify-end">
				<button
					aria-label={label}
					className="rounded-full bg-[hsl(220_40%_22%)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[hsl(220_40%_30%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 dark:bg-[hsl(220_40%_52%)] dark:hover:bg-[hsl(220_40%_60%)]"
					disabled={disabled || !canSubmit}
					onClick={onSubmit}
					tabIndex={0}
					type="button"
				>
					{label}
				</button>
			</div>
		);

		// ── State renders ────────────────────────────────────────────────────

		const renderIdle = () => (
			<div className="py-0.5">
				<p className="mb-3 text-xs font-medium text-muted-foreground">
					What would you like to do?
				</p>
				<div className="flex flex-wrap gap-2">
					<ComposerChip
						disabled={disabled}
						label="Add expense"
						onClick={() => goTo("expense_method_select")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Ask Ceits"
						onClick={() => goTo("ask_topic_select")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Message"
						onClick={() => goTo("message_text")}
					/>
				</div>
			</div>
		);

		const renderExpenseMethodSelect = () => (
			<div>
				{renderNav(false)}
				{renderStateTitle("How would you like to add it?")}
				<div className="flex flex-wrap gap-2">
					<ComposerChip
						disabled={disabled}
						label="Text"
						onClick={() => goTo("expense_text")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Voice"
						onClick={() => goTo("expense_voice")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Receipt photo"
						onClick={() => goTo("expense_photo")}
					/>
				</div>
			</div>
		);

		const renderExpenseText = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Add expense by text")}
				{renderTextarea("e.g. coffee 6.50 yesterday", handleExpenseTextSubmit)}
				{renderSubmitButton(
					"Add",
					handleExpenseTextSubmit,
					Boolean(textInput.trim()),
				)}
			</div>
		);

		const renderExpenseVoice = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Add expense by voice")}
				<div className="flex flex-col items-center gap-2.5 py-2">
					{isRecording ? (
						<>
							<div className="flex items-center gap-2">
								<span
									aria-label="Recording in progress"
									className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"
								/>
								<span className="text-xs font-medium text-[hsl(220_40%_35%)] dark:text-[hsl(220_40%_65%)]">
									Recording…
								</span>
							</div>
							<button
								aria-label="Stop voice recording"
								className="rounded-full border border-red-300/70 bg-red-50 px-5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:bg-red-950/40 dark:hover:bg-red-950/60"
								disabled={disabled}
								onClick={() => void handleVoiceToggle()}
								tabIndex={0}
								type="button"
							>
								■ Stop
							</button>
						</>
					) : (
						<>
							<button
								aria-label="Start voice recording"
								className="flex items-center gap-2 rounded-full border border-[rgba(120,100,80,0.38)] bg-[rgba(255,248,235,0.92)] px-5 py-2 text-xs font-semibold text-[hsl(220_40%_22%)] transition-all hover:border-[rgba(120,100,80,0.58)] hover:bg-[rgba(215,185,135,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:bg-[rgba(255,248,235,0.07)] dark:text-foreground dark:hover:bg-[rgba(215,185,135,0.12)]"
								disabled={disabled}
								onClick={() => void handleVoiceToggle()}
								tabIndex={0}
								type="button"
							>
								🎙 Start recording
							</button>
							<span className="text-[11px] text-muted-foreground">
								Press and speak
							</span>
						</>
					)}
				</div>
			</div>
		);

		const renderExpensePhoto = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Add receipt photo")}
				<div className="flex flex-col items-center gap-2 py-2">
					<button
						aria-label="Upload receipt photo"
						className="flex items-center gap-2 rounded-full border border-[rgba(120,100,80,0.38)] bg-[rgba(255,248,235,0.92)] px-5 py-2 text-xs font-semibold text-[hsl(220_40%_22%)] transition-all hover:border-[rgba(120,100,80,0.58)] hover:bg-[rgba(215,185,135,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:bg-[rgba(255,248,235,0.07)] dark:text-foreground dark:hover:bg-[rgba(215,185,135,0.12)]"
						disabled={disabled}
						onClick={() => photoInputRef.current?.click()}
						tabIndex={0}
						type="button"
					>
						📷 Upload receipt photo
					</button>
				</div>
				<input
					ref={photoInputRef}
					accept="image/*"
					aria-hidden
					className="sr-only"
					onChange={(e) => {
						const f = e.target.files?.[0] ?? null;
						e.currentTarget.value = "";
						if (f) handlePhotoFile(f);
					}}
					tabIndex={-1}
					type="file"
				/>
			</div>
		);

		const renderAskTopicSelect = () => (
			<div>
				{renderNav(false)}
				{renderStateTitle("What would you like to know?")}
				<div className="flex flex-wrap gap-2">
					<ComposerChip
						disabled={disabled}
						label="Spending by period"
						onClick={() => goTo("ask_period_expenses")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Find an expense"
						onClick={() => goTo("ask_find_expense")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Next payment"
						onClick={() => goTo("ask_next_payment")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Who owes whom"
						onClick={() => goTo("ask_split_balance")}
					/>
					<ComposerChip
						disabled={disabled}
						label="Ask in your own words"
						onClick={() => goTo("ask_custom")}
					/>
				</div>
			</div>
		);

		const renderAskPeriodExpenses = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Spending by period")}
				<div className="mb-3 flex flex-wrap gap-2">
					{PERIOD_OPTIONS.map((p) => (
						<ComposerChip
							key={p}
							disabled={disabled}
							label={p}
							onClick={() => setSelectedPeriod(p)}
							selected={selectedPeriod === p}
						/>
					))}
				</div>
				{renderTextarea("e.g. coffee (optional)", handleAskPeriodSubmit)}
				{renderSubmitButton(
					"Ask",
					handleAskPeriodSubmit,
					Boolean(selectedPeriod),
				)}
			</div>
		);

		const renderAskFindExpense = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Find an expense")}
				<div className="mb-3 flex flex-wrap gap-2">
					{FIND_FILTERS.map((f) => (
						<ComposerChip
							key={f}
							disabled={disabled}
							label={f}
							onClick={() => setSelectedChip(f)}
							selected={selectedChip === f}
						/>
					))}
				</div>
				{renderTextarea(
					"e.g. Amazon, 24.99, coffee, last Tuesday",
					handleAskFindSubmit,
				)}
				{renderSubmitButton(
					"Find",
					handleAskFindSubmit,
					Boolean(textInput.trim()),
				)}
			</div>
		);

		const renderAskNextPayment = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Next payment")}
				<div className="mb-3 flex flex-wrap gap-2">
					{PAYMENT_FILTERS.map((f) => (
						<ComposerChip
							key={f}
							disabled={disabled}
							label={f}
							onClick={() => setSelectedChip(f)}
							selected={selectedChip === f}
						/>
					))}
				</div>
				{renderSubmitButton(
					"Ask",
					handleAskNextPaymentSubmit,
					Boolean(selectedChip),
				)}
			</div>
		);

		const renderAskSplitBalance = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Who owes whom")}
				<div className="mb-3 flex flex-wrap gap-2">
					{BALANCE_FILTERS.map((f) => (
						<ComposerChip
							key={f}
							disabled={disabled}
							label={f}
							onClick={() => setSelectedChip(f)}
							selected={selectedChip === f}
						/>
					))}
				</div>
				{renderTextarea("e.g. Anna (optional)", handleAskSplitBalanceSubmit)}
				{renderSubmitButton("Ask", handleAskSplitBalanceSubmit, true)}
			</div>
		);

		const renderAskCustom = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Ask Ceits")}
				{renderTextarea(
					"e.g. how much did I spend on coffee yesterday?",
					handleAskCustomSubmit,
				)}
				{renderSubmitButton(
					"Ask",
					handleAskCustomSubmit,
					Boolean(textInput.trim()),
				)}
			</div>
		);

		const renderMessageText = () => (
			<div>
				{renderNav()}
				{renderStateTitle("Message this space")}
				{renderTextarea("Write a message…", handleMessageSubmit)}
				{renderSubmitButton(
					"Send",
					handleMessageSubmit,
					Boolean(textInput.trim()),
				)}
			</div>
		);

		const renderContent = () => {
			switch (state) {
				case "idle":
					return renderIdle();
				case "expense_method_select":
					return renderExpenseMethodSelect();
				case "expense_text":
					return renderExpenseText();
				case "expense_voice":
					return renderExpenseVoice();
				case "expense_photo":
					return renderExpensePhoto();
				case "ask_topic_select":
					return renderAskTopicSelect();
				case "ask_period_expenses":
					return renderAskPeriodExpenses();
				case "ask_find_expense":
					return renderAskFindExpense();
				case "ask_next_payment":
					return renderAskNextPayment();
				case "ask_split_balance":
					return renderAskSplitBalance();
				case "ask_custom":
					return renderAskCustom();
				case "message_text":
					return renderMessageText();
				default:
					return renderIdle();
			}
		};

		// ── Render ───────────────────────────────────────────────────────────

		return (
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className={
					surface === "dock"
						? "relative shrink-0 overflow-hidden bg-transparent"
						: "relative shrink-0 overflow-hidden border-t border-[rgba(120,100,80,0.2)] bg-gradient-to-b from-card/98 via-card/96 to-background/92 shadow-[0_-10px_26px_-18px_rgba(0,0,0,0.2)] backdrop-blur-md dark:from-background/95 dark:via-background/90 dark:to-background/85"
				}
				initial={reduceMotion ? false : { opacity: 0.92, y: 10 }}
				transition={spring}
			>
				{surface === "chat" ? (
					<div
						aria-hidden
						className="h-px w-full bg-[linear-gradient(90deg,transparent,hsl(38_92%_50%_/_0.35),hsl(var(--primary)_/_0.4),transparent)]"
					/>
				) : null}

				{surface === "chat" ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.1]"
						style={{
							background:
								"radial-gradient(ellipse 80% 60% at 50% 100%, hsl(38 90% 45%), transparent 70%)",
						}}
					/>
				) : null}

				<div
					className={
						surface === "dock" ? "relative p-2" : "relative p-3 sm:p-4"
					}
				>
					<div
						className={
							surface === "dock"
								? "rounded-[0.85rem] border border-border/60 bg-card/95 p-3 ring-1 ring-white/20 dark:bg-card/95 dark:ring-white/5"
								: "rounded-[0.9rem] border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,248,0.97)] p-3 shadow-sm ring-1 ring-white/25 dark:bg-card/95 dark:ring-white/5"
						}
					>
						<AnimatePresence initial={false} mode="wait">
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								initial={{ opacity: 0, y: 6 }}
								key={state}
								transition={transition}
							>
								{renderContent()}
							</motion.div>
						</AnimatePresence>
					</div>
				</div>
			</motion.div>
		);
	},
);

SmartTextareaComposer.displayName = "SmartTextareaComposer";
