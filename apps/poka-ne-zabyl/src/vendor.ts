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

export const vendorFieldValue = (
	...candidates: Array<string | undefined>
): string => candidates.find((candidate) => candidate !== undefined) ?? "";

export const commonVendorName = (names: string[]): string | null => {
	if (names.length === 0) return "";
	const values = names.map((name) => name.trim());
	const first = values[0];
	const normalized = first.toLocaleLowerCase("ru");
	return values.every((name) => name.toLocaleLowerCase("ru") === normalized)
		? first
		: null;
};
