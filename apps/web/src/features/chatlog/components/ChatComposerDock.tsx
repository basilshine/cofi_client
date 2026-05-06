import { ParseStructureIcon, ThreadDiscussionIcon } from "@cofi/ceits-icons";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export type ChatComposerMode = "message" | "capture";

type ChatComposerDockProps = {
	composerMode: ChatComposerMode;
	onComposerModeChange: (mode: ChatComposerMode) => void;
	showModeToggle: boolean;
	disabled: boolean;
	/** e.g. while recording — disables Messages / Capture switch */
	interactionLocked?: boolean;
	captureSlot: ReactNode;
	messageSlot: ReactNode;
};

/** Always merged with color classes so flex tabs never stretch icons to 71px. */
const iconTabClass = "size-3.5 shrink-0";

export const ChatComposerDock = ({
	composerMode,
	onComposerModeChange,
	showModeToggle,
	disabled,
	interactionLocked = false,
	captureSlot,
	messageSlot,
}: ChatComposerDockProps) => {
	const reduceMotion = useReducedMotion();
	const spring = reduceMotion
		? { duration: 0.01 }
		: { type: "spring" as const, stiffness: 440, damping: 32 };

	const contentTransition = reduceMotion
		? { duration: 0.12 }
		: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const };

	const handleModeClick = (mode: ChatComposerMode) => {
		if (disabled || interactionLocked || mode === composerMode) return;
		onComposerModeChange(mode);
	};

	return (
		<motion.div
			className="relative shrink-0 overflow-hidden border-t border-[rgba(120,100,80,0.2)] bg-gradient-to-b from-card/98 via-card/96 to-background/92 shadow-[0_-10px_26px_-18px_rgba(0,0,0,0.2)] backdrop-blur-md dark:from-background/95 dark:via-background/90 dark:to-background/85"
			initial={reduceMotion ? false : { opacity: 0.92, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={spring}
		>
			<motion.div
				aria-hidden
				className="h-px w-full"
				initial={false}
				animate={{
					background:
						composerMode === "capture"
							? "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.45), hsl(38 92% 50% / 0.35), transparent)"
							: "linear-gradient(90deg, transparent, hsl(221 83% 53% / 0.35), hsl(var(--primary) / 0.4), transparent)",
				}}
				transition={{ duration: reduceMotion ? 0 : 0.28 }}
			/>

			<div className="relative p-3 sm:p-4">
				<motion.div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.1]"
					initial={false}
					animate={{
						background:
							composerMode === "capture"
								? "radial-gradient(ellipse 80% 60% at 50% 100%, hsl(38 90% 45%), transparent 70%)"
								: "radial-gradient(ellipse 80% 60% at 50% 100%, hsl(221 70% 48%), transparent 70%)",
					}}
					transition={{ duration: reduceMotion ? 0 : 0.35 }}
				/>

				<div className="relative space-y-3">
					{showModeToggle ? (
						<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<p className="text-xs text-muted-foreground">
								Messages or Capture
							</p>

							<div className="relative w-full sm:w-[min(100%,20rem)] sm:shrink-0">
								<div
									className="relative flex h-11 w-full rounded-full bg-muted/50 p-1 ring-1 ring-border/60 dark:bg-muted/30"
									role="tablist"
									aria-label="Composer mode"
								>
									<motion.div
										aria-hidden
										className="absolute bottom-1 top-1 z-0 rounded-full bg-background shadow-sm ring-1 ring-border/50 dark:bg-card dark:ring-border/40"
										initial={false}
										animate={{
											left: composerMode === "message" ? 4 : "calc(50% + 2px)",
											width: "calc(50% - 6px)",
										}}
										transition={spring}
									/>
									<button
										aria-selected={composerMode === "message"}
										className="relative z-10 flex min-h-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 sm:px-3"
										disabled={disabled || interactionLocked}
										onClick={() => handleModeClick("message")}
										role="tab"
										type="button"
									>
										<ThreadDiscussionIcon
											className={
												composerMode === "message"
													? `${iconTabClass} text-primary`
													: `${iconTabClass} text-muted-foreground opacity-90`
											}
											size={14}
										/>
										<span
											className={
												composerMode === "message"
													? "whitespace-nowrap text-foreground"
													: "whitespace-nowrap text-muted-foreground"
											}
										>
											Messages
										</span>
									</button>
									<button
										aria-selected={composerMode === "capture"}
										className="relative z-10 flex min-h-0 flex-1 items-center justify-center gap-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 sm:px-3"
										disabled={disabled || interactionLocked}
										onClick={() => handleModeClick("capture")}
										role="tab"
										type="button"
									>
										<ParseStructureIcon
											className={
												composerMode === "capture"
													? `${iconTabClass} text-[hsl(var(--ceits-icon-primary))]`
													: `${iconTabClass} text-muted-foreground opacity-85`
											}
											size={14}
										/>
										<span
											className={
												composerMode === "capture"
													? "whitespace-nowrap text-foreground"
													: "whitespace-nowrap text-muted-foreground"
											}
										>
											Capture
										</span>
									</button>
								</div>
							</div>
						</div>
					) : (
						<p className="text-xs text-muted-foreground">
							Add expenses as text — use + for photo or voice.
						</p>
					)}

					<AnimatePresence initial={false} mode="wait">
						{showModeToggle && composerMode === "message" ? (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="space-y-2"
								exit={{ opacity: 0, y: -4 }}
								initial={{ opacity: 0, y: 6 }}
								key="composer-message"
								transition={contentTransition}
							>
								{messageSlot}
							</motion.div>
						) : (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="space-y-2"
								exit={{ opacity: 0, y: -4 }}
								initial={{ opacity: 0, y: 6 }}
								key="composer-capture"
								transition={contentTransition}
							>
								{captureSlot}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
};
