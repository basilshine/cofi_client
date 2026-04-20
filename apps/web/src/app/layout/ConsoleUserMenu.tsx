import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTenantDisplayName } from "../../shared/hooks/useTenantDisplayName";
import { useWorkspaceNavSnapshot } from "../../shared/hooks/useWorkspaceNavSnapshot";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { SwitchOrganizationDialog } from "./SwitchOrganizationDialog";

const menuItemClass =
	"block cursor-pointer rounded-md px-2 py-2 text-sm text-foreground outline-none focus:bg-accent data-[highlighted]:bg-accent";

const ChevronDown = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeWidth={2}
		viewBox="0 0 24 24"
	>
		<title>Menu</title>
		<path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export const ConsoleUserMenu = () => {
	const { user, logout } = useAuth();
	const { tab, chatScope, activeOrgTenantId } = useWorkspaceNavSnapshot();
	const [switchOrgOpen, setSwitchOrgOpen] = useState(false);

	const isBusiness = tab === "business";

	const tenantIdForDisplayName =
		activeOrgTenantId ??
		(isBusiness && chatScope?.kind === "organization"
			? chatScope.tenantId
			: null);

	const fetchedOrgName = useTenantDisplayName(tenantIdForDisplayName);

	const orgDisplay = useMemo(() => {
		if (activeOrgTenantId != null) {
			if (
				chatScope?.kind === "organization" &&
				chatScope.tenantId === activeOrgTenantId &&
				chatScope.label?.trim()
			) {
				return chatScope.label.trim();
			}
			if (fetchedOrgName?.trim()) return fetchedOrgName.trim();
			return "Organization";
		}
		if (chatScope?.kind === "organization" && chatScope.label?.trim()) {
			return chatScope.label.trim();
		}
		if (fetchedOrgName?.trim()) return fetchedOrgName.trim();
		return "Organization";
	}, [activeOrgTenantId, chatScope, fetchedOrgName]);

	const userDisplay =
		user?.name?.trim() || user?.email?.split("@")[0] || "Account";

	const triggerLabel = isBusiness ? orgDisplay : userDisplay;

	const chatLinkState = useMemo(():
		| { chatWorkspace: ChatWorkspaceScope }
		| undefined => {
		if (activeOrgTenantId != null) {
			return {
				chatWorkspace: {
					kind: "organization",
					tenantId: activeOrgTenantId,
					label: orgDisplay,
				},
			};
		}
		if (chatScope?.kind === "organization") {
			return {
				chatWorkspace: {
					kind: "organization",
					tenantId: chatScope.tenantId,
					label: chatScope.label?.trim() || orgDisplay,
				},
			};
		}
		if (chatScope?.kind === "personal") {
			return { chatWorkspace: chatScope };
		}
		return undefined;
	}, [activeOrgTenantId, chatScope, orgDisplay]);

	if (!user?.email) return null;

	return (
		<>
			<SwitchOrganizationDialog
				onOpenChange={setSwitchOrgOpen}
				open={switchOrgOpen}
			/>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger asChild>
					<button
						aria-label="Open account menu"
						className="flex max-w-[min(18rem,calc(100vw-10rem))] shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[20rem]"
						type="button"
					>
						<span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
						<ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
					</button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						align="end"
						className="z-50 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
						sideOffset={6}
					>
						{isBusiness ? (
							<>
								<div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									Active organization
								</div>
								<div className="max-w-full px-2 pb-2 text-sm font-medium leading-snug break-words">
									{orgDisplay}
								</div>
								<DropdownMenu.Separator className="my-1 h-px bg-border" />
							</>
						) : null}

						<div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							Signed in
						</div>
						<div className="max-w-full break-words px-2 text-sm font-medium">
							{user.email}
						</div>
						{user.name?.trim() ? (
							<div className="px-2 pb-2 text-xs text-muted-foreground break-words">
								{user.name}
							</div>
						) : (
							<div className="pb-2" />
						)}

						<DropdownMenu.Separator className="my-1 h-px bg-border" />

						<DropdownMenu.Item asChild className={menuItemClass}>
							<Link to="/console/dashboard/personal">Personal dashboard</Link>
						</DropdownMenu.Item>
						{isBusiness ? (
							<DropdownMenu.Item
								className={menuItemClass}
								onSelect={() => setSwitchOrgOpen(true)}
							>
								Switch organization…
							</DropdownMenu.Item>
						) : (
							<DropdownMenu.Item asChild className={menuItemClass}>
								<Link to="/console/dashboard/business">Business dashboard</Link>
							</DropdownMenu.Item>
						)}

						<DropdownMenu.Separator className="my-1 h-px bg-border" />

						<DropdownMenu.Item asChild className={menuItemClass}>
							<Link to="/console/account">Account</Link>
						</DropdownMenu.Item>
						<DropdownMenu.Item asChild className={menuItemClass}>
							<Link to="/console/organization">Organization</Link>
						</DropdownMenu.Item>
						<DropdownMenu.Item asChild className={menuItemClass}>
							<Link state={chatLinkState} to="/console/spaces">
								Spaces
							</Link>
						</DropdownMenu.Item>
						<DropdownMenu.Item asChild className={menuItemClass}>
							<Link state={chatLinkState} to="/console/chat">
								Chat
							</Link>
						</DropdownMenu.Item>

						<DropdownMenu.Separator className="my-1 h-px bg-border" />

						<DropdownMenu.Item
							className={`${menuItemClass} text-destructive focus:text-destructive`}
							onSelect={() => logout()}
						>
							Sign out
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</>
	);
};
