import type { ReactNode, Ref, UIEventHandler } from "react";

type NativeChatSpaceSurfaceProps = {
	children: ReactNode;
	composerSlot?: ReactNode;
	hasMore: boolean;
	loadOlderDisabled: boolean;
	messagesEndRef: Ref<HTMLDivElement>;
	messagesScrollRef: Ref<HTMLDivElement>;
	onJumpToLatest: () => void;
	onLoadOlder: () => void;
	onMessagesScroll: UIEventHandler<HTMLDivElement>;
	quickActionsSlot?: ReactNode;
	showJumpToLatest: boolean;
};

/** Floating chat navigation - same pill look on root and drilled layers. */
const navPillBase =
	"inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:px-4";

const navPillInactive =
	"text-muted-foreground hover:bg-accent/70 hover:text-foreground";

export const NativeChatSpaceSurface = ({
	children,
	composerSlot = null,
	hasMore,
	loadOlderDisabled,
	messagesEndRef,
	messagesScrollRef,
	onJumpToLatest,
	onLoadOlder,
	onMessagesScroll,
	quickActionsSlot = null,
	showJumpToLatest,
}: NativeChatSpaceSurfaceProps) => {
	return (
		<div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-border/60 bg-card">
			<div className="relative flex min-h-0 flex-1 flex-col bg-background/30">
				{hasMore ? (
					<button
						aria-label="Load older messages"
						className={`absolute left-3 top-3 z-20 max-w-[42%] sm:max-w-none ${navPillBase} ${navPillInactive} disabled:opacity-50`}
						disabled={loadOlderDisabled}
						onClick={onLoadOlder}
						type="button"
					>
						Older
					</button>
				) : null}
				<div className="relative min-h-0 flex-1">
					<div
						className="scrollbar-chat absolute inset-0 space-y-2 overflow-y-auto px-4 pb-3 pt-12 sm:px-6 sm:pt-14"
						onScroll={onMessagesScroll}
						ref={messagesScrollRef}
					>
						{children}
						<div
							aria-hidden
							className="h-px w-full shrink-0"
							ref={messagesEndRef}
						/>
					</div>
					{showJumpToLatest ? (
						<button
							aria-label="Jump to latest messages"
							className="pointer-events-auto absolute bottom-3 right-3 z-30 inline-flex h-10 items-center gap-1.5 rounded-full border border-primary/25 bg-primary px-3 text-primary-foreground shadow-lg ring-2 ring-background transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-11 sm:px-4"
							onClick={onJumpToLatest}
							type="button"
						>
							<span aria-hidden className="text-base leading-none sm:text-lg">
								↓
							</span>
							<span className="max-w-[5.5rem] truncate text-xs font-semibold sm:max-w-none">
								Latest
							</span>
						</button>
					) : null}
				</div>
				{quickActionsSlot}
				{composerSlot}
			</div>
		</div>
	);
};
