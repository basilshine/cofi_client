import { $createLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isParagraphNode,
	$isRangeSelection,
	COMMAND_PRIORITY_HIGH,
	KEY_DOWN_COMMAND,
	ParagraphNode,
	TextNode,
} from "lexical";
import {
	type MutableRefObject,
	type KeyboardEvent as ReactKeyboardEvent,
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	$hydrateDiscussionWire,
	$serializeDiscussionWire,
} from "./discussionLexicalWire";
import { isAllowedLocalAppPath } from "./discussionLocalLinks";

export type DiscussionMessageComposerHandle = {
	focus: () => void;
};

type Props = {
	value: string;
	onChange: (next: string) => void;
	onKeyDown?: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
	disabled?: boolean;
	placeholder?: string;
	"aria-label"?: string;
};

const discussionTheme = {
	paragraph: "mb-0 min-h-[1.25em]",
	link: "text-primary underline decoration-primary/60 underline-offset-2 cursor-pointer",
	text: {
		bold: "font-semibold",
		italic: "italic",
	},
};

const onDiscussionError = (error: Error) => {
	console.error(error);
};

const initialConfig = {
	namespace: "DiscussionMessage",
	theme: discussionTheme,
	nodes: [ParagraphNode, TextNode, LinkNode],
	editable: true,
	onError: onDiscussionError,
};

const BlockInvalidLinkCommandPlugin = () => {
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		return editor.registerCommand(
			TOGGLE_LINK_COMMAND,
			(payload) => {
				if (payload === null || payload === undefined) {
					return false;
				}
				const url =
					typeof payload === "string"
						? payload
						: typeof payload === "object" &&
								payload !== null &&
								"url" in payload
							? String((payload as { url?: string }).url ?? "")
							: "";
				if (url && !isAllowedLocalAppPath(url)) {
					return true;
				}
				return false;
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor]);
	return null;
};

const SanitizeExternalLinksPlugin = () => {
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		return editor.registerNodeTransform(LinkNode, (node) => {
			const url = node.getURL();
			if (!isAllowedLocalAppPath(url)) {
				const text = node.getTextContent();
				const textNode = $createTextNode(text);
				node.replace(textNode);
			}
		});
	}, [editor]);
	return null;
};

const CtrlEnterPlugin = ({
	onCtrlEnter,
}: {
	onCtrlEnter?: (e: KeyboardEvent) => void;
}) => {
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		return editor.registerCommand(
			KEY_DOWN_COMMAND,
			(e: KeyboardEvent) => {
				if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && onCtrlEnter) {
					e.preventDefault();
					onCtrlEnter(e);
					return true;
				}
				return false;
			},
			COMMAND_PRIORITY_HIGH,
		);
	}, [editor, onCtrlEnter]);
	return null;
};

const SyncValuePlugin = ({
	value,
	lastEmittedRef,
}: {
	value: string;
	lastEmittedRef: MutableRefObject<string>;
}) => {
	const [editor] = useLexicalComposerContext();
	useEffect(() => {
		if (value === lastEmittedRef.current) return;
		lastEmittedRef.current = value;
		editor.update(() => {
			$hydrateDiscussionWire(value);
		});
	}, [value, editor, lastEmittedRef]);
	return null;
};

const FocusBridgePlugin = ({
	outerRef,
}: {
	outerRef: React.Ref<DiscussionMessageComposerHandle>;
}) => {
	const [editor] = useLexicalComposerContext();
	useImperativeHandle(
		outerRef,
		() => ({
			focus: () => {
				editor.focus();
				editor.update(() => {
					const root = $getRoot();
					const last = root.getLastChild();
					if ($isParagraphNode(last)) {
						last.selectEnd();
					}
				});
			},
		}),
		[editor],
	);
	return null;
};

const DiscussionEditorInner = forwardRef<
	DiscussionMessageComposerHandle,
	Props & { lastEmittedRef: MutableRefObject<string> }
