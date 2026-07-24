import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(appDir, "dist");
const serverDir = join(appDir, "dist-server");
const serverFile = (await readdir(serverDir)).find((file) =>
	file.startsWith("entry-server"),
);

assert(serverFile, "SSR entry was not built");

const { ACQUISITION_FAQ, GENERAL_FAQ, PUBLIC_PAGE_SEO, render } = await import(
	pathToFileURL(join(serverDir, serverFile)).href
);
const template = await readFile(join(distDir, "index.html"), "utf8");
const origin = "https://poka-ne-zabyl.ru";
const metrikaCounterId = 110761833;

const metrikaScript = `<script type="text/javascript">
	(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
	m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
	k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
	(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
	ym(${metrikaCounterId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});
</script>`;

const metrikaNoScript = `<noscript><div><img src="https://mc.yandex.ru/watch/${metrikaCounterId}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>`;

const attributeEscapes = {
	"&": "&amp;",
	'"': "&quot;",
	"<": "&lt;",
	">": "&gt;",
};
const escapeAttribute = (value) =>
	value.replace(/[&"<>]/g, (character) => attributeEscapes[character]);

const withoutDefaultSeo = (html) =>
	html
		.replace(/\s*<meta\s+name="description"[\s\S]*?\/>/i, "")
		.replace(/\s*<link\s+rel="canonical"[\s\S]*?\/>/i, "")
		.replace(/\s*<title>[\s\S]*?<\/title>/i, "");

const landingAlternates = `
		<link rel="alternate" hreflang="ru" href="${origin}/" />
		<link rel="alternate" hreflang="en" href="${origin}/en/" />
		<link rel="alternate" hreflang="es" href="${origin}/es/" />
		<link rel="alternate" hreflang="x-default" href="${origin}/" />`;

const localizedFaq = {
	en: [
		[
			"What is a PWA, and do I need to download anything?",
			"A PWA is an installable web app. Open it from a link and add it to your home screen. It runs in its own window and does not require the App Store or Google Play.",
		],
		[
			"Does the bot save everything without review?",
			"No. It prepares the expense, and you confirm or edit the result.",
		],
		[
			"What remains available without Plus?",
			"Expense history, manual entry, editing, and access to your data remain available. Limits apply to new smart entries and to creating new categories, limits, plans, and spaces.",
		],
		[
			"Do purchased packs disappear when Plus ends?",
			"No. Your purchased balance is stored separately and remains available after the subscription ends.",
		],
		[
			"Can I use it just for myself?",
			"Yes. Shared spaces and expense splitting are there only when you need them.",
		],
		[
			"Where are data and receipts stored?",
			"Core data and source files for the Russian service are hosted on infrastructure in Russia.",
		],
	],
	es: [
		[
			"¿Qué es una PWA y tengo que descargar algo?",
			"Una PWA es una aplicación web instalable. Ábrela desde un enlace y añádela a la pantalla de inicio. Funciona en su propia ventana y no necesita App Store ni Google Play.",
		],
		[
			"¿El bot guarda todo sin que lo revise?",
			"No. Prepara el gasto y tú confirmas o corriges el resultado.",
		],
		[
			"¿Qué seguirá disponible sin Plus?",
			"El historial, la entrada manual, la edición y el acceso a tus datos siguen disponibles. Los límites se aplican a nuevos registros inteligentes y a la creación de categorías, límites, planes y espacios.",
		],
		[
			"¿Desaparecen los paquetes comprados cuando termina Plus?",
			"No. El saldo comprado se guarda por separado y sigue disponible cuando termina la suscripción.",
		],
		[
			"¿Puedo usarlo solo para mí?",
			"Sí. Los espacios compartidos y la división de gastos están ahí solo cuando los necesitas.",
		],
		[
			"¿Dónde se guardan los datos y recibos?",
			"Los datos principales y los archivos originales del servicio ruso se alojan en infraestructura situada en Rusia.",
		],
	],
};

const localizedStructuredData = ({ path, description, language }) => {
	if (language === "ru") return "";
	const faq = localizedFaq[language];
	return `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "SoftwareApplication",
				"@id": `${origin}${path}#application`,
				name: "Пока не забыл",
				url: `${origin}${path}`,
				installUrl: `${origin}/app`,
				description,
				applicationCategory: "FinanceApplication",
				operatingSystem: "Web, Android, iOS, Telegram",
				inLanguage: language,
				offers: [
					{
						"@type": "Offer",
						name: language === "es" ? "Básico" : "Basic",
						price: "0",
						priceCurrency: "RUB",
					},
					{
						"@type": "Offer",
						name: "Plus",
						price: "9.99",
						priceCurrency: "USD",
					},
				],
			},
			{
				"@type": "FAQPage",
				"@id": `${origin}${path}#faq`,
				mainEntity: faq.map(([name, text]) => ({
					"@type": "Question",
					name,
					acceptedAnswer: { "@type": "Answer", text },
				})),
			},
		],
	}).replaceAll("<", "\\u003c")}</script>`;
};

const acquisitionPaths = new Set(["/family", "/repair", "/crew", "/events"]);

const acquisitionStructuredData = ({ path, description, language }) => {
	if (!acquisitionPaths.has(path)) return "";
	const faq = ACQUISITION_FAQ[path.slice(1)];
	return `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "SoftwareApplication",
				"@id": `${origin}/#application`,
				name: "Пока не забыл",
				url: `${origin}/app`,
				installUrl: `${origin}/app`,
				description,
				applicationCategory: "FinanceApplication",
				operatingSystem: "Web, Android, iOS, Telegram",
				inLanguage: language,
				offers: [
					{
						"@type": "Offer",
						name: "Базовый",
						price: "0",
						priceCurrency: "RUB",
					},
					{
						"@type": "Offer",
						name: "Плюс",
						price: "249",
						priceCurrency: "RUB",
					},
				],
				provider: { "@id": `${origin}/#organization` },
			},
			{
				"@type": "FAQPage",
				"@id": `${origin}${path}#faq`,
				mainEntity: faq.map(([name, text]) => ({
					"@type": "Question",
					name,
					acceptedAnswer: { "@type": "Answer", text },
				})),
			},
		],
	}).replaceAll("<", "\\u003c")}</script>`;
};

const pageHead = ({ path, title, description, language }) => {
	const canonical = `${origin}${path}`;
	const structuredData =
		localizedStructuredData({
			path,
			description,
			language,
		}) ||
		acquisitionStructuredData({
			path,
			description,
			language,
		}) ||
		(path === "/"
			? `<script type="application/ld+json">${JSON.stringify({
					"@context": "https://schema.org",
					"@graph": [
						{
							"@type": "Organization",
							"@id": `${origin}/#organization`,
							name: "Пока не забыл",
							url: `${origin}/`,
							logo: `${origin}/assets/poka-ne-zabyl-app-icon-512.png`,
							sameAs: ["https://t.me/poka_ne_zabyl_bot"],
						},
						{
							"@type": "SoftwareApplication",
							"@id": `${origin}/#application`,
							name: "Пока не забыл",
							url: `${origin}/app`,
							installUrl: `${origin}/app`,
							description,
							applicationCategory: "FinanceApplication",
							operatingSystem: "Web, Android, iOS, Telegram",
							inLanguage: "ru-RU",
							featureList: [
								"Учёт расходов текстом и голосом",
								"Распознавание фотографий чеков",
								"Проверка распознанных расходов",
								"Поиск по покупкам, магазинам, категориям и тегам",
								"Лимиты расходов по категориям",
								"Плановые покупки с суммой, категорией и датой",
								"Личные и общие пространства",
								"Разделение общих расходов между участниками",
								"Расчёт, кто кому должен",
								"Уведомления из всех пространств",
								"Тарифы Базовый и Плюс",
								"Дополнительные пакеты разборов",
							],
							offers: [
								{
									"@type": "Offer",
									name: "Базовый",
									price: "0",
									priceCurrency: "RUB",
									description:
										"Бесплатный тариф с 20 приветственными разборами и ручным учётом без ограничения по времени.",
								},
								{
									"@type": "Offer",
									name: "Плюс",
									price: "249",
									priceCurrency: "RUB",
									description:
										"Тариф на 30 дней с 400 разборами, расширенными лимитами и скидкой на пакеты.",
								},
							],
							provider: { "@id": `${origin}/#organization` },
						},
						{
							"@type": "FAQPage",
							"@id": `${origin}/#faq`,
							mainEntity: GENERAL_FAQ.map(([name, text]) => ({
								"@type": "Question",
								name,
								acceptedAnswer: { "@type": "Answer", text },
							})),
						},
					],
				}).replaceAll("<", "\\u003c")}</script>`
			: "");

	return `
		<title>${escapeAttribute(title)}</title>
		<meta name="description" content="${escapeAttribute(description)}" />
		<link rel="canonical" href="${canonical}" />
		${["/", "/en/", "/es/"].includes(path) ? landingAlternates : ""}
		<meta property="og:type" content="website" />
		<meta property="og:locale" content="${language === "es" ? "es_ES" : language === "en" ? "en_US" : "ru_RU"}" />
		<meta property="og:site_name" content="Пока не забыл" />
		<meta property="og:title" content="${escapeAttribute(title)}" />
		<meta property="og:description" content="${escapeAttribute(description)}" />
		<meta property="og:url" content="${canonical}" />
		<meta property="og:image" content="${origin}/assets/poka-ne-zabyl-og.png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:alt" content="${language === "es" ? "Пока не забыл: aplicación de control de gastos con Telegram" : language === "en" ? "Пока не забыл: expense tracking app with Telegram" : "Пока не забыл — учёт расходов в приложении и Telegram"}" />
		<meta name="twitter:card" content="summary_large_image" />
		${structuredData}`;
};

const withHead = (html, head) =>
	withoutDefaultSeo(html).replace("</head>", `${head}\n\t</head>`);

for (const seo of PUBLIC_PAGE_SEO) {
	const html = withHead(template, `${pageHead(seo)}\n${metrikaScript}`)
		.replace(/<html lang="[^"]*"/, `<html lang="${seo.language}"`)
		.replace(
			'<div id="root"></div>',
			`<div id="root">${render(seo.path)}</div>`,
		)
		.replace("</body>", `${metrikaNoScript}\n\t</body>`);
	const output =
		seo.path === "/"
			? "index.html"
			: seo.path.endsWith("/")
				? `${seo.path.slice(1)}index.html`
				: `${seo.path.slice(1)}.html`;
	await mkdir(dirname(join(distDir, output)), { recursive: true });
	await writeFile(join(distDir, output), html);

	assert(html.includes(`<link rel="canonical" href="${origin}${seo.path}"`));
	assert(html.includes("<h1"), `${seo.path} must contain rendered content`);
	assert(html.includes(`ym(${metrikaCounterId},"init"`));
	if (seo.path === "/") {
		assert(html.includes('"@type":"FAQPage"'));
		assert(html.includes("/assets/poka-ne-zabyl-og.png"));
		assert(html.includes('"name":"Базовый","price":"0"'));
		assert(html.includes('"name":"Плюс","price":"249"'));
	}
	if (acquisitionPaths.has(seo.path)) {
		assert(html.includes('"@type":"FAQPage"'));
		assert(html.includes(ACQUISITION_FAQ[seo.path.slice(1)][0][0]));
	}
	if (["/en/", "/es/"].includes(seo.path)) {
		assert(html.includes(`hreflang="${seo.language}"`));
		assert(html.includes('"@type":"FAQPage"'));
		assert(html.includes('"name":"Plus","price":"9.99","priceCurrency":"USD"'));
		assert(html.includes("$9.99"));
	}
}

const noindexShell = (title) =>
	withHead(
		template,
		`<title>${escapeAttribute(title)}</title><meta name="robots" content="noindex, nofollow" />`,
	);

await writeFile(join(distDir, "app.html"), noindexShell("Пока не забыл"));
await writeFile(
	join(distDir, "payment-success.html"),
	noindexShell("Платёж принят — Пока не забыл"),
);
await writeFile(
	join(distDir, "payment-failed.html"),
	noindexShell("Платёж не завершён — Пока не забыл"),
);

const notFound = withHead(
	template.replace(/\s*<script\s+type="module"[\s\S]*?<\/script>/i, ""),
	'<title>Страница не найдена — Пока не забыл</title><meta name="robots" content="noindex" />',
).replace(
	'<div id="root"></div>',
	'<main class="legal-page"><div class="shell legal-page__body"><h1>Страница не найдена</h1><p><a href="/">Вернуться на главную</a></p></div></main>',
);
await writeFile(join(distDir, "404.html"), notFound);

await rm(serverDir, { recursive: true, force: true });
console.log(`Prerendered ${PUBLIC_PAGE_SEO.length} public pages`);
