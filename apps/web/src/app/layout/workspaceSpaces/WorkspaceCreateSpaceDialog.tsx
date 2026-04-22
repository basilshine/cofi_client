import * as Dialog from "@radix-ui/react-dialog";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

export const WorkspaceCreateSpaceDialog = () => {
	const {
		workspaceScope,
		createSpaceDialogOpen,
		setCreateSpaceDialogOpen,
		newSpaceName,
		setNewSpaceName,
		createSpace,
		isCreatingSpace,
		isLoading,
		loadError,
	} = useWorkspaceSpaces();

	const handleCreate = () => {
		void (async () => {
			try {
				await createSpace();
			} catch {
				/* error surfaced via loadError */
			}
		})();
	};

	if (workspaceScope?.kind !== "personal") {
		return null;
	}

	const handleOpenChange = (open: boolean) => {
		setCreateSpaceDialogOpen(open);
	};

	return (
		<Dialog.Root onOpenChange={handleOpenChange} open={createSpaceDialogOpen}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
				<Dialog.Content
					className="fixed left-1/2 top-1/2 z-[101] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 shadow-lg outline-none"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
						New space
					</Dialog.Title>
					<Dialog.Description className="mt-2 text-sm text-muted-foreground">
						Create a space for a budget, trip, or household. You can rename it
						later in settings.
					</Dialog.Description>

					{loadError ? (
						<p className="mt-3 text-sm text-destructive">{loadError}</p>
					) : null}

					<div className="mt-4 grid gap-2">
						<label className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Name
							</span>
							<input
								aria-label="New space name"
								className="h-10 rounded-md border border-border bg-background px-3 text-sm"
								onChange={(e) => setNewSpaceName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleCreate();
									}
								}}
								placeholder="Team budget"
								type="text"
								value={newSpaceName}
							/>
						</label>
						<div className="mt-2 flex justify-end gap-2">
							<Dialog.Close asChild>
								<button
									className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									type="button"
								>
									Cancel
								</button>
							</Dialog.Close>
							<button
								className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								disabled={isLoading || isCreatingSpace || !newSpaceName.trim()}
								onClick={handleCreate}
								type="button"
							>
								{isCreatingSpace ? "Creating…" : "Create space"}
							</button>
						</div>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};
