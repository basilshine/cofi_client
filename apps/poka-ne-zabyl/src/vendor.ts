export type VendorOption = { id: number; name: string };

export const findVendorByName = <T extends VendorOption>(
	vendors: T[],
	name: string,
) => {
	const normalized = name.trim().toLocaleLowerCase("ru");
	return vendors.find(
		(vendor) => vendor.name.trim().toLocaleLowerCase("ru") === normalized,
	);
};