>(function DiscussionEditorInner(
	{
		value,
		onChange,
		onKeyDown,
		disabled,
		placeholder,
		"aria-label": ariaLabel,
		lastEmittedRef,
	},
	outerRef,
) {
	const formId = useId();
	const linkTextId = `${formId}-link-text`;
	const linkPathId = `${formId}-link-path`;
	const [linkPanelOpen, setLinkPanelOpen] = useState(false);
	const [linkLabel, setLinkLabel] = useState("Link");
	const [linkPath, setLinkPath] = useState("/console/");
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		editor.setEditable(!disabled);
	}, [editor, disabled]);

	const emitCtrlEnter = useCallback(
		(e: KeyboardEvent) => {
			onKeyDown?.(e as unknown as ReactKeyboardEvent<HTMLTextAreaElement>);
		},
		[onKeyDown],
	);

	const handleInsertLink = useCallback(() => {
		const path = linkPath.trim();
		const safeLabel = linkLabel.replace(/[\[\]]/g, "").trim() || "Link";
		if (!isAllowedLocalAppPath(path)) return;
		editor.update(() => {
			const link = $createLinkNode(path);
			link.append($createTextNode(safeLabel));
			const selection = $getSelection();
			if ($isRangeSelection(selection)) {
				selection.insertNodes([link]);
			} else {
				const root = $getRoot();
				const last = root.getLastChild();
				if ($isParagraphNode(last)) {
					last.append(link);
				} else {
					const p = $createParagraphNode();
					p.append(link);
					root.append(p);
				}
			}
		});
		setLinkPanelOpen(false);
		setLinkLabel("Link");
		setLinkPath("/console/");
	}, [editor, linkLabel, linkPath]);

	const pathInvalid =
		linkPath.trim().length > 0 && !isAllowedLocalAppPath(linkPath.trim());

	return (
		<>
			<FocusBridgePlugin outerRef={outerRef} />
			<SyncValuePlugin lastEmittedRef={lastEmittedRef} value={value} />
			<BlockInvalidLinkCommandPlugin />
			<SanitizeExternalLinksPlugin />
			<CtrlEnterPlugin onCtrlEnter={emitCtrlEnter} />
			<HistoryPlugin />
			<LinkPlugin validateUrl={(url) => isAllowedLocalAppPath(url)} />
			<OnChangePlugin
				onChange={(editorState) => {
					editorState.read(() => {
						const s = $serializeDiscussionWire();
						lastEmittedRef.current = s;
						onChange(s);
					});
				}}
			/>
			<div className="grid min-w-0 flex-1 gap-1.5">
				<div className="flex flex-wrap items-center gap-1.5">
					<button
						aria-controls={`${formId}-link-panel`}
						aria-expanded={linkPanelOpen}
						className="inline-flex h-7 items-center rounded-md border border-border bg-muted/40 px-2 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-50"
						disabled={disabled}
						onClick={() => setLinkPanelOpen((o) => !o)}
						type="button"
					>
						Add link
					</button>
					<span className="text-[10px] text-muted-foreground">
						Local paths only (e.g.{" "}
						<code className="rounded bg-muted px-0.5">/console/…</code>)
					</span>
				</div>
				{linkPanelOpen ? (
					<div
						className="rounded-md border border-border bg-muted/20 p-2"
						id={`${formId}-link-panel`}
					>
						<div className="grid gap-2 sm:grid-cols-2">
							<label className="grid gap-0.5">
								<span
									className="text-[10px] font-medium text-muted-foreground"
									id={linkTextId}
								>
									Link text
								</span>
								<input
									aria-labelledby={linkTextId}
									className="h-9 rounded-md border border-border bg-background px-2 text-sm"
									onChange={(e) => setLinkLabel(e.target.value)}
									placeholder="e.g. Line 2"
									type="text"
									value={linkLabel}
								/>
							</label>
							<label className="grid gap-0.5">
								<span
									className="text-[10px] font-medium text-muted-foreground"
									id={linkPathId}
								>
									Path
								</span>
								<input
									aria-invalid={pathInvalid}
									aria-labelledby={linkPathId}
									className="h-9 rounded-md border border-border bg-background px-2 font-mono text-xs"
									onChange={(e) => setLinkPath(e.target.value)}
									placeholder="/console/chat/thread?…"
									type="text"
									value={linkPath}
								/>
							</label>
						</div>
						{pathInvalid ? (
							<p className="mt-1 text-[10px] text-destructive">
								Use a path starting with / (not http:// or other sites).
							</p>
						) : null}
						<div className="mt-2 flex flex-wrap gap-2">
							<button
								className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
								disabled={pathInvalid || !linkPath.trim()}
								onClick={handleInsertLink}
								type="button"
							>
								Insert
							</button>
							<button
								className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
								onClick={() => setLinkPanelOpen(false)}
								type="button"
							>
								Cancel
							</button>
						</div>
					</div>
				) : null}
				<div className="relative min-h-[6rem] rounded-md border border-border bg-background">
					<RichTextPlugin
						ErrorBoundary={LexicalErrorBoundary}
						contentEditable={
							<ContentEditable
								aria-label={ariaLabel}
								className="min-h-[6rem] w-full resize-none overflow-y-auto p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						}
						placeholder={
							<div className="pointer-events-none absolute left-2 top-2 text-sm text-muted-foreground">
								{placeholder}
							</div>
						}
					/>
				</div>
			</div>
		</>
	);
});

export const DiscussionMessageComposer = forwardRef<
	DiscussionMessageComposerHandle,
	Props
>(function DiscussionMessageComposer(props, ref) {
	const lastEmittedRef = useRef(props.value);
	return (
		<LexicalComposer initialConfig={initialConfig}>
			<DiscussionEditorInner
				{...props}
				lastEmittedRef={lastEmittedRef}
				ref={ref}
			/>
		</LexicalComposer>
	);
});
