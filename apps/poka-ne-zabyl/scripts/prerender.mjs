import assert from "node:assert/strict";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(appDir, "dist");
const serverDir = join(appDir, "dist-server");
const serverFile = (await readdir(serverDir)).find((file) =>
	file.startsWith("entry-server"),
);

assert(serverFile, "SSR entry was not built");

const { PUBLIC_PAGE_SEO, render } = await import(
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

const escapeAttribute = (value) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

const withoutDefaultSeo = (html) =>
	html
		.replace(/\s*<meta\s+name="description"[\s\S]*?\/>/i, "")
		.replace(/\s*<link\s+rel="canonical"[\s\S]*?\/>/i, "")
		.replace(/\s*<title>[\s\S]*?<\/title>/i, "");

const pageHead = ({ path, title, description }) => {
	const canonical = `${origin}${path}`;
	const structuredData =
		path === "/"
			? `<script type="application/ld+json">${JSON.stringify({
					"@context": "https://schema.org",
					"@graph": [
						{
							"@type": "Organization",
							"@id": `${origin}/#organization`,
							name: "Пока не забыл",
							url: `${origin}/`,
							logo: `${origin}/assets/poka-ne-zabyl-logo.jpg`,
							sameAs: ["https://t.me/poka_ne_zabyl_bot"],
						},
						{
							"@type": "SoftwareApplication",
							"@id": `${origin}/#application`,
							name: "Пока не забыл",
							url: `${origin}/`,
							description,
							applicationCategory: "FinanceApplication",
							operatingSystem: "Telegram",
							inLanguage: "ru-RU",
							featureList: [
								"Учёт расходов текстом и голосом",
								"Распознавание фотографий чеков",
								"Лимиты расходов по категориям",
								"Плановые покупки с суммой, категорией и датой",
								"Личные и общие расходы",
							],
							provider: { "@id": `${origin}/#organization` },
							offers: {
								"@type": "Offer",
								price: "0",
								priceCurrency: "RUB",
							},
						},
					],
				}).replaceAll("<", "\\u003c")}</script>`
			: "";

	return `
		<title>${escapeAttribute(title)}</title>
		<meta name="description" content="${escapeAttribute(description)}" />
		<link rel="canonical" href="${canonical}" />
		<meta property="og:type" content="website" />
		<meta property="og:locale" content="ru_RU" />
		<meta property="og:site_name" content="Пока не забыл" />
		<meta property="og:title" content="${escapeAttribute(title)}" />
		<meta property="og:description" content="${escapeAttribute(description)}" />
		<meta property="og:url" content="${canonical}" />
		<meta property="og:image" content="${origin}/assets/poka-ne-zabyl-logo.jpg" />
		<meta name="twitter:card" content="summary" />
		${structuredData}`;
};

const withHead = (html, head) =>
	withoutDefaultSeo(html).replace("</head>", `${head}\n\t</head>`);

for (const seo of PUBLIC_PAGE_SEO) {
	const html = withHead(template, `${pageHead(seo)}\n${metrikaScript}`)
		.replace(
			'<div id="root"></div>',
			`<div id="root">${render(seo.path)}</div>`,
		)
		.replace("</body>", `${metrikaNoScript}\n\t</body>`);
	const output = seo.path === "/" ? "index.html" : `${seo.path.slice(1)}.html`;
	await writeFile(join(distDir, output), html);

	assert(html.includes(`<link rel="canonical" href="${origin}${seo.path}"`));
	assert(html.includes("<h1"), `${seo.path} must contain rendered content`);
	assert(html.includes(`ym(${metrikaCounterId},"init"`));
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
