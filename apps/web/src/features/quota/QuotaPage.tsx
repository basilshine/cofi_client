import type { QuotaStatus, Space } from "@cofi/api";
import { useEffect, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";

const quotaFieldRows = (q: QuotaStatus) =>
	[
		["tenant_id", String(q.tenant_id)],
		["plan", q.plan],
		["limit (AI parse monthly)", String(q.limit)],
		["used", String(q.used)],
		["remaining", String(q.remaining)],
		["ai_parse_monthly_limit", String(q.ai_parse_monthly_limit)],
		["max_spaces", String(q.max_spaces)],
		["max_members", String(q.max_members)],
		["export_enabled", String(q.export_enabled)],
		["audit_enabled", String(q.audit_enabled)],
	] as const;

export const QuotaPage = () => {
	const [quota, setQuota] = useState<QuotaStatus | null>(null);
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [quotaSpaceId, setQuotaSpaceId] = useState<string>("");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const list = await apiClient.spaces.list({ tenantId: null });
				if (!cancelled) setSpaces(list);
			} catch {
				if (!cancelled) setSpaces([]);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleLoadQuota = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const opts = quotaSpaceId === "" ? {} : { spaceId: Number(quotaSpaceId) };
			const data = await apiClient.quota.get(opts);
			setQuota(data);
		} catch (err) {
			setQuota(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load quota",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const auditSurface =
		quota != null
			? quota.audit_enabled
				? "Organization audit log and compliance surfaces can be shown for this plan (read API may arrive in a later release)."
				: "Organization audit log is not included on the current plan — related UI stays hidden."
			: null;

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Quota</h1>
				<p className="text-sm text-muted-foreground">
					Tenant entitlements and AI parse allowance. Optional{" "}
					<code className="rounded bg-muted px-1 font-mono text-xs">
						space_id
					</code>{" "}
					resolves the tenant via your membership.
				</p>
			</div>

			<div className="flex flex-wrap items-end gap-3">
				<label className="grid gap-1 text-sm">
					<span className="text-muted-foreground">Scope quota to space</span>
					<select
						aria-label="Space for quota request"
						className="h-10 min-w-[12rem] rounded-md border border-border bg-background px-3 text-sm"
						onChange={(e) => setQuotaSpaceId(e.target.value)}
						value={quotaSpaceId}
					>
						<option value="">Default (personal / current tenant)</option>
						{(spaces ?? []).map((s) => (
							<option key={String(s.id)} value={String(s.id)}>
								{s.name} (#{String(s.id)})
							</option>
						))}
					</select>
				</label>
				<button
					className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
					disabled={isLoading}
					onClick={() => void handleLoadQuota()}
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

			{quota ? (
				<div className="space-y-4">
					<div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
						{quotaFieldRows(quota).map(([k, v]) => (
							<div
								className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
								key={k}
							>
								<span className="min-w-[12rem] font-medium text-muted-foreground">
									{k}
								</span>
								<span className="font-mono text-xs text-foreground">{v}</span>
							</div>
						))}
					</div>
					{auditSurface ? (
						<output
							aria-live="polite"
							className="block rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
						>
							{auditSurface}
						</output>
					) : null}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">
					Load quota to see tenant limits and flags.
				</p>
			)}

			<details className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
				<summary className="cursor-pointer font-medium text-muted-foreground">
					Raw JSON
				</summary>
				<pre className="mt-2 overflow-auto rounded-md bg-muted p-3 font-mono">
					{JSON.stringify(quota, null, 2)}
				</pre>
			</details>
		</section>
	);
};
