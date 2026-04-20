import { useState } from "react";
import type { QuotaStatus } from "@cofi/api";
import { apiClient } from "../../shared/lib/apiClient";

export const QuotaPage = () => {
	const [quota, setQuota] = useState<QuotaStatus | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleLoadQuota = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await apiClient.quota.get();
			setQuota(data);
		} catch (err) {
			setQuota(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to load quota");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Quota</h1>
				<p className="text-sm text-muted-foreground">
					Backend quota status for parses (Free/Plus). This is used to gate draft
					creation.
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button
					className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
					disabled={isLoading}
					onClick={handleLoadQuota}
					type="button"
				>
					Load quota
				</button>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
				{JSON.stringify(quota, null, 2)}
			</pre>
		</section>
	);
};

