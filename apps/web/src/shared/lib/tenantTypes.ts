/** Tenants with `type === "personal"` are the user's private workspace; all others are org/business scope. */
export const isNonPersonalTenantType = (type: string | undefined): boolean =>
	String(type ?? "")
		.trim()
		.toLowerCase() !== "personal";
