import {
	type LucideIcon,
	MessageSquareText,
	ScanSearch,
	Search,
} from "lucide-react";

export type ChatComposerPurpose = "message" | "capture" | "ask";

type ChatComposerOrientationProps = {
	composerPurpose: ChatComposerPurpose;
	disabled?: boolean;
	isSharedSpace?: boolean;
	onAskClick: () => void;
	onCaptureClick: () => void;
	onMessageClick: () => void;
	spaceName: string | null;
};

type PurposeOption = {
	helper: string;
	Icon: LucideIcon;
	label: string;
	purpose: ChatComposerPurpose;
};

const buildPurposeOptions = (isSharedSpace: boolean): PurposeOption[] => [
	{
		helper: isSharedSpace ? "Shared chat" : "Space note",
		Icon: MessageSquareText,
		label: "Message",
		purpose: "message",
	},
	{
		helper: "Review packet",
		Icon: ScanSearch,
		label: "Capture",
		purpose: "capture",
	},
	{
		helper: "Ask Ceits",
		Icon: Search,
		label: "Ask",
		purpose: "ask",
	},
];

const modeButtonClass = (selected: boolean) =>
	[
		"inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-left transition-[background-color,box-shadow,color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:justify-start sm:px-3",
		selected
			? "bg-[rgba(68,58,42,0.94)] text-[#fffaf0] shadow-[0_8px_18px_-14px_rgba(44,32,18,0.58)]"
			: "text-muted-foreground hover:bg-white/78 hover:text-foreground",
	].join(" ");

export const ChatComposerOrientation = ({
	composerPurpose,
	disabled = false,
	isSharedSpace = false,
	onAskClick,
	onCaptureClick,
	onMessageClick,
	spaceName,
}: ChatComposerOrientationProps) => {
	const contextLabel = spaceName?.trim() || "this space";
	const purposeOptions = buildPurposeOptions(isSharedSpace);
	const onClickByPurpose: Record<ChatComposerPurpose, () => void> = {
		ask: onAskClick,
		capture: onCaptureClick,
		message: onMessageClick,
	};

	return (
		<section
			aria-label="Chat composer purpose"
			className="border-t border-[rgba(120,100,80,0.14)] bg-[rgba(250,247,240,0.64)] px-3 py-1.5 sm:px-4"
		>
			<div className="mx-auto flex w-full max-w-[min(780px,95%)] flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					<span
						aria-hidden
						className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(140_28%_46%)] shadow-[0_0_0_3px_rgba(92,122,91,0.14)]"
					/>
					<span className="truncate">Context: {contextLabel}</span>
				</div>
				<div
					aria-label="Input purpose"
					className="grid min-w-0 grid-cols-3 rounded-full border border-[rgba(120,100,80,0.16)] bg-white/58 p-1 shadow-[inset_0_1px_2px_rgba(44,32,18,0.04)] sm:w-[min(100%,31rem)] sm:shrink-0"
					role="group"
				>
					{purposeOptions.map(({ helper, Icon, label, purpose }) => (
						<button
							aria-label={`${label}: ${helper}`}
							aria-pressed={composerPurpose === purpose}
							className={modeButtonClass(composerPurpose === purpose)}
							disabled={disabled}
							key={purpose}
							onClick={onClickByPurpose[purpose]}
							type="button"
						>
							<Icon className="h-3.5 w-3.5 shrink-0" size={14} />
							<span className="min-w-0 truncate text-xs font-bold">
								{label}
							</span>
							<span
								className={[
									"hidden min-w-0 truncate text-[10px] font-semibold sm:inline",
									composerPurpose === purpose
										? "text-[#fffaf0]/70"
										: "text-muted-foreground/78",
								].join(" ")}
							>
								{helper}
							</span>
						</button>
					))}
				</div>
			</div>
		</section>
	);
};
