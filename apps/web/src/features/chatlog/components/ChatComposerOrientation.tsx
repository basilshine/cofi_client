import { MessageSquareText, ScanSearch } from "lucide-react";
import type { ChatComposerMode } from "./ChatComposerDock";

type ChatComposerOrientationProps = {
	composerMode: ChatComposerMode;
	disabled?: boolean;
	onCaptureClick: () => void;
	onMessageClick: () => void;
	spaceName: string | null;
};

const modeButtonClass = (selected: boolean) =>
	[
		"flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-[background-color,border-color,box-shadow,transform] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
		selected
			? "border-[rgba(68,58,42,0.28)] bg-[rgba(68,58,42,0.92)] text-[#fffaf0] shadow-sm"
			: "border-[rgba(120,100,80,0.14)] bg-white/72 text-foreground hover:border-[rgba(120,100,80,0.28)] hover:bg-white",
	].join(" ");

export const ChatComposerOrientation = ({
	composerMode,
	disabled = false,
	onCaptureClick,
	onMessageClick,
	spaceName,
}: ChatComposerOrientationProps) => {
	const contextLabel = spaceName?.trim() || "this space";

	return (
		<section
			aria-label="Chat composer purpose"
			className="border-t border-[rgba(120,100,80,0.16)] bg-[rgba(250,247,240,0.72)] px-3 py-2 sm:px-4"
		>
			<div className="mx-auto flex w-full max-w-[min(780px,95%)] flex-col gap-2 sm:flex-row sm:items-center">
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						Chat composer
					</p>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						Choose whether this input talks to people or creates reviewable
						Ceits work in {contextLabel}.
					</p>
				</div>
				<div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
					<button
						aria-pressed={composerMode === "message"}
						className={modeButtonClass(composerMode === "message")}
						disabled={disabled}
						onClick={onMessageClick}
						type="button"
					>
						<MessageSquareText className="h-4 w-4 shrink-0" size={16} />
						<span className="min-w-0">
							<span className="block truncate text-xs font-bold">
								Message people
							</span>
							<span
								className={[
									"mt-0.5 block truncate text-[11px] font-semibold",
									composerMode === "message"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground",
								].join(" ")}
							>
								Send to the shared chat
							</span>
						</span>
					</button>
					<button
						aria-pressed={composerMode === "capture"}
						className={modeButtonClass(composerMode === "capture")}
						disabled={disabled}
						onClick={onCaptureClick}
						type="button"
					>
						<ScanSearch className="h-4 w-4 shrink-0" size={16} />
						<span className="min-w-0">
							<span className="block truncate text-xs font-bold">
								Capture for review
							</span>
							<span
								className={[
									"mt-0.5 block truncate text-[11px] font-semibold",
									composerMode === "capture"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground",
								].join(" ")}
							>
								Parse receipts, voice, or text
							</span>
						</span>
					</button>
				</div>
			</div>
		</section>
	);
};
