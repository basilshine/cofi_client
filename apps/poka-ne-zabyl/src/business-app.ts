export const BUSINESS_APP_HOST = "business.poka-ne-zabyl.ru";
export const PERSONAL_APP_HOST = "poka-ne-zabyl.ru";

const localHosts = new Set(["localhost", "127.0.0.1"]);
type ExperienceSpace = {
	tenant_type?: string;
	settings?: { experience?: string };
};

export const isBusinessSpace = (space: ExperienceSpace) =>
	space.tenant_type === "organization";

export const spacesForAppExperience = <T extends ExperienceSpace>(
	spaces: T[],
	business: boolean,
) => spaces.filter((space) => isBusinessSpace(space) === business);

export const isBusinessAppLocation = (hostname: string, search = "") =>
	hostname.toLowerCase() === BUSINESS_APP_HOST ||
	(localHosts.has(hostname.toLowerCase()) &&
		new URLSearchParams(search).get("business") === "1");

export const businessAppHref = (query: string, hostname = "") => {
	const params = new URLSearchParams(query);
	params.set("funnel", "business");
	const suffix = params.toString();
	if (localHosts.has(hostname.toLowerCase())) {
		params.set("business", "1");
		return `/app?${params.toString()}`;
	}
	return `https://${BUSINESS_APP_HOST}/${suffix ? `?${suffix}` : ""}`;
};

export const personalAppHref = (query: string, hostname = "") => {
	const suffix = new URLSearchParams(query).toString();
	if (localHosts.has(hostname.toLowerCase())) {
		return `/app${suffix ? `?${suffix}` : ""}`;
	}
	return `https://${PERSONAL_APP_HOST}/app${suffix ? `?${suffix}` : ""}`;
};
