import type { CapabilitySummary, QuotaStatus, Space } from "@cofi/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../shared/lib/apiClient";

type TestPlan = "basic" | "medium" | "premium";

const TEST_PLANS: { value: TestPlan; label: string; note: string }[] = [
	{ value: "basic", label: "Basic", note: "Basic capture" },
	{ value: "medium", label: "Medium", note: "Smart capture" },
	{ value: "premium", label: "Premium", note: "Deep intelligence" },
];

const buttonBase =
	"inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50";
const inputBase =
	"w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

const errorMessageFrom = (err: unknown) =>
	err instanceof Error ? err.message : "Subscription test plan request failed";

const isTestPlan = (value: unknown): value is TestPlan =>
	value === "basic" || value === "medium" || value === "premium";

const formatFeatureLabel = (key: string) =>
	key
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

const CapabilitySummaryBlock = ({
	capabilities,
}: {
	capabilities: CapabilitySummary | undefined;
}) => {
	if (!capabilities) {
		return (
			<div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
				Load the current plan to see capability state.
			</div>
		);
	}

	const enabledFeatures = Object.entries(capabilities.features)
		.filter(([, enabled]) => enabled)
		.map(([key]) => key);
	const disabledFeatures = Object.entries(capabilities.features)
		.filter(([, enabled]) => !enabled)
		.map(([key]) => key);

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
			<div className="rounded-xl border border-border bg-card p-4">
				<p className="eyebrow">Capture policy</p>
				<div className="mt-3 grid gap-2 text-sm">
					<div className="flex justify-between gap-3">
						<span className="text-muted-foreground">Max profile</span>
						<span className="font-mono text-xs">
							{capabilities.capture.max_profile}
						</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-muted-foreground">Text</span>
						<span className="font-mono text-xs">
							{capabilities.capture.text.profile}
						</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-muted-foreground">Image</span>
						<span className="font-mono text-xs">
							{capabilities.capture.image.profile}
						</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-muted-foreground">Voice</span>
						<span className="font-mono text-xs">
							{capabilities.capture.voice.profile}
						</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-muted-foreground">Deep allowed</span>
						<span className="font-mono text-xs">
							{String(capabilities.capture.deep_allowed)}
						</span>
					</div>
				</div>
			</div>
			<div className="rounded-xl border border-border bg-card p-4">
				<p className="eyebrow">Feature gates</p>
				<div className="mt-3 grid gap-3 md:grid-cols-2">
					<div>
						<p className="text-xs font-semibold text-foreground">Enabled</p>
						<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
							{enabledFeatures.map((feature) => (
								<li key={feature}>{formatFeatureLabel(feature)}</li>
							))}
						</ul>
					</div>
					<div>
						<p className="text-xs font-semibold text-foreground">Limited</p>
						<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
							{disabledFeatures.map((feature) => (
								<li key={feature}>{formatFeatureLabel(feature)}</li>
							))}
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
};

export const SubscriptionTestPlanPanel = () => {
	const [quota, setQuota] = useState<QuotaStatus | null>(null);
	const [spaces, setSpaces] = useState<Space[]>([]);
	const [spaceId, setSpaceId] = useState("");
	const [plan, setPlan] = useState<TestPlan>("basic");
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const selectedPlan = useMemo(
		() => TEST_PLANS.find((entry) => entry.value === plan) ?? TEST_PLANS[0],
		[plan],
	);

	const loadQuota = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const opts = spaceId === "" ? {} : { spaceId: Number(spaceId) };
			const next = await apiClient.quota.get(opts);
			setQuota(next);
			if (isTestPlan(next.capabilities?.plan)) {
				setPlan(next.capabilities.plan);
			} else if (isTestPlan(next.plan)) {
				setPlan(next.plan);
			}
		} catch (err) {
			setQuota(null);
			setErrorMessage(errorMessageFrom(err));
		} finally {
			setIsLoading(false);
		}
	}, [spaceId]);

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

	useEffect(() => {
		void loadQuota();
	}, [loadQuota]);

	const handleSave = async () => {
		setIsSaving(true);
		setErrorMessage(null);
		setStatusMessage(null);
		try {
			const opts = spaceId === "" ? {} : { spaceId: Number(spaceId) };
			const next = await apiClient.quota.setTestPlan({ plan }, opts);
			setQuota(next);
			setStatusMessage(`Test plan set to ${selectedPlan.label}.`);
		} catch (err) {
			setErrorMessage(errorMessageFrom(err));
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-5 p-6">
			<div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
				<p className="font-semibold">Dev test control</p>
				<p className="mt-1">
					This changes the tenant entitlement row for local capability testing.
					It is not a billing or payment flow.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground">Tenant scope</span>
					<select
						className={inputBase}
						onChange={(e) => setSpaceId(e.target.value)}
						value={spaceId}
					>
						<option value="">Default personal tenant</option>
						{spaces.map((space) => (
							<option key={String(space.id)} value={String(space.id)}>
								{space.name} (space #{String(space.id)})
							</option>
						))}
					</select>
				</label>
				<label className="space-y-1 text-sm">
					<span className="text-muted-foreground">Test plan</span>
					<select
						className={inputBase}
						onChange={(e) => setPlan(e.target.value as TestPlan)}
						value={plan}
					>
						{TEST_PLANS.map((entry) => (
							<option key={entry.value} value={entry.value}>
								{entry.label} — {entry.note}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="flex flex-wrap gap-2">
				<button
					className={`${buttonBase} bg-primary text-primary-foreground`}
					disabled={isSaving || isLoading}
					onClick={() => void handleSave()}
					type="button"
				>
					{isSaving ? "Saving..." : "Apply test plan"}
				</button>
				<button
					className={buttonBase}
					disabled={isLoading || isSaving}
					onClick={() => void loadQuota()}
					type="button"
				>
					{isLoading ? "Loading..." : "Refresh"}
				</button>
			</div>

			{errorMessage ? (
				<div
					className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
				>
					{errorMessage}
				</div>
			) : null}
			{statusMessage ? (
				<output
					aria-live="polite"
					className="block rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground"
				>
					{statusMessage}
				</output>
			) : null}

			<div className="rounded-xl border border-border bg-muted/30 p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="eyebrow">Current plan</p>
						<p className="mt-1 font-display text-2xl font-bold text-foreground">
							{quota?.capabilities?.plan ?? quota?.plan ?? "Unknown"}
						</p>
					</div>
					<div className="text-right text-xs text-muted-foreground">
						<p>Tenant #{quota?.tenant_id ?? "—"}</p>
						<p>Capture limit {quota?.capture_monthly_limit ?? "—"}</p>
					</div>
				</div>
			</div>

			<CapabilitySummaryBlock capabilities={quota?.capabilities} />
		</div>
	);
};
