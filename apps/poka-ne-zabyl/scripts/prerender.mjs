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
							mainEntity: [
								{
									"@type": "Question",
									name: "Что такое PWA и нужно ли что-то скачивать?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "PWA означает устанавливаемое веб-приложение. Откройте его по ссылке и добавьте на главный экран. Оно запускается отдельно и не требует App Store или Google Play.",
									},
								},
								{
									"@type": "Question",
									name: "Бот сам сохраняет всё без проверки?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "Нет. Он предлагает разобранный расход, а вы подтверждаете или исправляете результат.",
									},
								},
								{
									"@type": "Question",
									name: "Что останется доступно без Плюс?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "История расходов, ручное добавление, редактирование и доступ к данным не блокируются. Ограничения действуют на новые умные разборы и создание новых категорий, лимитов, планов и пространств.",
									},
								},
								{
									"@type": "Question",
									name: "Купленные пакеты пропадут после окончания Плюс?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "Нет. Купленный остаток хранится отдельно. Пакет не продлевает подписку и остаётся доступным после её окончания.",
									},
								},
								{
									"@type": "Question",
									name: "Можно пользоваться только лично?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "Да. Групповой чат и общие расходы являются дополнительным сценарием. Это не обязательное условие.",
									},
								},
								{
									"@type": "Question",
									name: "Где хранятся данные и чеки?",
									acceptedAnswer: {
										"@type": "Answer",
										text: "Основные данные и исходные файлы российского запуска размещаются на инфраструктуре в России.",
									},
								},
							],
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
		<meta property="og:image" content="${origin}/assets/poka-ne-zabyl-og.png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:alt" content="Пока не забыл — учёт расходов в приложении и Telegram" />
		<meta name="twitter:card" content="summary_large_image" />
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
	if (seo.path === "/") {
		assert(html.includes('"@type":"FAQPage"'));
		assert(html.includes("/assets/poka-ne-zabyl-og.png"));
		assert(html.includes('"name":"Базовый","price":"0"'));
		assert(html.includes('"name":"Плюс","price":"249"'));
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
