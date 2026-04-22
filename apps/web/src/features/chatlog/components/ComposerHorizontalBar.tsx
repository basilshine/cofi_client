import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Ref, RefObject } from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { MicIcon, ParseSubmitIcon, SendMessageIcon } from "./ComposerIcons";

const LONG_PRESS_MS = 520;
const TEXTAREA_MAX_PX = 96;

type ComposerHorizontalBarProps = {
	disabled?: boolean;
	value: string;
	onChange: (value: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	placeholder: string;
	ariaLabel: string;
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
	/** Send (chat) vs Parse (capture) when the field has text */
	variant: "message" | "parse";
	onSubmit: () => void;
	onStartRecording: () => void;
	onPlusFocusText: () => void;
	onPlusPhotoLibrary: () => void;
	onMoreTakePhoto: () => void;
	onMoreUploadPhoto: () => void;
};

export const ComposerHorizontalBar = ({
	disabled = false,
	value,
	onChange,
	onKeyDown,
	placeholder,
	ariaLabel,
	textareaRef: textareaRefProp,
	variant,
	onSubmit,
	onStartRecording,
	onPlusFocusText,
	onPlusPhotoLibrary,
	onMoreTakePhoto,
	onMoreUploadPhoto,
}: ComposerHorizontalBarProps) => {
	const [plusOpen, setPlusOpen] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const innerTextareaRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = textareaRefProp ?? innerTextareaRef;
	const reduceMotion = useReducedMotion();
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const trailingPressedRef = useRef(false);
	const longPressFiredRef = useRef(false);

	const hasText = value.trim().length > 0;

	const transition = reduceMotion
		? { duration: 0.12 }
		: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const };

	const clearLongPressTimer = useCallback(() => {
		if (longPressTimerRef.current != null) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!plusOpen && !moreOpen) return;
		const handlePointerDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) {
				setPlusOpen(false);
				setMoreOpen(false);
			}
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [plusOpen, moreOpen]);

	useLayoutEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		const next = Math.min(Math.max(el.scrollHeight, 36), TEXTAREA_MAX_PX);
		el.style.height = `${next}px`;
	}, [value, textareaRef]);

	const handlePlusText = () => {
		onPlusFocusText();
		setPlusOpen(false);
	};
	const handlePlusPhoto = () => {
		onPlusPhotoLibrary();
		setPlusOpen(false);
	};
	const handlePlusVoice = () => {
		onStartRecording();
		setPlusOpen(false);
	};

	const handleMoreTakePhoto = () => {
		onMoreTakePhoto();
		setMoreOpen(false);
	};
	const handleMoreUpload = () => {
		onMoreUploadPhoto();
		setMoreOpen(false);
	};
	const handleMoreVoice = () => {
		onStartRecording();
		setMoreOpen(false);
	};

	const handleTrailingPointerDown = (
		e: React.PointerEvent<HTMLButtonElement>,
	) => {
		if (disabled) return;
		trailingPressedRef.current = true;
		longPressFiredRef.current = false;
		clearLongPressTimer();
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			/* already captured */
		}
		longPressTimerRef.current = setTimeout(() => {
			longPressTimerRef.current = null;
			longPressFiredRef.current = true;
			setMoreOpen(true);
			setPlusOpen(false);
		}, LONG_PRESS_MS);
	};

	const handleTrailingPointerUp = (
		e: React.PointerEvent<HTMLButtonElement>,
	) => {
		clearLongPressTimer();
		if (!trailingPressedRef.current) return;
		trailingPressedRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			/* not captured */
		}
		if (longPressFiredRef.current) {
			longPressFiredRef.current = false;
			return;
		}
		if (disabled) return;
		if (hasText) {
			onSubmit();
			return;
		}
		void onStartRecording();
	};

	const handleTrailingPointerCancel = (
		e: React.PointerEvent<HTMLButtonElement>,
	) => {
		clearLongPressTimer();
		trailingPressedRef.current = false;
		longPressFiredRef.current = false;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			/* noop */
		}
	};

	const trailingLabel = hasText
		? variant === "parse"
			? "Parse expense"
			: "Send message"
		: "Record voice — hold for camera, upload, or voice";

	return (
		<div
			className="flex w-full min-w-0 items-end gap-0.5 rounded-lg border border-border bg-background py-1 pl-1 pr-1 shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring"
			ref={rootRef}
		>
			<div className="relative flex shrink-0 flex-col justify-end pb-0.5">
				<button
					aria-expanded={plusOpen}
					aria-haspopup="menu"
					aria-label="Add photo or voice"
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-base font-medium leading-none text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
					disabled={disabled}
					onClick={() => {
						setMoreOpen(false);
						setPlusOpen((o) => !o);
					}}
					type="button"
				>
					+
				</button>
				<AnimatePresence>
					{plusOpen ? (
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="absolute bottom-full left-0 z-20 mb-1 flex min-w-[9.5rem] flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
							exit={{ opacity: 0, y: 4 }}
							initial={{ opacity: 0, y: 6 }}
							role="menu"
							transition={transition}
						>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handlePlusText}
								role="menuitem"
								type="button"
							>
								Text
							</button>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handlePlusPhoto}
								role="menuitem"
								type="button"
							>
								Photo
							</button>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handlePlusVoice}
								role="menuitem"
								type="button"
							>
								Voice
							</button>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>

			<label className="grid min-h-9 min-w-0 flex-1 py-0.5">
				<span className="sr-only">{ariaLabel}</span>
				<textarea
					aria-label={ariaLabel}
					className="min-h-9 w-full resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-sm leading-snug text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus-visible:ring-0"
					disabled={disabled}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					ref={textareaRef as Ref<HTMLTextAreaElement>}
					rows={1}
					value={value}
				/>
			</label>

			<div className="relative flex shrink-0 flex-col justify-end pb-0.5">
				<button
					aria-expanded={moreOpen}
					aria-haspopup="menu"
					aria-label={trailingLabel}
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent bg-primary/10 text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 dark:bg-primary/15 dark:hover:bg-primary/25"
					disabled={disabled}
					onContextMenu={(e) => e.preventDefault()}
					onPointerCancel={handleTrailingPointerCancel}
					onPointerDown={handleTrailingPointerDown}
					onPointerUp={handleTrailingPointerUp}
					title="Hold for camera, upload, or voice"
					type="button"
				>
					{hasText ? (
						variant === "parse" ? (
							<ParseSubmitIcon className="h-4 w-4" />
						) : (
							<SendMessageIcon className="h-4 w-4" />
						)
					) : (
						<MicIcon className="h-4 w-4" />
					)}
				</button>
				<AnimatePresence>
					{moreOpen ? (
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="absolute bottom-full right-0 z-20 mb-1 flex min-w-[10.5rem] flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg"
							exit={{ opacity: 0, y: 4 }}
							initial={{ opacity: 0, y: 6 }}
							role="menu"
							transition={transition}
						>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handleMoreTakePhoto}
								role="menuitem"
								type="button"
							>
								Take photo
							</button>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handleMoreUpload}
								role="menuitem"
								type="button"
							>
								Upload photo
							</button>
							<button
								className="rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
								onClick={handleMoreVoice}
								role="menuitem"
								type="button"
							>
								Record voice
							</button>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	);
};
