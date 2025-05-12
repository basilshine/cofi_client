export interface PromoFeature {
	id: string;
	title: string;
	description: string;
	icon: string;
}

export interface PromoData {
	title: string;
	description: string;
	features: PromoFeature[];
}

export const promoService = {
	getPromoData: async () => {
		const response = await import("axios")
			.then((m) => m.default)
			.then((axios) => axios.get("/promo"));
		return response.data as PromoData;
	},
};
