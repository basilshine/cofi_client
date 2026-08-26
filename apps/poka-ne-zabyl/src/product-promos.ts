export const productPromoIDs = [
	"aiCapture",
	"splitExpense",
	"inviteSpace",
	"receiptArchive",
	"settlementProof",
	"createSpace",
	"customCategories",
	"plus",
] as const;

export type ProductPromoID = (typeof productPromoIDs)[number];

export type ProductPromoSignals = {
	hasExpenses: boolean;
	hasSmartCapture: boolean;
	canSplitExpense: boolean;
	hasSplitExpense: boolean;
	canInviteToSpace: boolean;
	hasInvitedParticipant: boolean;
	canCreateSpace: boolean;
	hasExtraSpace: boolean;
	hasCustomCategory: boolean;
	hasPlus: boolean;
};

type ProductPromoCampaignState = {
	impressions: number;
	lastShownAt?: string;
	snoozedUntil?: string;
	actedAt?: string;
};

export type ProductPromoState = {
	version: 1;
	lastShownAt?: string;
	campaigns: Partial<Record<ProductPromoID, ProductPromoCampaignState>>;
};

export const emptyProductPromoState = (): ProductPromoState => ({
	version: 1,
	campaigns: {},
});

const globalCooldownMs = 2 * 24 * 60 * 60 * 1000;

const campaignCooldownMs: Record<ProductPromoID, number> = {
	aiCapture: 2 * 24 * 60 * 60 * 1000,
	splitExpense: 3 * 24 * 60 * 60 * 1000,
	inviteSpace: 2 * 24 * 60 * 60 * 1000,
	receiptArchive: 14 * 24 * 60 * 60 * 1000,
	settlementProof: 7 * 24 * 60 * 60 * 1000,
	createSpace: 5 * 24 * 60 * 60 * 1000,
	customCategories: 7 * 24 * 60 * 60 * 1000,
	plus: 10 * 24 * 60 * 60 * 1000,
};

const validDate = (value: unknown) =>
	typeof value === "string" && Number.isFinite(Date.parse(value))
		? value
		: undefined;

export const parseProductPromoState = (
	value: string | null,
): ProductPromoState => {
	if (!value) return emptyProductPromoState();
	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== "object") return emptyProductPromoState();
		const source = parsed as {
			lastShownAt?: unknown;
			campaigns?: Record<string, unknown>;
		};
		const campaigns: ProductPromoState["campaigns"] = {};
		for (const id of productPromoIDs) {
			const raw = source.campaigns?.[id];
			if (!raw || typeof raw !== "object") continue;
			const campaign = raw as Record<string, unknown>;
			campaigns[id] = {
				impressions:
					typeof campaign.impressions === "number" &&
					Number.isFinite(campaign.impressions)
						? Math.max(0, Math.floor(campaign.impressions))
						: 0,
				lastShownAt: validDate(campaign.lastShownAt),
				snoozedUntil: validDate(campaign.snoozedUntil),
				actedAt: validDate(campaign.actedAt),
			};
		}
		return {
			version: 1,
			...(validDate(source.lastShownAt)
				? { lastShownAt: validDate(source.lastShownAt) }
				: {}),
			campaigns,
		};
	} catch {
		return emptyProductPromoState();
	}
};

const eligibleProductPromos = (
	signals: ProductPromoSignals,
): ProductPromoID[] => [
	...(!signals.hasSmartCapture && signals.hasExpenses
		? ["aiCapture" as const]
		: []),
	...(signals.canSplitExpense && !signals.hasSplitExpense
		? ["splitExpense" as const]
		: []),
	...(signals.canInviteToSpace && !signals.hasInvitedParticipant
		? ["inviteSpace" as const]
		: []),
	...(signals.hasSmartCapture && signals.hasExpenses
		? ["receiptArchive" as const]
		: []),
	...(signals.hasSplitExpense ? ["settlementProof" as const] : []),
	...(signals.canCreateSpace && !signals.hasExtraSpace
		? ["createSpace" as const]
		: []),
	...(!signals.hasCustomCategory ? ["customCategories" as const] : []),
	...(!signals.hasPlus ? ["plus" as const] : []),
];

export const nextProductPromo = (
	signals: ProductPromoSignals,
	state: ProductPromoState,
	now = new Date(),
): ProductPromoID | null => {
	const nowMs = now.getTime();
	if (
		state.lastShownAt &&
		nowMs - Date.parse(state.lastShownAt) < globalCooldownMs
	)
		return null;
	const eligible = eligibleProductPromos(signals).filter((id) => {
		const campaign = state.campaigns[id];
		if (campaign?.snoozedUntil && Date.parse(campaign.snoozedUntil) > nowMs)
			return false;
		return !(
			campaign?.lastShownAt &&
			nowMs - Date.parse(campaign.lastShownAt) < campaignCooldownMs[id]
		);
	});
	return (
		eligible.sort((left, right) => {
			const leftShown = state.campaigns[left]?.lastShownAt;
			const rightShown = state.campaigns[right]?.lastShownAt;
			if (!leftShown && rightShown) return -1;
			if (leftShown && !rightShown) return 1;
			return (
				Date.parse(leftShown || "1970-01-01") -
				Date.parse(rightShown || "1970-01-01")
			);
		})[0] || null
	);
};

export const recordProductPromoImpression = (
	state: ProductPromoState,
	id: ProductPromoID,
	now = new Date(),
): ProductPromoState => {
	const shownAt = now.toISOString();
	const campaign = state.campaigns[id];
	return {
		...state,
		lastShownAt: shownAt,
		campaigns: {
			...state.campaigns,
			[id]: {
				...campaign,
				impressions: (campaign?.impressions || 0) + 1,
				lastShownAt: shownAt,
			},
		},
	};
};

export const snoozeProductPromo = (
	state: ProductPromoState,
	id: ProductPromoID,
	days: number,
	acted: boolean,
	now = new Date(),
): ProductPromoState => ({
	...state,
	campaigns: {
		...state.campaigns,
		[id]: {
			...state.campaigns[id],
			impressions: state.campaigns[id]?.impressions || 0,
			snoozedUntil: new Date(
				now.getTime() + days * 24 * 60 * 60 * 1000,
			).toISOString(),
			...(acted ? { actedAt: now.toISOString() } : {}),
		},
	},
});
