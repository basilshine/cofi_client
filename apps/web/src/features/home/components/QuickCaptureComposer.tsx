import {
	ReceiptPhotoIcon,
	TextCaptureIcon,
	VoiceCaptureIcon,
} from "@cofi/ceits-icons";
import type { ReactNode } from "react";

type QuickCaptureComposerProps = {
	title: string;
	eyebrow?: string;
	targetSpaceName?: string | null;
	inputValue: string;
	inputPlaceholder: string;
	onInputChange: (value: string) => void;
	onPrimaryAction: () => void;
	onVoiceAction: () => void;
	onReceiptAction: () => void;
	primaryDisabled?: boolean;
	voiceDisabled?: boolean;
	receiptDisabled?: boolean;
	primaryTitle?: string;
	voiceTitle?: string;
	receiptTitle?: string;
	helperText?: string;
	suggestions?: string[];
	onSuggestionClick?: (value: string) => void;
	statusContent?: ReactNode;
	errorText?: string | null;
	/** Warmer surface + gold accents (e.g. Space Overview primary capture). */
	emphasized?: boolean;
};

export const QuickCaptureComposer = ({
	title,
	eyebrow = "Quick capture",
	targetSpaceName,
	inputValue,
	inputPlaceholder,
	onInputChange,
	onPrimaryAction,
	onVoiceAction,
	onReceiptAction,
	primaryDisabled,
	voiceDisabled,
	receiptDisabled,
	primaryTitle = "Parse expense",
	voiceTitle = "Parse from voice",
	receiptTitle = "Parse from receipt",
	helperText,
	suggestions = [],
	onSuggestionClick,
	statusContent,
	errorText,
	emphasized = false,
}: QuickCaptureComposerProps) => {
	const shellClass = emphasized
		? "rounded-[1.35rem] border border-[rgba(195,155,88,0.48)] bg-gradient-to-b from-[#fff6e8] via-[#fff1dc] to-[#ffecd4] p-3.5 shadow-[0_16px_52px_-26px_rgba(125,88,38,0.3),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-[rgba(210,175,110,0.18)] transition-all duration-200 hover:shadow-[0_20px_56px_-26px_rgba(125,88,38,0.34)] focus-within:shadow-[0_22px_58px_-24px_rgba(125,88,38,0.36)] focus-within:ring-[rgba(210,175,110,0.28)] sm:p-4"
		: "rounded-[1.35rem] border border-[#E7E0D4]/80 bg-[#FFFCF6] p-3 shadow-[0_10px_26px_-18px_rgba(31,37,35,0.3)] transition-all duration-200 hover:shadow-[0_14px_30px_-18px_rgba(31,37,35,0.33)] focus-within:shadow-[0_14px_30px_-16px_rgba(31,37,35,0.35)] sm:p-3.5";
	const inputRowClass = emphasized
		? "flex min-h-[56px] items-center rounded-xl border border-[rgba(200,165,105,0.2)] bg-[rgba(255,255,252,0.98)] px-3 shadow-[inset_0_1px_2px_rgba(31,37,35,0.04)] transition-all duration-200 focus-within:border-[rgba(200,165,105,0.45)] focus-within:bg-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_0_0_2px_rgba(200,165,105,0.18),0_8px_24px_-16px_rgba(150,110,50,0.15)]"
		: "flex min-h-[54px] items-center rounded-xl bg-[rgba(255,255,252,0.94)] px-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.75),inset_0_-1px_2px_rgba(31,37,35,0.06)] transition-all duration-200 focus-within:bg-[rgba(255,255,254,1)]";
	const iconIdle = emphasized
		? "bg-[rgba(190,155,95,0.14)] text-[#5c4d38]"
		: "bg-[rgba(142,159,136,0.12)] text-[#4E5A52]";
	const iconActive = emphasized
		? "bg-[rgba(190,155,95,0.26)] text-[#4a3d2a]"
		: "bg-[rgba(142,159,136,0.2)] text-[#3F4B43]";
	const iconHover = emphasized
		? "hover:bg-[rgba(190,155,95,0.22)]"
		: "hover:bg-[rgba(142,159,136,0.2)]";

	return (
		<section aria-label={title}>
			<div className="mb-4 flex items-end justify-between">
				<div>
					<p className="eyebrow">{eyebrow}</p>
					<h2 className="text-xl font-bold tracking-tight text-foreground">
						{title}
					</h2>
				</div>
				{targetSpaceName ? (
					<p className="hidden text-xs text-[#6F746D] sm:flex sm:items-center sm:gap-2">
						<span>Draft will be saved in</span>
						<span className="inline-flex items-center rounded-full bg-[rgba(142,159,136,0.14)] px-3 py-1 text-[11px] font-medium text-[#49574C]">
							{targetSpaceName}
						</span>
					</p>
				) : null}
			</div>
			<div className={shellClass}>
				{targetSpaceName ? (
					<p className="mb-2 text-[10px] text-[#6F746D]">
						Draft will be saved in{" "}
						<span className="inline-flex items-center rounded-full bg-[rgba(142,159,136,0.14)] px-2 py-0.5 font-medium text-[#49574C]">
							{targetSpaceName}
						</span>
					</p>
				) : null}
				<div className={inputRowClass}>
					<input
						className="flex-1 bg-transparent px-2 text-sm text-[#5F655F] placeholder:text-[#7A807A] focus:outline-none"
						onChange={(event) => onInputChange(event.target.value)}
						placeholder={inputPlaceholder}
						value={inputValue}
					/>
					<span
						aria-hidden
						className="mx-2 h-6 w-px bg-[rgba(120,105,85,0.16)]"
					/>
					<div className="flex items-center gap-1">
						<button
							aria-label={primaryTitle}
							className={`inline-flex items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
								emphasized ? "h-9 w-9" : "h-8 w-8"
							} ${inputValue.trim().length > 0 ? iconActive : iconIdle}`}
							disabled={primaryDisabled}
							onClick={onPrimaryAction}
							title={primaryTitle}
							type="button"
						>
							<TextCaptureIcon
								className={emphasized ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4"}
								size={emphasized ? 18 : 16}
							/>
						</button>
						<button
							aria-label={voiceTitle}
							className={`inline-flex items-center justify-center rounded-full ${iconIdle} transition-colors duration-200 ${iconHover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${emphasized ? "h-9 w-9" : "h-8 w-8"}`}
							disabled={voiceDisabled}
							onClick={onVoiceAction}
							title={voiceTitle}
							type="button"
						>
							<VoiceCaptureIcon
								className={emphasized ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4"}
								size={emphasized ? 18 : 16}
							/>
						</button>
						<button
							aria-label={receiptTitle}
							className={`inline-flex items-center justify-center rounded-full ${iconIdle} transition-colors duration-200 ${iconHover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${emphasized ? "h-9 w-9" : "h-8 w-8"}`}
							disabled={receiptDisabled}
							onClick={onReceiptAction}
							title={receiptTitle}
							type="button"
						>
							<ReceiptPhotoIcon
								className={emphasized ? "h-[1.125rem] w-[1.125rem]" : "h-4 w-4"}
								size={emphasized ? 18 : 16}
							/>
						</button>
					</div>
				</div>
				{suggestions.length > 0 && onSuggestionClick ? (
					<div className="mt-2.5 flex flex-wrap gap-1.5">
						{suggestions.map((snippet) => (
							<button
								className="rounded-full bg-[rgba(142,159,136,0.06)] px-1.5 py-0.5 text-[9px] text-[#7B807A] transition-colors hover:bg-[rgba(142,159,136,0.12)]"
								key={snippet}
								onClick={() => onSuggestionClick(snippet)}
								type="button"
							>
								{snippet}
							</button>
						))}
					</div>
				) : null}
				{helperText ? (
					<p className="mt-2 text-[10px] text-[#7B807A]">{helperText}</p>
				) : null}
				{statusContent ? <div className="mt-3">{statusContent}</div> : null}
				{errorText ? (
					<p className="mt-2 text-[10px] text-[#8A5A57]" role="status">
						{errorText}
					</p>
				) : null}
			</div>
		</section>
	);
};
