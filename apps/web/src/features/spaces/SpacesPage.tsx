import type { Space } from "@cofi/api";
import { useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";

export const SpacesPage = () => {
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleLoadSpaces = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await apiClient.spaces.list({ tenantId: null });
			setSpaces(data);
		} catch (err) {
			setSpaces(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load spaces",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Spaces</h1>
				<p className="text-sm text-muted-foreground">
					V1 is single-owner. You should see a default space (Personal).
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button
					className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
					disabled={isLoading}
					onClick={handleLoadSpaces}
					type="button"
				>
					Load spaces
				</button>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
				{JSON.stringify(spaces, null, 2)}
			</pre>
		</section>
	);
};
