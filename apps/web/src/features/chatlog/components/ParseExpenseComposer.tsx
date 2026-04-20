import type { RefObject } from "react";
import { ParseSubmitIcon } from "./ComposerIcons";

export type ParseTestSnippet = {
	/** Short label for the chip */
	label: string;
	/** Full text inserted into the expense field (dummy parser uses keywords + hash) */
	text: string;
};

type Props = {
	disabled: boolean;
	isRecording: boolean;
	parseInput: string;
	onParseInputChange: (value: string) => void;
	onParseSubmit: () => void;
	onPhotoFile: (file: File) => void;
	onToggleRecording: () => void;
	onParseKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	/** Optional quick-fill lines for local dummy-parser testing */
	testSnippets?: ParseTestSnippet[];
	/** Wired from Quick capture so the file picker can open programmatically after navigation. */
	photoFileInputRef?: RefObject<HTMLInputElement>;
	/** Focus the parse textarea after “type capture” deep link from the dashboard. */
	parseTextareaRef?: RefObject<HTMLTextAreaElement>;
};

/**
 * Same dock layout and styling as the Chat tab composer (textarea + primary action),
 * with photo and voice controls to the right of the textarea.
 */
export const ParseExpenseComposer = ({
	disabled,
	isRecording,
	parseInput,
	onParseInputChange,
	onParseSubmit,
	onPhotoFile,
	onToggleRecording,
	onParseKeyDown,
	testSnippets,
	photoFileInputRef,
	parseTextareaRef,
}: Props) => {
	const handleSnippetClick = (text: string) => {
		onParseInputChange(text);
	};

	return (
		<div className="border-b border-border/60 bg-card p-0">
			<p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">
				Type expenses below (Ctrl/⌘ + Enter). Use the icons to parse, add a
				photo, or record voice.
			</p>
			{testSnippets != null && testSnippets.length > 0 ? (
				<fieldset className="mb-2 flex flex-wrap gap-1.5 border-0 p-0">
					<legend className="sr-only">Quick test phrases</legend>
					{testSnippets.map((s) => (
						<button
							key={s.label}
							aria-label={`Insert test phrase: ${s.label}`}
							className="rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-left text-xs text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
							disabled={disabled}
							onClick={() => handleSnippetClick(s.text)}
							type="button"
						>
							{s.label}
						</button>
					))}
				</fieldset>
			) : null}
			<div className="flex items-end gap-2">
				<label className="grid min-w-0 flex-1 gap-0.5">
					<span className="text-xs font-medium text-muted-foreground">
						Expense text
					</span>
					<textarea
						ref={parseTextareaRef}
						aria-label="Expense text to parse"
						className="h-24 w-full resize-none overflow-y-auto rounded-md border border-border bg-background px-2 py-2 text-sm"
						disabled={disabled}
						onChange={(e) => onParseInputChange(e.target.value)}
						onKeyDown={onParseKeyDown}
						placeholder="Example: Lunch 12.5, taxi 8…"
						rows={4}
						value={parseInput}
					/>
				</label>

				<div className="flex shrink-0 flex-col gap-1.5">
					<button
						aria-label="Parse expense text"
						className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
						disabled={disabled || !parseInput.trim()}
						onClick={() => void onParseSubmit()}
						type="button"
					>
						<ParseSubmitIcon />
					</button>
					<label>
						<input
							ref={photoFileInputRef}
							accept="image/*"
							aria-label="Upload receipt photo"
							className="sr-only"
							disabled={disabled}
							onChange={(e) => {
								const f = e.target.files?.[0] ?? null;
								if (f) onPhotoFile(f);
								e.currentTarget.value = "";
							}}
							type="file"
						/>
						<span
							className={[
								"inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border bg-background text-base transition hover:bg-accent",
								disabled ? "pointer-events-none opacity-50" : "",
							].join(" ")}
						>
							<span aria-hidden>📷</span>
						</span>
					</label>

					<button
						aria-label={isRecording ? "Stop recording" : "Record voice expense"}
						className={[
							"inline-flex h-10 w-10 items-center justify-center rounded-md border text-base transition",
							isRecording
								? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/20"
								: "border-border bg-background hover:bg-accent",
							disabled ? "opacity-50" : "",
						].join(" ")}
						disabled={disabled}
						onClick={() => void onToggleRecording()}
						type="button"
					>
						<span aria-hidden>🎤</span>
					</button>
				</div>
			</div>
		</div>
	);
};
