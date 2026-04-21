import { useEffect } from "react";
import {
	LANDING_PAGES,
	MARKETING_BASE_URL,
	type LandingPageConfig,
} from "./landingPages";

type SeoMeta = {
	title: string;
	description: string;
	canonical: string;
};

const ensureMetaTag = (
	selector: string,
	create: () => HTMLMetaElement | HTMLLinkElement,
) => {
	const existing = document.head.querySelector(selector);
	if (existing) {
		return existing;
	}
	const element = create();
	document.head.appendChild(element);
	return element;
};

const seoFor = (page: LandingPageConfig): SeoMeta => ({
	title: page.title,
	description: page.description,
	canonical: `${MARKETING_BASE_URL}${page.slug}`,
});

const pageLinks = (slug: string) =>
	LANDING_PAGES[slug]?.related.map((item) => `${MARKETING_BASE_URL}${item}`) ?? [];

const jsonLdFor = (page: LandingPageConfig) => {
	const breadcrumbItems = [
		{ name: "Home", item: MARKETING_BASE_URL, position: 1 },
		...(page.slug === "/"
			? []
			: [{ name: page.h1, item: `${MARKETING_BASE_URL}${page.slug}`, position: 2 }]),
	];

	return {
		software: {
			"@context": "https://schema.org",
			"@type": "SoftwareApplication",
			name: "Ceits",
			applicationCategory: "FinanceApplication",
			operatingSystem: "Web",
			url: `${MARKETING_BASE_URL}${page.slug}`,
			description: page.description,
		},
		breadcrumb: {
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			itemListElement: breadcrumbItems.map((item) => ({
				"@type": "ListItem",
				position: item.position,
				name: item.name,
				item: item.item,
			})),
		},
		faq:
			page.faq.length > 0
				? {
						"@context": "https://schema.org",
						"@type": "FAQPage",
						mainEntity: page.faq.map((item) => ({
							"@type": "Question",
							name: item.question,
							acceptedAnswer: { "@type": "Answer", text: item.answer },
						})),
					}
				: null,
	};
};

export const useSeoHead = (page: LandingPageConfig) => {
	useEffect(() => {
		const seo = seoFor(page);
		document.title = seo.title;

		const descriptionTag = ensureMetaTag('meta[name="description"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("name", "description");
			return meta;
		}) as HTMLMetaElement;
		descriptionTag.content = seo.description;

		const canonicalTag = ensureMetaTag('link[rel="canonical"]', () => {
			const link = document.createElement("link");
			link.setAttribute("rel", "canonical");
			return link;
		}) as HTMLLinkElement;
		canonicalTag.href = seo.canonical;

		const ogTitleTag = ensureMetaTag('meta[property="og:title"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("property", "og:title");
			return meta;
		}) as HTMLMetaElement;
		ogTitleTag.content = seo.title;

		const ogDescriptionTag = ensureMetaTag('meta[property="og:description"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("property", "og:description");
			return meta;
		}) as HTMLMetaElement;
		ogDescriptionTag.content = seo.description;

		const ogTypeTag = ensureMetaTag('meta[property="og:type"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("property", "og:type");
			return meta;
		}) as HTMLMetaElement;
		ogTypeTag.content = "website";

		const ogUrlTag = ensureMetaTag('meta[property="og:url"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("property", "og:url");
			return meta;
		}) as HTMLMetaElement;
		ogUrlTag.content = seo.canonical;

		const twitterCardTag = ensureMetaTag('meta[name="twitter:card"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("name", "twitter:card");
			return meta;
		}) as HTMLMetaElement;
		twitterCardTag.content = "summary_large_image";

		const twitterTitleTag = ensureMetaTag('meta[name="twitter:title"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("name", "twitter:title");
			return meta;
		}) as HTMLMetaElement;
		twitterTitleTag.content = seo.title;

		const twitterDescriptionTag = ensureMetaTag('meta[name="twitter:description"]', () => {
			const meta = document.createElement("meta");
			meta.setAttribute("name", "twitter:description");
			return meta;
		}) as HTMLMetaElement;
		twitterDescriptionTag.content = seo.description;

		const jsonLd = jsonLdFor(page);
		const schemaId = "ceits-page-schema";
		const relatedId = "ceits-related-links";
		const currentSchema = document.getElementById(schemaId);
		currentSchema?.remove();
		const nextSchema = document.createElement("script");
		nextSchema.id = schemaId;
		nextSchema.type = "application/ld+json";
		nextSchema.textContent = JSON.stringify(
			[jsonLd.software, jsonLd.breadcrumb, ...(jsonLd.faq ? [jsonLd.faq] : [])],
			null,
			2,
		);
		document.head.appendChild(nextSchema);

		const currentRelated = document.getElementById(relatedId);
		currentRelated?.remove();
		const relatedScript = document.createElement("script");
		relatedScript.id = relatedId;
		relatedScript.type = "application/json";
		relatedScript.setAttribute("data-related-links", "true");
		relatedScript.textContent = JSON.stringify(pageLinks(page.slug));
		document.head.appendChild(relatedScript);
	}, [page]);
};
