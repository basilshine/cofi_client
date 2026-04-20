import type { DashboardWidgetId } from "./dashboardWidgetIds";

export type DashboardWidgetCopy = {
	title: string;
	description: string;
	emptyCopy: string;
};

export const dashboardWidgetCopy: Record<
	DashboardWidgetId,
	DashboardWidgetCopy
> = {
	quick_capture: {
		title: "Quick capture",
		description: "Capture with photo or voice. Pick a space.",
		emptyCopy:
			"No spaces here yet. Create or join a space, then capture from the dashboard.",
	},
	continue: {
		title: "Pick up in chat",
		description: "Read-only preview of the latest 3 messages.",
		emptyCopy:
			"No recent context yet. Start in Chat or capture from Quick capture when you are ready.",
	},
	spaces: {
		title: "Spaces",
		description:
			"Every space you can open — yours and shared. Tags show the workspace and who owns the space.",
		emptyCopy:
			"No spaces to show yet. Create or join from Chat or Organization.",
	},
	monthly_snapshot: {
		title: "Monthly snapshot",
		description: "A light view of totals and top spaces — no heavy charts.",
		emptyCopy:
			"No spending summary for this period yet. Confirmed transactions will appear here.",
	},
	org_snapshot: {
		title: "Organization snapshot",
		description: "Ops summary: quota, active spaces, pending counts.",
		emptyCopy: "Organization metrics will appear here for business tenants.",
	},
	review_queue: {
		title: "Review queue",
		description:
			"Shared expense threads where your approval is still needed — open to review totals and your share.",
		emptyCopy:
			"You are all caught up — no open expense threads are waiting for your approval.",
	},
	recurring_upcoming: {
		title: "Upcoming recurring",
		description: "Schedules with the next due window.",
		emptyCopy:
			"No upcoming recurring charges in view. Add schedules from Recurring.",
	},
	recent_transactions: {
		title: "Recent transactions",
		description: "Latest confirmed activity — not the full history table.",
		emptyCopy: "No recent transactions. Captures will show here after confirm.",
	},
	spend_overview: {
		title: "Spend overview",
		description: "Simple trend or by-space breakdown (text-first in MVP).",
		emptyCopy: "Spend insights will land here when analytics are connected.",
	},
	recent_activity: {
		title: "Recent activity",
		description: "Operational awareness — audit or derived feed.",
		emptyCopy: "No recent org activity to display.",
	},
	pending_drafts: {
		title: "Pending drafts",
		description: "Optional teaser for drafts in progress.",
		emptyCopy: "No drafts waiting. Create one from Chat or Drafts.",
	},
	ai_teaser: {
		title: "AI insight",
		description: "Short teaser for suggestions (copy-only in early MVP).",
		emptyCopy: "Insights will appear when the assistant has enough context.",
	},
	tenant_people: {
		title: "People in this workspace",
		description:
			"Everyone in the current Ceits workspace — organization members or people on your personal tenant.",
		emptyCopy: "No members loaded for this workspace yet.",
	},
};
