import type { SpaceMember, SpaceRole } from "@cofi/api";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useId,
	useRef,
} from "react";

const ASSIGNABLE_ROLES: Exclude<SpaceRole, "owner">[] = [
	"admin",
	"editor",
	"member",
	"viewer",
];

const roleLabel = (r: SpaceRole): string => {
	switch (r) {
		case "owner":
			return "Owner";
		case "admin":
			return "Admin";
		case "editor":
			return "Editor";
		case "member":
			return "Member";
		case "viewer":
			return "Viewer";
		default:
			return r;
	}
};

/** What this space role can do in Ceits (aligned with server checks; high-level copy). */
const permissionsForRole = (role: SpaceRole): readonly string[] => {
	switch (role) {
		case "owner":
			return [
				"Full control in this space (when also a tenant admin: invites and member roles).",
				"Post in chat, capture expenses, and use expense threads.",
				"Finalize threads and manage splits where applicable.",
				"Delete any message in the main chat (per product rules).",
			];
		case "admin":
			return [
				"Post in chat, capture expenses, and participate in expense threads.",
				"Approve on threads and collaborate on drafts like other members.",
				"Same baseline as editor/member unless additional rules are added later.",
			];
		case "editor":
			return [
				"Post in chat and capture expenses.",
				"Participate in expense threads and approvals.",
			];
		case "member":
			return [
				"Post in chat and capture expenses.",
				"Participate in expense threads and record approvals.",
			];
		case "viewer":
			return [
				"Read space content shared with members.",
				"Cannot post in chat or capture (server requires at least “member” to post).",
			];
		default:
			return ["Member of this space."];
	}
};

export type SpaceMemberDetailsDialogProps = {
	member: SpaceMember | null;
	open: boolean;
	onClose: () => void;
	canManageMemberRoles: boolean;
	currentUserId: number | null;
	onSaveRole: (
		userId: number,
		role: Exclude<SpaceRole, "owner">,
	) => Promise<void>;
	isSaving: boolean;
	errorMessage: string | null;
	/** When set, shows “Remove from space” for non-owners (not you). Parent performs API call. */
	onRemoveFromSpace?: (userId: number) => Promise<boolean>;
	removeMemberSaving?: boolean;
};

export const SpaceMemberDetailsDialog = ({
	member,
	open,
	onClose,
	canManageMemberRoles,
	currentUserId,
	onSaveRole,
	isSaving,
	errorMessage,
	onRemoveFromSpace,
	removeMemberSaving = false,
}: SpaceMemberDetailsDialogProps) => {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const descId = useId();

	useEffect(() => {
		const d = dialogRef.current;
		if (!d) return;
		if (open) {
			if (!d.open) d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [open]);

	const handleDialogKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		}
	};

	const handleBackdropClick = (e: { target: EventTarget | null }) => {
		if (e.target === dialogRef.current) onClose();
	};

	if (!member) return null;

	const perms = permissionsForRole(member.role);
	const isOwnerRow = member.role === "owner";
	const isSelf =
		currentUserId != null && Number(member.user_id) === currentUserId;
	const canEditRole = canManageMemberRoles && !isOwnerRow && !isSaving;
	const canRemoveMember =
		Boolean(onRemoveFromSpace) &&
		canManageMemberRoles &&
		!isOwnerRow &&
		!isSelf &&
		!removeMemberSaving &&
		!isSaving;

	const handleSaveRole = async (next: Exclude<SpaceRole, "owner">) => {
		if (!canEditRole || next === member.role) return;
		await onSaveRole(Number(member.user_id), next);
	};

	const handleRemoveFromSpace = async () => {
		if (!onRemoveFromSpace || !canRemoveMember) return;
		const ok = await onRemoveFromSpace(Number(member.user_id));
		if (ok) onClose();
	};

	return (
		<dialog
			aria-describedby={descId}
			aria-labelledby={titleId}
			className="z-[110] max-h-[min(90vh,520px)] w-[min(100%,420px)] rounded-xl border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/50"
			onClick={handleBackdropClick}
			onKeyDown={handleDialogKeyDown}
			ref={dialogRef}
		>
			<div className="flex max-h-[min(90vh,520px)] flex-col">
				<header className="border-b border-border px-4 py-3">
					<h2 className="text-base font-semibold" id={titleId}>
						Member in this space
					</h2>
					<p className="mt-1 text-xs text-muted-foreground" id={descId}>
						Role and what it allows in Ceits. Tenant-wide access is managed
						separately under Organization.
					</p>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
					<div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
						<div className="truncate font-medium">
							{member.name?.trim() ||
								member.email?.trim() ||
								`User ${member.user_id}`}
						</div>
						<div className="mt-0.5 truncate text-xs text-muted-foreground">
							{member.email ? member.email : `User ID ${member.user_id}`}
						</div>
						<div className="mt-2 text-xs">
							<span className="text-muted-foreground">Current role: </span>
							<span className="font-semibold uppercase tracking-wide text-foreground">
								{roleLabel(member.role)}
							</span>
							{isSelf ? (
								<span className="ml-1 text-muted-foreground">(you)</span>
							) : null}
						</div>
					</div>

					{isOwnerRow ? (
						<p className="mt-3 text-xs text-muted-foreground">
							The space owner’s role is fixed here. Transfer or advanced changes
							are not available in this dialog.
						</p>
					) : null}

					<div className="mt-4">
						<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Permissions for this role
						</div>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground">
							{perms.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					</div>

					{canManageMemberRoles && !isOwnerRow ? (
						<div className="mt-4">
							<label className="grid gap-1">
								<span className="text-xs font-medium text-foreground">
									Change role
								</span>
								<select
									aria-label="Member space role"
									className="rounded-md border border-border bg-background px-2 py-2 text-sm disabled:opacity-50"
									disabled={!canEditRole}
									onChange={(e) => {
										const v = e.target.value as Exclude<SpaceRole, "owner">;
										void handleSaveRole(v);
									}}
									value={member.role}
								>
									{ASSIGNABLE_ROLES.map((r) => (
										<option key={r} value={r}>
											{roleLabel(r)}
										</option>
									))}
								</select>
							</label>
							<p className="mt-1 text-[10px] text-muted-foreground">
								Only organization admins who are also the space owner can change
								roles. If you do not see this, ask the owner or use Organization
								settings.
							</p>
						</div>
					) : null}

					{!canManageMemberRoles ? (
						<p className="mt-4 text-xs text-muted-foreground">
							You can view roles for everyone in this space. To change roles,
							you must be a tenant admin and the space owner.
						</p>
					) : null}

					{canRemoveMember ? (
						<div className="mt-4 border-t border-border pt-4">
							<button
								aria-label="Remove member from this space"
								className="w-full rounded-md border border-destructive/40 bg-background px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
								disabled={removeMemberSaving}
								onClick={() => void handleRemoveFromSpace()}
								type="button"
							>
								{removeMemberSaving ? "Removing…" : "Remove from space"}
							</button>
							<p className="mt-2 text-[10px] text-muted-foreground">
								Removes them from this space only. The space owner cannot be
								removed here.
							</p>
						</div>
					) : null}

					{errorMessage ? (
						<p className="mt-3 text-xs text-destructive" role="alert">
							{errorMessage}
						</p>
					) : null}
				</div>
				<footer className="border-t border-border px-4 py-3">
					<button
						className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
						disabled={isSaving}
						onClick={onClose}
						type="button"
					>
						Close
					</button>
				</footer>
			</div>
		</dialog>
	);
};
