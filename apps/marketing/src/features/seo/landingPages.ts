export type FaqItem = {
	question: string;
	answer: string;
};

export type LandingPageConfig = {
	slug: string;
	title: string;
	description: string;
	h1: string;
	eyebrow: string;
	intro: string;
	problemTitle: string;
	problemBody: string;
	whyTitle: string;
	whyBody: string;
	strengths: string[];
	scenarios: string[];
	comparison: {
		plain: string;
		ceits: string;
	};
	faq: FaqItem[];
	related: string[];
};

export const MARKETING_BASE_URL = "https://ceits.com";

export const LANDING_PAGES: Record<string, LandingPageConfig> = {
	"/": {
		slug: "/",
		title: "Ceits for Couples and Families | Shared Money, Calmly Managed",
		description:
			"Ceits helps couples and families capture expenses, manage recurring bills, and stay aligned with shared spaces, split logic, and context-first history.",
		h1: "A calmer way for couples and families to manage shared spending",
		eyebrow: "Shared money, without the noise",
		intro:
			"Ceits is a chat-first, space-first home for shared money context. Capture expenses naturally, keep recurring payments visible, and stay aligned without spreadsheet stress.",
		problemTitle: "Shared money breaks down when context gets lost",
		problemBody:
			"Bills live in one app, receipts in chat, and decisions in memory. Ceits keeps the full trail in one shared space so the two of you (or your whole household) can act from the same picture.",
		whyTitle: "Why Ceits",
		whyBody:
			"Ceits is one product for real life: daily groceries, school costs, subscription renewals, and monthly bills. It feels calm because everything stays attached to context.",
		strengths: [
			"Shared spaces for home, trips, or any life context",
			"Natural capture via text, voice, or receipt",
			"Recurring bill tracking and reminders",
			"Flexible split logic with transparent shared activity",
		],
		scenarios: [
			"Two partners tracking groceries, rent, and subscriptions in one thread.",
			"Family household space for recurring utilities and school expenses.",
			"Trip spending space that keeps everyone aligned while traveling.",
		],
		comparison: {
			plain: "Plain trackers list transactions but often lose the story behind each expense.",
			ceits: "Ceits keeps the story and the numbers together so shared decisions are easier and faster.",
		},
		faq: [
			{
				question: "Is Ceits only for couples?",
				answer:
					"No. Couples are a strong starting use case, but Ceits also works well for families and shared household contexts.",
			},
			{
				question: "Can we track recurring bills?",
				answer:
					"Yes. Recurring payments are first-class, so monthly obligations stay visible and predictable.",
			},
		],
		related: ["/for-couples", "/for-families", "/shared-expense-tracker"],
	},
	"/for-couples": {
		slug: "/for-couples",
		title: "Ceits for Couples | Manage Money Together Without Friction",
		description:
			"Coordinate shared spending as a couple. Track groceries, bills, subscriptions, and split decisions with calm shared visibility in Ceits.",
		h1: "Shared money coordination for couples",
		eyebrow: "For couples",
		intro:
			"Ceits helps couples stay aligned on money without constant check-ins. Keep shared costs, recurring bills, and split decisions in one calm place.",
		problemTitle: "Money talks should not require detective work",
		problemBody:
			"When shared expenses are scattered, small misunderstandings stack up. Ceits gives both partners one reliable timeline of what happened and what is next.",
		whyTitle: "Built for real couple workflows",
		whyBody:
			"Track everyday spending and bigger plans in shared spaces, with enough detail to reduce stress but no dashboard overload.",
		strengths: [
			"One shared activity view for both partners",
			"Recurring subscriptions and bills never disappear",
			"Simple split logic for fair contribution",
			"Natural capture in the moment, not at month-end",
		],
		scenarios: [
			"Split grocery runs and keep a rolling monthly category view.",
			"Track rent, utilities, and streaming renewals together.",
			"Prepare for travel or events with a dedicated shared spending space.",
		],
		comparison: {
			plain: "Basic apps split a bill but rarely help with the ongoing shared picture.",
			ceits: "Ceits handles splitting plus recurring history and context for better week-to-week alignment.",
		},
		faq: [
			{
				question: "Does Ceits replace our banking app?",
				answer:
					"No. Ceits complements banking by organizing shared context and decision history around your spending.",
			},
		],
		related: ["/", "/couples-budget-app", "/split-bills-with-partner"],
	},
	"/for-families": {
		slug: "/for-families",
		title: "Ceits for Families | Family Spending and Bills in One Place",
		description:
			"Ceits helps families stay clear on household spending, recurring bills, and shared budget context with less noise and better visibility.",
		h1: "Family spending clarity in one shared place",
		eyebrow: "For families",
		intro:
			"From utility bills to school costs, Ceits gives families one place to capture and coordinate household money context without chaos.",
		problemTitle: "Household spending becomes messy fast",
		problemBody:
			"Family costs come from many directions and are easy to lose between messages and receipts. Ceits keeps the household thread clear and actionable.",
		whyTitle: "Family-first structure",
		whyBody:
			"Use shared spaces for your household, recurring obligations, and special situations so everyone sees what matters.",
		strengths: [
			"Recurring household bills tracked in one view",
			"Shared history for major and minor family expenses",
			"Split logic when costs are shared unevenly",
			"Easy capture from real life moments",
		],
		scenarios: [
			"Track monthly household utilities alongside grocery spending.",
			"Keep school fees, activities, and one-off costs visible.",
			"Maintain one place for the family budget conversation.",
		],
		comparison: {
			plain: "Generic trackers can show totals but often miss family context.",
			ceits: "Ceits keeps each expense attached to where and why it happened, not just an amount.",
		},
		faq: [
			{
				question: "Can families use multiple shared spaces?",
				answer:
					"Yes. You can organize by household, events, or any real-life context that helps your family stay clear.",
			},
		],
		related: ["/", "/family-budget-app", "/shared-expense-tracker"],
	},
	"/shared-expense-tracker": {
		slug: "/shared-expense-tracker",
		title: "Shared Expense Tracker | Ceits Keeps Context, Not Just Numbers",
		description:
			"Looking for a shared expense tracker? Ceits goes further with shared spaces, recurring tracking, split logic, and context-rich activity.",
		h1: "A shared expense tracker with context built in",
		eyebrow: "Shared expense tracker",
		intro:
			"Ceits covers the basics of shared expense tracking and adds what most trackers miss: context, recurring visibility, and calmer coordination.",
		problemTitle: "Tracking is easy. Staying aligned is harder.",
		problemBody:
			"People do not only need a ledger. They need shared memory and decision clarity. Ceits keeps capture, splits, and history connected.",
		whyTitle: "Why it feels better than plain tracking",
		whyBody:
			"Ceits is designed for real conversations around spending, not only transaction rows.",
		strengths: [
			"Shared spaces by relationship or life context",
			"Split logic that stays transparent over time",
			"Recurring payment awareness",
			"Natural capture while spending happens",
		],
		scenarios: [
			"Roommates and partners sharing groceries and home costs.",
			"Families tracking recurring household obligations.",
			"Travel groups coordinating spend in one feed.",
		],
		comparison: {
			plain: "Most tools stop at logging and splitting.",
			ceits: "Ceits helps you understand shared spending patterns and make decisions with less friction.",
		},
		faq: [],
		related: ["/for-couples", "/for-families", "/split-bills-with-partner"],
	},
	"/couples-budget-app": {
		slug: "/couples-budget-app",
		title: "Best Budget App for Couples | Ceits Shared Money Clarity",
		description:
			"Ceits is a couples budget app focused on shared visibility, recurring expenses, split logic, and calm weekly alignment.",
		h1: "A couples budget app built for shared life",
		eyebrow: "Couples budget app",
		intro:
			"Ceits helps couples manage money together with a shared view of daily spend, recurring bills, and split outcomes.",
		problemTitle: "Couple budgeting fails when only one person has context",
		problemBody:
			"When one partner carries the tracking load, alignment drops. Ceits gives both people the same clear picture.",
		whyTitle: "What makes Ceits different",
		whyBody:
			"It is not just a budget sheet. It is an ongoing shared activity layer for couple decisions.",
		strengths: [
			"Couple-friendly shared activity timeline",
			"Recurring and one-off spend in one flow",
			"Clear split decisions with history",
			"Capture-first experience that fits daily life",
		],
		scenarios: [
			"Monthly review of shared subscriptions and utilities.",
			"Weekly grocery and delivery spending sync.",
			"Joint planning for savings-sensitive months.",
		],
		comparison: {
			plain: "Traditional budget apps are often solo-first.",
			ceits: "Ceits is shared-first, so both partners can participate with less friction.",
		},
		faq: [],
		related: ["/for-couples", "/split-bills-with-partner", "/"],
	},
	"/family-budget-app": {
		slug: "/family-budget-app",
		title: "Family Budget App | Ceits for Household Money Coordination",
		description:
			"Ceits is a family budget app for recurring household bills, shared spending visibility, and context-rich planning.",
		h1: "A family budget app for real household coordination",
		eyebrow: "Family budget app",
		intro:
			"Ceits helps families keep recurring costs, household expenses, and planning decisions together in one calm experience.",
		problemTitle: "Household budgeting needs shared continuity",
		problemBody:
			"Family budgets drift when updates are fragmented. Ceits provides one ongoing shared thread for household money context.",
		whyTitle: "Designed for family reality",
		whyBody:
			"Recurring bills, changing priorities, and daily purchases all stay visible without creating admin fatigue.",
		strengths: [
			"Recurring household spending visibility",
			"Shared family timeline across categories",
			"Context preserved for each spending decision",
			"Simple transitions from capture to action",
		],
		scenarios: [
			"Monthly utilities, rent, and internet overview.",
			"Tracking school and activity-related costs.",
			"Managing seasonal household spikes together.",
		],
		comparison: {
			plain: "Simple budget apps can hide the why behind each cost.",
			ceits: "Ceits keeps household context attached to each expense so planning is clearer.",
		},
		faq: [],
		related: ["/for-families", "/shared-expense-tracker", "/"],
	},
	"/split-bills-with-partner": {
		slug: "/split-bills-with-partner",
		title: "Split Bills With Partner | Ceits for Ongoing Shared Clarity",
		description:
			"Split bills with your partner using Ceits, then keep full shared context for recurring costs, activity history, and future decisions.",
		h1: "Split bills with your partner, and keep context",
		eyebrow: "Split bills with partner",
		intro:
			"Ceits makes partner bill splitting simple, while also preserving the shared history and recurring patterns that matter over time.",
		problemTitle: "Bill splitting alone does not solve shared money stress",
		problemBody:
			"Most tools answer who owes what right now. Ceits also answers what keeps repeating, what changed, and what should happen next.",
		whyTitle: "Beyond one-off split calculators",
		whyBody:
			"Ceits combines split logic with shared spaces, recurring awareness, and complete activity context.",
		strengths: [
			"Fair split logic with clear records",
			"Recurring bills stay visible month after month",
			"Shared activity so both partners stay aligned",
			"Natural capture from receipts, notes, and voice",
		],
		scenarios: [
			"Split rent and utilities while tracking monthly trend shifts.",
			"Handle groceries and subscriptions with less back-and-forth.",
			"Review shared decisions together before month-end.",
		],
		comparison: {
			plain: "Split tools are good at math, weak at ongoing coordination.",
			ceits: "Ceits keeps math plus memory, so the relationship side of money gets easier too.",
		},
		faq: [],
		related: ["/for-couples", "/couples-budget-app", "/shared-expense-tracker"],
	},
};

export const LANDING_PAGE_ROUTES = Object.keys(LANDING_PAGES);
