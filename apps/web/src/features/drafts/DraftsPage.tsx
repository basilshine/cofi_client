import { useState } from "react";
import type { Draft } from "@cofi/api";
import { apiClient } from "../../shared/lib/apiClient";

export const DraftsPage = () => {
	const [spaceId, setSpaceId] = useState<string>("1");
	const [text, setText] = useState("");
	const [draft, setDraft] = useState<Draft | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleCreateFromText = async () => {
		if (!text.trim()) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await apiClient.drafts.createFromText({
				space_id: spaceId,
				text: text.trim(),
			});
			setDraft(data);
		} catch (err) {
			setDraft(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to create draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirm = async () => {
		if (!draft) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await apiClient.drafts.confirm(draft.id);
			setDraft(null);
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to confirm draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = async () => {
		if (!draft) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await apiClient.drafts.cancel(draft.id);
			setDraft(null);
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to cancel draft");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Drafts</h1>
				<p className="text-sm text-muted-foreground">
					Golden path starts here: create draft → confirm/cancel → verify in
					Transactions.
				</p>
			</div>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="grid gap-3">
					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Space ID
						</span>
						<input
							className="h-10 w-48 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setSpaceId(e.target.value)}
							type="text"
							value={spaceId}
						/>
					</label>

					<label className="grid gap-1">
						<span className="text-xs font-medium text-muted-foreground">
							Text input
						</span>
						<textarea
							className="min-h-28 rounded-md border border-border bg-background p-3 text-sm"
							onChange={(e) => setText(e.target.value)}
							placeholder="Bought coffee for 200"
							value={text}
						/>
					</label>

					<div className="flex flex-wrap items-center gap-2">
						<button
							className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
							disabled={isLoading || !text.trim()}
							onClick={handleCreateFromText}
							type="button"
						>
							Create draft from text
						</button>

						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !draft}
							onClick={handleConfirm}
							type="button"
						>
							Confirm draft
						</button>

						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !draft}
							onClick={handleCancel}
							type="button"
						>
							Cancel draft
						</button>
					</div>
				</div>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
				{JSON.stringify(draft, null, 2)}
			</pre>
		</section>
	);
};

