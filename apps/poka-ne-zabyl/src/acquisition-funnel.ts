export const ACQUISITION_FUNNELS = [
	"general",
	"family",
	"repair",
	"crew",
	"events",
] as const;

export type AcquisitionFunnel = (typeof ACQUISITION_FUNNELS)[number];

const ACQUISITION_FUNNEL_KEY = "pnz:acquisition-funnel";

const isAcquisitionFunnel = (
	value: string | null,
): value is AcquisitionFunnel =>
	ACQUISITION_FUNNELS.some((funnel) => funnel === value);

export const acquisitionFunnelFromPath = (path: string): AcquisitionFunnel => {
	const segment = path.replace(/^\/+|\/+$/g, "");
	return isAcquisitionFunnel(segment) ? segment : "general";
};

export const landingQueryWithFunnel = (
	query: string,
	funnel: AcquisitionFunnel,
) => {
	const params = new URLSearchParams(query);
	params.set("funnel", funnel);
	const suffix = params.toString();
	return suffix ? `?${suffix}` : "";
};

type FunnelStorage = Pick<Storage, "getItem" | "setItem">;

export const rememberAcquisitionFunnel = (
	search: string,
	storage: FunnelStorage,
): AcquisitionFunnel => {
	const saved = storage.getItem(ACQUISITION_FUNNEL_KEY);
	if (isAcquisitionFunnel(saved)) return saved;

	const incoming = new URLSearchParams(search).get("funnel");
	if (isAcquisitionFunnel(incoming)) {
		storage.setItem(ACQUISITION_FUNNEL_KEY, incoming);
		return incoming;
	}
	return "general";
};
