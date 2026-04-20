import type { Space, Tenant } from "@cofi/api";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspaceNavSnapshot } from "../../shared/hooks/useWorkspaceNavSnapshot";
import { apiClient, writeActiveOrgTenantId } from "../../shared/lib/apiClient";
import { writeChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { isNonPersonalTenantType } from "../../shared/lib/tenantTypes";

const uniqueTenantIds = (spaces: Space[]): number[] => {
	const seen = new Set<number>();
	for (const s of spaces) {
		const tid = Number(s.tenant_id);
		if (Number.isFinite(tid)) seen.add(tid);
	}
	return [...seen].sort((a, b) => a - b);
};

const nonPersonalTenantIdsSorted = (
	sortedIds: number[],
	meta: Record<number, Tenant | null>,
): number[] =>
	sortedIds.filter((id) => {
		const t = meta[id];
		return t != null && isNonPersonalTenantType(t.type);
	});

const tenantLabel = (
	id: number,
	meta: Record<number, Tenant | null>,
): string => {
	const t = meta[id];
	if (t?.name?.trim()) return t.name.trim();
	return `Tenant ${id}`;
};

type SwitchOrganizationDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const SwitchOrganizationDialog = ({
	open,
	onOpenChange,
}: SwitchOrganizationDialogProps) => {
	const navigate = useNavigate();
	const { activeOrgTenantId: activeId } = useWorkspaceNavSnapshot();
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [tenantMetaById, setTenantMetaById] = useState<
		Record<number, Tenant | null>
	>({});
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setLoadError(null);
		setSpaces(null);
		setTenantMetaById({});
		void (async () => {
			try {
				const list = await apiClient.spaces.list({ tenantId: null });
				if (cancelled) return;
				setSpaces(list);
			} catch (e) {
				if (!cancelled) {
					setSpaces([]);
					setLoadError(
						e instanceof Error ? e.message : "Failed to load organizations",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open]);

	useEffect(() => {
		if (!open || spaces === null) return;
		const ids = uniqueTenantIds(spaces);
		if (ids.length === 0) {
			setTenantMetaById({});
			return;
		}
		let cancelled = false;
		void (async () => {
			const pairs = await Promise.all(
				ids.map(async (id) => {
					try {
						const t = await apiClient.tenants.get(id, {
							tenantIdHeader: id,
						});
						return [id, t] as const;
					} catch {
						return [id, null] as const;
					}
				}),
			);
			if (cancelled) return;
			const next: Record<number, Tenant | null> = {};
			for (const [id, t] of pairs) next[id] = t;
			setTenantMetaById(next);
		})();
		return () => {
			cancelled = true;
		};
	}, [open, spaces]);

	const orgIds = useMemo(() => {
		if (spaces === null) return [];
		return nonPersonalTenantIdsSorted(uniqueTenantIds(spaces), tenantMetaById);
	}, [spaces, tenantMetaById]);

	const tenantIds = spaces ? uniqueTenantIds(spaces) : [];
	const metaReady =
		spaces === null ||
		tenantIds.length === 0 ||
		tenantIds.every((id) =>
			Object.prototype.hasOwnProperty.call(tenantMetaById, id),
		);
	const isLoading = open && (spaces === null || !metaReady);

	const handleSelect = (tenantId: number) => {
		const label = tenantLabel(tenantId, tenantMetaById);
		writeActiveOrgTenantId(tenantId);
		writeChatWorkspaceScope({
			kind: "organization",
			tenantId,
			label,
		});
		onOpenChange(false);
		void navigate("/console/dashboard/business", { replace: true });
	};

	return (
		<Dialog.Root onOpenChange={onOpenChange} open={open}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
				<Dialog.Content
					className="fixed left-1/2 top-1/2 z-[100] grid w-[min(100vw-2rem,24rem)] max-h-[min(80vh,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg focus:outline-none"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div className="space-y-1.5">
						<Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
							Switch organization
						</Dialog.Title>
						<Dialog.Description className="text-sm text-muted-foreground">
							Choose which organization your dashboard, chat, and API context
							should use.
						</Dialog.Description>
					</div>

					{loadError ? (
						<p className="text-sm text-destructive" role="alert">
							{loadError}
						</p>
					) : null}

					{isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : null}

					{!isLoading && spaces !== null && orgIds.length === 0 ? (
						<div className="space-y-3 text-sm text-muted-foreground">
							<p>No organization workspaces yet.</p>
							<Link
								className="font-medium text-foreground underline underline-offset-2"
								onClick={() => onOpenChange(false)}
								to="/console/organization"
							>
								Organization settings
							</Link>
						</div>
					) : null}

					{orgIds.length > 0 ? (
						<ul aria-label="Organizations" className="flex flex-col gap-2">
							{orgIds.map((id) => {
								const label = tenantLabel(id, tenantMetaById);
								const selected = activeId === id;
								return (
									<li key={id}>
										<button
											aria-current={selected ? "true" : undefined}
											className={[
												"w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
												selected
													? "border-primary bg-primary/10 text-foreground"
													: "border-border bg-background hover:bg-accent",
											].join(" ")}
											onClick={() => handleSelect(id)}
											type="button"
										>
											<span className="block truncate">{label}</span>
										</button>
									</li>
								);
							})}
						</ul>
					) : null}

					<div className="flex justify-end">
						<Dialog.Close asChild>
							<button
								className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								type="button"
							>
								Cancel
							</button>
						</Dialog.Close>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};
