import type { ChatMessage } from "@cofi/api";

type DeleteChatMessageDialogProps = {
	busy: boolean;
	message: ChatMessage | null;
	onCancel: () => void;
	onConfirm: (message: ChatMessage) => void;
};

export const DeleteChatMessageDialog = ({
	busy,
	message,
	onCancel,
	onConfirm,
}: DeleteChatMessageDialogProps) => {
	if (!message) return null;

	return (
		<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
			<div
				aria-modal="true"
				className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl"
				role="dialog"
			>
				<h3 className="text-sm font-semibold text-foreground">
					Delete message?
				</h3>
				<p className="mt-2 text-sm text-muted-foreground">
					Only this chat message will be removed. Linked expense data is kept.
				</p>
				<div className="mt-4 flex items-center justify-end gap-2">
					<button
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
						disabled={busy}
						onClick={onCancel}
						type="button"
					>
						Keep message
					</button>
					<button
						className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
						disabled={busy}
						onClick={() => onConfirm(message)}
						type="button"
					>
						{busy ? "Deleting..." : "Delete message"}
					</button>
				</div>
			</div>
		</div>
	);
};
