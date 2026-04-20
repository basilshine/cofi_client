import type { InviteSuggestionUser, PendingInviteBrief } from "@cofi/api";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

/** Loose email check for “invite new address” row. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SpaceInviteComboboxProps = {
	value: string;
	onChange: (next: string) => void;
	suggestions: InviteSuggestionUser[] | null;
	pendingInvites: PendingInviteBrief[] | null;
	disabled?: boolean;
};

export const SpaceInviteCombobox = ({
	value,
	onChange,
	suggestions,
	pendingInvites,
	disabled,
}: SpaceInviteComboboxProps) => {
	const listId = useId();
	const wrapRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	const q = value.trim().toLowerCase();

	const filteredSuggestions = useMemo(() => {
		if (!suggestions?.length) return [];
		if (!q) return suggestions;
		return suggestions.filter((s) => {
			const name = (s.name || "").toLowerCase();
			const email = (s.email || "").toLowerCase();
			return name.includes(q) || email.includes(q);
		});
	}, [suggestions, q]);

	const filteredPending = useMemo(() => {
		if (!pendingInvites?.length) return [];
		if (!q) return pendingInvites;
		return pendingInvites.filter((p) =>
			p.invitee_email.toLowerCase().includes(q),
		);
	}, [pendingInvites, q]);

	const trimmed = value.trim();
	const emailExactInSuggestions = filteredSuggestions.some(
		(s) => (s.email || "").trim().toLowerCase() === trimmed.toLowerCase(),
	);
	const showNewEmailRow =
		LOOKS_LIKE_EMAIL.test(trimmed) &&
		!emailExactInSuggestions &&
		!filteredPending.some(
			(p) => p.invitee_email.trim().toLowerCase() === trimmed.toLowerCase(),
		);

	const handlePickEmail = useCallback(
		(email: string) => {
			onChange(email);
			setOpen(false);
		},
		[onChange],
	);

	const loaded = suggestions != null;
	const showDropdown =
		open &&
		loaded &&
		(filteredSuggestions.length > 0 ||
			filteredPending.length > 0 ||
			showNewEmailRow);

	return (
		<div className="relative" ref={wrapRef}>
			<input
				aria-autocomplete="list"
				aria-controls={listId}
				aria-expanded={showDropdown}
				autoComplete="off"
				className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
				disabled={disabled}
				id={`${listId}-input`}
				onChange={(e) => onChange(e.target.value)}
				onFocus={() => setOpen(true)}
				placeholder="Search name or email, or type a new address…"
				role="combobox"
				type="text"
				value={value}
			/>
			{showDropdown ? (
				<ul
					className="absolute left-0 right-0 z-50 mt-1 max-h-60 list-none overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
					id={listId}
				>
					{filteredPending.length > 0 ? (
						<li
							className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
							role="presentation"
						>
							Already invited (pending)
						</li>
					) : null}
					{filteredPending.map((p) => (
						<li
							className="px-3 py-2 text-xs text-muted-foreground"
							key={p.id ?? `${p.invitee_email}-${p.created_at}`}
						>
							<span className="font-mono">{p.invitee_email}</span>
							<span className="text-amber-700 dark:text-amber-400">
								{" "}
								· pending
							</span>
						</li>
					))}
					{filteredSuggestions.length > 0 ? (
						<li
							className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
							role="presentation"
						>
							Tenant members not in this space
						</li>
					) : null}
					{filteredSuggestions.map((u) => {
						const em = u.email?.trim();
						return (
							<li key={u.user_id}>
								<button
									className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
									disabled={!em}
									onClick={() => em && handlePickEmail(em)}
									type="button"
								>
									<span className="min-w-0 flex-1">
										<span className="font-medium text-foreground">
											{u.name?.trim() || `User ${u.user_id}`}
										</span>
										{em ? (
											<span className="block truncate text-muted-foreground">
												{em}
											</span>
										) : (
											<span className="block text-amber-800 dark:text-amber-300">
												No email on file — add email in Account or invite by
												typing an address below.
											</span>
										)}
									</span>
								</button>
							</li>
						);
					})}
					{showNewEmailRow ? (
						<li className="border-t border-border/80">
							<button
								className="w-full px-3 py-2 text-left text-xs hover:bg-accent"
								onClick={() => handlePickEmail(trimmed)}
								type="button"
							>
								<span className="font-medium text-foreground">
									Invite new address
								</span>
								<span className="ml-1 font-mono text-muted-foreground">
									{trimmed}
								</span>
							</button>
						</li>
					) : null}
				</ul>
			) : null}
			{!loaded && open ? (
				<p className="mt-1 text-[10px] text-muted-foreground" role="status">
					Loading suggestions…
				</p>
			) : null}
		</div>
	);
};
