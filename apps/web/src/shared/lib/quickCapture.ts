import type { components } from "@cofi/api";
import { httpClient } from "./httpClient";

export type CaptureCandidate = components["schemas"]["CaptureCandidate"];
export type CaptureResponse = components["schemas"]["CaptureResponse"];

export type ManualPromoCaptureInput = {
	title?: string;
	promoCode?: string;
	description?: string;
	sourceMerchantName?: string;
	redeemMerchantName?: string;
	redeemPlatform?: string;
	discountType?: string;
	discountValue?: number;
	minimumOrderAmount?: number;
	currency?: string;
	validFrom?: string;
	validUntil?: string;
	conditionsText?: string;
	sourceText?: string;
};

export type ManualRecurringCaptureInput = {
	name?: string;
	serviceName?: string;
	amount?: number;
	interval?: string;
	tagLabel?: string;
	startDate?: string;
	nextDue?: string;
	currency?: string;
	sourceText?: string;
};

export const captureText = async (
	text: string,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureResponse> => {
	const { data } = await httpClient.post<CaptureResponse>("/api/v1/capture", {
		input_kind: "text",
		text,
		space_id:
			options.spaceId === undefined ? undefined : Number(options.spaceId),
		channel: options.channel ?? "web",
	});
	return data ?? {};
};

export const captureManualPromo = async (
	spaceId: string | number,
	promo: ManualPromoCaptureInput,
): Promise<CaptureResponse> => {
	const description = [
		promo.title,
		promo.promoCode,
		promo.redeemPlatform,
		promo.redeemMerchantName,
		promo.sourceMerchantName,
		promo.validUntil,
		promo.conditionsText,
	]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join(" ");
	const { data } = await httpClient.post<CaptureResponse>("/api/v1/capture", {
		input_kind: "manual",
		space_id: Number(spaceId),
		channel: "web",
		description,
		promo: {
			title: promo.title,
			promo_code: promo.promoCode,
			description: promo.description,
			source_merchant_name: promo.sourceMerchantName,
			redeem_merchant_name: promo.redeemMerchantName,
			redeem_platform: promo.redeemPlatform,
			discount_type: promo.discountType,
			discount_value: promo.discountValue,
			minimum_order_amount: promo.minimumOrderAmount,
			currency: promo.currency,
			valid_from: promo.validFrom,
			valid_until: promo.validUntil,
			conditions_text: promo.conditionsText,
			source_text: promo.sourceText,
		},
		source_context: {
			source: "manual_promo_form",
		},
	});
	return data ?? {};
};

export const captureManualRecurring = async (
	spaceId: string | number,
	recurring: ManualRecurringCaptureInput,
): Promise<CaptureResponse> => {
	const description = [
		recurring.serviceName,
		recurring.name,
		recurring.amount == null ? undefined : String(recurring.amount),
		recurring.interval,
		recurring.tagLabel,
		recurring.nextDue,
	]
		.map((value) => value?.trim())
		.filter(Boolean)
		.join(" ");
	const { data } = await httpClient.post<CaptureResponse>("/api/v1/capture", {
		input_kind: "manual",
		space_id: Number(spaceId),
		channel: "web",
		description,
		recurring: {
			name: recurring.name,
			service_name: recurring.serviceName,
			amount: recurring.amount,
			interval: recurring.interval,
			tag_label: recurring.tagLabel,
			start_date: recurring.startDate,
			next_due: recurring.nextDue,
			currency: recurring.currency,
			source_text: recurring.sourceText,
		},
		source_context: {
			source: "manual_recurring_form",
		},
	});
	return data ?? {};
};

export const capturePhoto = async (
	file: File,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureResponse> => {
	const fd = new FormData();
	fd.append("input_kind", "image");
	fd.append("file", file);
	if (options.spaceId !== undefined) {
		fd.append("space_id", String(options.spaceId));
	}
	fd.append("channel", options.channel ?? "web");

	const { data } = await httpClient.post<CaptureResponse>(
		"/api/v1/capture",
		fd,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data ?? {};
};

export const captureVoice = async (
	blob: Blob,
	mime: string,
	options: { spaceId?: string | number; channel?: string } = {},
): Promise<CaptureResponse> => {
	const fd = new FormData();
	fd.append("input_kind", "voice");
	fd.append(
		"file",
		new File([blob], "voice.webm", { type: mime || "audio/webm" }),
	);
	if (options.spaceId !== undefined) {
		fd.append("space_id", String(options.spaceId));
	}
	fd.append("channel", options.channel ?? "web");

	const { data } = await httpClient.post<CaptureResponse>(
		"/api/v1/capture",
		fd,
		{ headers: { "Content-Type": "multipart/form-data" } },
	);
	return data ?? {};
};
