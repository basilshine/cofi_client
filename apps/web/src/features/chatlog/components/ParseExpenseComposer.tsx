import type { Ref, RefObject } from "react";
import { useCallback, useRef } from "react";
import { ComposerHorizontalBar } from "./ComposerHorizontalBar";
import { ComposerVoiceRecording } from "./ComposerVoiceRecording";

export type ParseTestSnippet = {
	label: string;
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
	testSnippets?: ParseTestSnippet[];
	photoFileInputRef?: RefObject<HTMLInputElement | null>;
	parseTextareaRef?: RefObject<HTMLTextAreaElement | null>;
};

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
	const fallbackPhotoRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const fileInputRef = photoFileInputRef ?? fallbackPhotoRef;

	const handleSnippetClick = (text: string) => {
		onParseInputChange(text);
	};

	const handlePhotoPick = useCallback(() => {
		fileInputRef.current?.click();
	}, [fileInputRef]);

	const handleCameraPick = useCallback(() => {
		cameraInputRef.current?.click();
	}, []);

	if (isRecording) {
		return (
			<ComposerVoiceRecording
				disabled={disabled}
				onStop={() => void onToggleRecording()}
			/>
		);
	}

	return (
		<div className="space-y-2">
			{testSnippets != null && testSnippets.length > 0 ? (
				<fieldset className="flex flex-wrap gap-1.5 border-0 p-0">
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

			<ComposerHorizontalBar
				ariaLabel="Expense text to parse"
				disabled={disabled}
				onChange={onParseInputChange}
				onKeyDown={onParseKeyDown}
				onMoreTakePhoto={handleCameraPick}
				onMoreUploadPhoto={handlePhotoPick}
				onPlusFocusText={() => parseTextareaRef?.current?.focus()}
				onPlusPhotoLibrary={handlePhotoPick}
				onStartRecording={() => void onToggleRecording()}
				onSubmit={() => void onParseSubmit()}
				placeholder="e.g. Lunch $12, uber $8…"
				textareaRef={parseTextareaRef}
				value={parseInput}
				variant="parse"
			/>

			<input
				ref={fileInputRef as Ref<HTMLInputElement>}
				accept="image/*"
				className="sr-only"
				onChange={(e) => {
					const f = e.target.files?.[0] ?? null;
					if (f) onPhotoFile(f);
					e.currentTarget.value = "";
				}}
				tabIndex={-1}
				type="file"
			/>
			<input
				ref={cameraInputRef}
				accept="image/*"
				capture="environment"
				className="sr-only"
				onChange={(e) => {
					const f = e.target.files?.[0] ?? null;
					if (f) onPhotoFile(f);
					e.currentTarget.value = "";
				}}
				tabIndex={-1}
				type="file"
			/>
		</div>
	);
};
