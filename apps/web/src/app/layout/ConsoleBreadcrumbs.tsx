import { Link, useLocation } from "react-router-dom";
import { useWorkspaceNavSnapshot } from "../../shared/hooks/useWorkspaceNavSnapshot";
import {
	type ChatBreadcrumbPayload,
	useChatBreadcrumbValue,
} from "./ChatBreadcrumbContext";

const Chevron = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		height="12"
		stroke="currentColor"
		strokeLinecap="round"
		strokeWidth="1.75"
		viewBox="0 0 24 24"
		width="12"
	>
		<title>Breadcrumb separator</title>
		<path d="M9 6l6 6-6 6" />
	</svg>
);

type Crumb = {
	label: string;
	to?: string;
	detail?: string | null;
};

const buildCrumbs = (
	pathname: string,
	tab: "personal" | "business",
	chat: ChatBreadcrumbPayload | null,
): Crumb[] => {
	const dashboardHref =
		tab === "business"
			? "/console/dashboard/business"
			: "/console/dashboard/personal";

	const workspace: Crumb = {
		label: tab === "business" ? "Business" : "Personal",
		to: dashboardHref,
	};

	if (pathname.startsWith("/console/dashboard/")) {
		return [
			{ label: "Console", to: "/console" },
			workspace,
			{ label: "Dashboard" },
		];
	}

	if (pathname.startsWith("/console/chat")) {
		const space = chat?.spaceName?.trim() ?? "";
		const hasThread = Boolean(chat?.thread);
		const base: Crumb[] = [{ label: "Console", to: "/console" }, workspace];

		if (!space && !hasThread) {
			base.push({ label: "Chat" });
			if (pathname.startsWith("/console/chat/thread")) {
				base.push({ label: "Thread" });
			}
			return base;
		}

		base.push({ label: "Chat", to: "/console/chat" });

		if (!space && hasThread && chat?.thread) {
			base.push({
				label: chat.thread.label,
				detail: chat.thread.detail ?? null,
			});
			return base;
		}

		if (space) {
			if (!hasThread) {
				base.push({ label: space });
				return base;
			}
			base.push({ label: space });
			base.push({
				label: chat?.thread?.label ?? "Expense thread",
				detail: chat?.thread?.detail ?? null,
			});
			return base;
		}

		if (pathname.startsWith("/console/chat/thread")) {
			base.push({ label: "Thread" });
		}
		return base;
	}

	const tail = pathname
		.replace(/^\/console\/?/, "")
		.split("/")
		.filter(Boolean);
	const section = tail[0] ?? "";

	const sectionLabel: Record<string, string> = {
		account: "Account",
		spaces: "Spaces",
		drafts: "Drafts",
		transactions: "Transactions",
		recurring: "Recurring",
		quota: "Quota",
		organization: "Organization",
	};

	const pageLabel = sectionLabel[section] ?? "Console";

	if (section === "" || pathname === "/console") {
		return [{ label: "Console", to: "/console" }, workspace];
	}

	return [
		{ label: "Console", to: "/console" },
		workspace,
		{ label: pageLabel },
	];
};

const CrumbLabel = ({
	crumb,
	isLast,
	isWorkspace,
}: {
	crumb: Crumb;
	isLast: boolean;
	isWorkspace: boolean;
}) => {
	const body = crumb.detail ? (
		<span className="flex max-w-[min(100vw-6rem,28rem)] flex-col gap-0.5">
			<span className="truncate">{crumb.label}</span>
			<span className="truncate text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
				{crumb.detail}
			</span>
		</span>
	) : (
		crumb.label
	);

	if (isLast || crumb.to == null) {
		return (
			<span
				className={[
					"min-w-0",
					isLast
						? crumb.detail
							? "text-xs font-semibold tracking-tight text-foreground sm:text-sm"
							: "text-xs font-semibold tracking-tight text-foreground sm:text-sm"
						: "text-foreground",
					isWorkspace && !isLast
						? "rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]"
						: "",
				].join(" ")}
			>
				{body}
			</span>
		);
	}

	return (
		<Link
			className={[
				"min-w-0 truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				isWorkspace
					? "rounded-md border border-border/60 bg-gradient-to-b from-muted/90 to-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground shadow-sm hover:border-primary/30 hover:text-foreground sm:text-[11px]"
					: "text-muted-foreground hover:text-foreground",
			].join(" ")}
			to={crumb.to}
		>
			{body}
		</Link>
	);
};

export const ConsoleBreadcrumbs = () => {
	const { pathname } = useLocation();
	const { tab } = useWorkspaceNavSnapshot();
	const chatBreadcrumb = useChatBreadcrumbValue();
	const crumbs = buildCrumbs(pathname, tab, chatBreadcrumb);

	return (
		<nav aria-label="Breadcrumb" className="mb-6">
			<ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium tracking-wide sm:text-xs">
				{crumbs.map((crumb, i) => {
					const isLast = i === crumbs.length - 1;
					const isWorkspace =
						crumb.label === "Personal" || crumb.label === "Business";

					return (
						<li
							className="flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-none"
							key={`${crumb.label}-${i}-${crumb.to ?? ""}`}
						>
							{i > 0 ? (
								<Chevron className="shrink-0 text-muted-foreground/45" />
							) : null}
							<CrumbLabel
								crumb={crumb}
								isLast={isLast}
								isWorkspace={isWorkspace}
							/>
						</li>
					);
				})}
			</ol>
			<div
				aria-hidden
				className="pointer-events-none mt-3 h-px w-full max-w-md bg-gradient-to-r from-transparent via-border to-transparent opacity-80"
			/>
		</nav>
	);
};
