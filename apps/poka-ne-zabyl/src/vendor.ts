export type VendorOption = {
	id: number;
	name: string;
	aliases?: Array<{ alias: string }>;
};

export const findVendorByName = <T extends VendorOption>(
	vendors: T[],
	name: string,
) => {
	const normalized = name.trim().toLocaleLowerCase("ru");
	return vendors.find(
		(vendor) =>
			vendor.name.trim().toLocaleLowerCase("ru") === normalized ||
			vendor.aliases?.some(
				(alias) => alias.alias.trim().toLocaleLowerCase("ru") === normalized,
			),
	);
};

export const vendorSuggestions = <T extends VendorOption>(
	vendors: T[],
	query: string,
	limit = 6,
) => {
	const normalized = query.trim().toLocaleLowerCase("ru");
	return vendors
		.filter(
			(vendor) =>
				!normalized ||
				vendor.name.toLocaleLowerCase("ru").includes(normalized) ||
				vendor.aliases?.some((alias) =>
					alias.alias.toLocaleLowerCase("ru").includes(normalized),
				),
		)
		.slice(0, limit);
};

export const vendorFieldValue = (
	...candidates: Array<string | undefined>
): string => candidates.find((candidate) => candidate !== undefined) ?? "";

export const commonVendorName = (names: string[]): string | null => {
	if (names.length === 0) return "";
	const first = names[0];
	const normalized = first.trim().toLocaleLowerCase("ru");
	return names.every(
		(name) => name.trim().toLocaleLowerCase("ru") === normalized,
	)
		? first
		: null;
};
