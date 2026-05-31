import { MessageSquareText, ScanSearch, Search } from "lucide-react";

export type ChatComposerPurpose = "message" | "capture" | "ask";

type ChatComposerOrientationProps = {
	composerPurpose: ChatComposerPurpose;
	disabled?: boolean;
	onAskClick: () => void;
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
	composerPurpose,
	disabled = false,
	onAskClick,
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
						Input purpose
					</p>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						Choose what this input should do in {contextLabel}.
					</p>
				</div>
				<div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
					<button
						aria-pressed={composerPurpose === "message"}
						className={modeButtonClass(composerPurpose === "message")}
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
									composerPurpose === "message"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground",
								].join(" ")}
							>
								Send to the shared chat
							</span>
						</span>
					</button>
					<button
						aria-pressed={composerPurpose === "capture"}
						className={modeButtonClass(composerPurpose === "capture")}
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
									composerPurpose === "capture"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground",
								].join(" ")}
							>
								Parse text, voice, receipt
							</span>
						</span>
					</button>
					<button
						aria-pressed={composerPurpose === "ask"}
						className={modeButtonClass(composerPurpose === "ask")}
						disabled={disabled}
						onClick={onAskClick}
						type="button"
					>
						<Search className="h-4 w-4 shrink-0" size={16} />
						<span className="min-w-0">
							<span className="block truncate text-xs font-bold">
								Ask Ceits
							</span>
							<span
								className={[
									"mt-0.5 block truncate text-[11px] font-semibold",
									composerPurpose === "ask"
										? "text-[#fffaf0]/72"
										: "text-muted-foreground",
								].join(" ")}
							>
								Search and explain
							</span>
						</span>
					</button>
				</div>
			</div>
		</section>
	);
};
