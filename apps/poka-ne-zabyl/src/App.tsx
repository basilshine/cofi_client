import {
	ArrowRight,
	ChatCircleText,
	Check,
	Microphone,
	Receipt,
	TelegramLogo,
	UsersThree,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { Suspense, lazy, useEffect } from "react";
import {
	type LandingLocale,
	landingHomePath,
	landingLocaleFromPath,
	landingSeo,
	landingText,
	localizeLandingTree,
	localizedLandingImage,
} from "./landing-i18n";
import {
	landingAppPath,
	legalPagePath,
	preferredLandingLocale,
} from "./landing-locale";
import { reachMetrikaGoal } from "./metrika";

const MiniApp = lazy(async () => {
	const module = await import("./MiniApp");
	return { default: module.MiniApp };
});

const TELEGRAM_URL = "https://t.me/poka_ne_zabyl_bot";
const EMAIL = "support@poka-ne-zabyl.ru";
const PHONE = "+7 913 807-81-60";
const EFFECTIVE_DATE = "16 июля 2026 года";
const LANDING_LANGUAGE_KEY = "pnz:landing-language";

const operator = {
	name: "ИП Еньшин Василий Сергеевич",
	inn: "700201499734",
	ogrnip: "317703100073732",
	address:
		"634009, Томская область, г. Томск, ул. Большая Подгорная, д. 56, кв. 36",
};

export const App = ({ pathname }: { pathname?: string }) => {
	const path =
		(pathname ?? window.location.pathname).replace(/\/+$/, "") || "/";

	useEffect(() => {
		if (pathname !== undefined || path !== "/") return;
		const locale = preferredLandingLocale(
			navigator.language,
			window.localStorage.getItem(LANDING_LANGUAGE_KEY),
		);
		if (locale !== "ru") window.location.replace(landingHomePath(locale));
	}, [path, pathname]);

	useEffect(() => {
		if (!window.location.hash) {
			window.scrollTo(0, 0);
			return;
		}
		requestAnimationFrame(() =>
			document.getElementById(window.location.hash.slice(1))?.scrollIntoView(),
		);
	}, []);

	switch (path) {
		case "/app":
		case "/join":
			return (
				<Suspense fallback={<AppLoading />}>
					<MiniApp />
				</Suspense>
			);
		case "/offer":
			return <OfferPage />;
		case "/privacy":
			return <PrivacyPage locale="ru" />;
		case "/en/privacy":
			return <PrivacyPage locale="en" />;
		case "/es/privacy":
			return <PrivacyPage locale="es" />;
		case "/consent":
			return <ConsentPage locale="ru" />;
		case "/en/consent":
			return <ConsentPage locale="en" />;
		case "/es/consent":
			return <ConsentPage locale="es" />;
		case "/refunds":
			return <RefundPage />;
		case "/payment/success":
			return <PaymentStatus success />;
		case "/payment/failed":
			return <PaymentStatus success={false} />;
		default:
			return <LandingPage locale={landingLocaleFromPath(path)} />;
	}
};

const AppLoading = () => (
	<main className="app-loading" role="status" aria-live="polite">
		<img src="/assets/poka-ne-zabyl-logo.svg?v=20260717" alt="" />
		<span>Открываем приложение…</span>
	</main>
);

const BrandMark = () => (
	<img
		src="/assets/poka-ne-zabyl-logo.svg?v=20260717"
		alt=""
		aria-hidden="true"
	/>
);

const Brand = ({
	inverse = false,
	locale = "ru",
}: {
	inverse?: boolean;
	locale?: LandingLocale;
}) => (
	<a
		className={`brand ${inverse ? "brand--inverse" : ""}`}
		href={landingHomePath(locale)}
	>
		<span className="brand__mark">
			<BrandMark />
		</span>
		<span>Пока не забыл</span>
	</a>
);

const TelegramButton = ({ light = false }: { light?: boolean }) => (
	<a
		className={`button ${light ? "button--light" : ""}`}
		href={TELEGRAM_URL}
		rel="noreferrer"
		target="_blank"
	>
		<TelegramLogo size={20} weight="fill" />
		Открыть бота
	</a>
);

const trackLandingAppClick = () => reachMetrikaGoal("landing_app_click");

const AppButton = ({
	light = false,
	locale = "ru",
}: {
	light?: boolean;
	locale?: LandingLocale;
}) => (
	<a
		className={`button ${light ? "button--light" : ""}`}
		href={landingAppPath(locale)}
		onClick={trackLandingAppClick}
	>
		{locale === "en"
			? "Open the app"
			: locale === "es"
				? "Abrir la aplicación"
				: "Открыть приложение"}
		<ArrowRight size={18} weight="bold" />
	</a>
);

const captureStories = [
	{
		mode: "voice",
		stage: "input",
		phase: "Запишите голосом",
		caption: "Скажите сумму и назначение расхода",
		image: "/pwa-flow-voice-input.png",
		offset: "0s",
	},
	{
		mode: "voice",
		stage: "review",
		phase: "Проверьте запись",
		caption: "Приложение заполнит сумму, продавца и категорию",
		image: "/pwa-flow-voice-review.png",
		offset: "-32s",
	},
	{
		mode: "voice",
		stage: "saved",
		phase: "Сохраните расход",
		caption: "Подтверждённая запись появится в истории",
		image: "/pwa-flow-voice-saved.png",
		offset: "-28s",
	},
	{
		mode: "text",
		stage: "input",
		phase: "Напишите текстом",
		caption: "Достаточно одной обычной фразы",
		image: "/pwa-flow-text-input.png",
		offset: "-24s",
	},
	{
		mode: "text",
		stage: "review",
		phase: "Исправьте при необходимости",
		caption: "Все распознанные поля остаются доступными",
		image: "/pwa-flow-text-review.png",
		offset: "-20s",
	},
	{
		mode: "text",
		stage: "saved",
		phase: "Подтвердите результат",
		caption: "До подтверждения сервис ничего не решает за вас",
		image: "/pwa-flow-text-saved.png",
		offset: "-16s",
	},
	{
		mode: "photo",
		stage: "input",
		phase: "Сфотографируйте чек",
		caption: "Можно снять чек или выбрать фото из галереи",
		image: "/pwa-flow-photo-input.png",
		offset: "-12s",
	},
	{
		mode: "photo",
		stage: "review",
		phase: "Сверьте позиции",
		caption: "Проверьте магазин, сумму и содержимое чека",
		image: "/pwa-flow-photo-review.png",
		offset: "-8s",
	},
	{
		mode: "photo",
		stage: "saved",
		phase: "Получите готовую запись",
		caption: "Расход сохранится вместе с распознанными позициями",
		image: "/pwa-flow-photo-saved.png",
		offset: "-4s",
	},
] as const;

const CaptureStory = ({ locale = "ru" }: { locale?: LandingLocale }) => (
	<div
		className="capture-story"
		aria-label={landingText(
			locale,
			"Как расход проходит от ввода до сохранения",
		)}
	>
		{captureStories.map((story) => (
			<figure
				aria-hidden="true"
				className={`story-scene capture-fragment capture-fragment--${story.mode} capture-fragment--${story.stage}`}
				key={`${story.mode}-${story.phase}`}
				style={{ "--scene-offset": story.offset } as CSSProperties}
			>
				<div className="capture-fragment__heading">
					<span className="capture-fragment__mode">
						{story.mode === "voice" && <Microphone size={18} weight="fill" />}
						{story.mode === "text" && (
							<ChatCircleText size={18} weight="fill" />
						)}
						{story.mode === "photo" && <Receipt size={18} weight="fill" />}
						{landingText(
							locale,
							story.mode === "voice"
								? "Голос"
								: story.mode === "text"
									? "Текст"
									: "Фото чека",
						)}
					</span>
					<strong>{landingText(locale, story.phase)}</strong>
				</div>
				<div className="capture-fragment__canvas">
					<img src={localizedLandingImage(locale, story.image)} alt="" />
				</div>
				<figcaption>{landingText(locale, story.caption)}</figcaption>
			</figure>
		))}
	</div>
);

const LanguageSwitcher = ({ locale }: { locale: LandingLocale }) => (
	<nav
		className="language-switcher"
		aria-label={
			locale === "ru"
				? "Выбор языка"
				: locale === "es"
					? "Selector de idioma"
					: "Language selector"
		}
	>
		{(["ru", "en", "es"] as const).map((code) => (
			<a
				aria-current={locale === code ? "page" : undefined}
				href={landingHomePath(code)}
				key={code}
				onClick={() => window.localStorage.setItem(LANDING_LANGUAGE_KEY, code)}
			>
				{code.toUpperCase()}
			</a>
		))}
	</nav>
);

const LandingPage = ({ locale }: { locale: LandingLocale }) => {
	usePageTitle(landingSeo[locale].title);
	useEffect(() => {
		document.documentElement.lang = locale;
		const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			for (const element of elements) element.classList.add("is-visible");
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target);
				}
			},
			{ threshold: 0.18 },
		);
		for (const element of elements) observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return localizeLandingTree(
		<main className="landing-page">
			<section className="hero">
				<header className="hero__nav shell">
					<Brand locale={locale} />
					<LanguageSwitcher locale={locale} />
					<nav aria-label="Основная навигация">
						<a href="#how">Как это работает</a>
						<a href="#mini-app">Приложение</a>
						<a href="#pricing">Тарифы</a>
						<a href="#shared">Для компании</a>
						<AppButton locale={locale} />
					</nav>
				</header>
				<div className="hero__stage shell">
					<div className="hero__copy">
						<p className="hero__kicker">Приложение для телефона</p>
						<h1>Расходы, пока не забылись</h1>
						<p className="hero__lead">
							Откройте по ссылке, добавьте на экран телефона и пользуйтесь как
							обычным приложением. Telegram остаётся быстрым помощником.
						</p>
						<div className="hero__actions">
							<AppButton locale={locale} />
							<a
								className="text-link"
								href={TELEGRAM_URL}
								rel="noreferrer"
								target="_blank"
							>
								Открыть бота <TelegramLogo size={18} weight="fill" />
							</a>
						</div>
					</div>

					<div className="hero-demo" aria-label="Пример записи расхода">
						<div className="hero-demo__blue" aria-hidden="true" />
						<div className="demo-message demo-message--text">
							<ChatCircleText size={22} />
							<span>Кофе и круассан 550 ₽</span>
						</div>
						<div className="demo-message demo-message--voice">
							<Microphone size={22} />
							<span className="voice-wave" aria-label="Голосовое сообщение">
								{voiceBars.map((bar) => (
									<i key={bar.id} style={{ height: bar.height }} />
								))}
							</span>
						</div>
						<svg className="demo-path" aria-hidden="true" viewBox="0 0 520 520">
							<defs>
								<filter
									id="rough-ink"
									x="-10%"
									y="-10%"
									width="120%"
									height="120%"
								>
									<feTurbulence
										type="fractalNoise"
										baseFrequency="0.018 0.075"
										numOctaves="1"
										seed="8"
										result="noise"
									/>
									<feDisplacementMap
										in="SourceGraphic"
										in2="noise"
										scale="2.2"
									/>
								</filter>
								<linearGradient id="ink-transition" x1="-240" x2="285">
									<stop offset="0" stopColor="#244ad7" />
									<stop offset=".7" stopColor="#3657da" />
									<stop offset="1" stopColor="#aebcff" />
								</linearGradient>
							</defs>
							<g filter="url(#rough-ink)">
								<path
									className="demo-path__halo demo-path__segment-1"
									pathLength="1"
									d="M-240 35C-176 8-111 14-104 48C-98 75-136 84-148 59C-164 25-91 12-22 49C48 87 99 145 190 172C220 181 251 185 285 188"
								/>
								<path
									className="demo-path__ink demo-path__segment-1"
									pathLength="1"
									d="M-240 35C-176 8-111 14-104 48C-98 75-136 84-148 59C-164 25-91 12-22 49C48 87 99 145 190 172C220 181 251 185 285 188"
								/>
								<path
									className="demo-path__halo demo-path__segment-2"
									pathLength="1"
									d="M285 188C365 195 438 183 448 234C456 273 421 295 394 279C373 267 384 244 404 251C427 261 407 313 329 337"
								/>
								<path
									className="demo-path__ink demo-path__segment-2"
									pathLength="1"
									d="M285 188C365 195 438 183 448 234C456 273 421 295 394 279C373 267 384 244 404 251C427 261 407 313 329 337"
								/>
								<path
									className="demo-path__halo demo-path__segment-3"
									pathLength="1"
									d="M329 337C275 356 238 357 232 390C228 417 260 434 281 415C298 400 285 383 271 394C255 407 299 446 444 451"
								/>
								<path
									className="demo-path__ink demo-path__segment-3"
									pathLength="1"
									d="M329 337C275 356 238 357 232 390C228 417 260 434 281 415C298 400 285 383 271 394C255 407 299 446 444 451"
								/>
							</g>
							<circle className="demo-path__dot" cx="329" cy="337" r="6" />
						</svg>
						<span className="demo-note demo-note--said">сказал</span>
						<span className="demo-note demo-note--checked">проверил</span>
						<span className="demo-note demo-note--saved">запомнил</span>
						<div className="expense-slip">
							<p>Расход</p>
							<strong>550 ₽</strong>
							<span>Кофейня · сегодня</span>
							<b>
								<Check size={20} weight="bold" />
							</b>
						</div>
					</div>
				</div>
			</section>

			<section className="pwa-section" id="mini-app">
				<div className="shell pwa-layout" data-reveal>
					<div className="pwa-copy">
						<h2>Приложение без магазина приложений</h2>
						<p>
							PWA открывается по обычной ссылке, а затем добавляется на главный
							экран. После установки оно запускается отдельным окном и остаётся
							под рукой, как привычное приложение.
						</p>
						<ol className="install-flow">
							<li>
								<strong>Откройте</strong>
								<span>Нажмите «Открыть приложение» на этой странице.</span>
							</li>
							<li>
								<strong>Добавьте</strong>
								<span>Выберите установку или добавление на главный экран.</span>
							</li>
							<li>
								<strong>Пользуйтесь</strong>
								<span>Открывайте по иконке без App Store и Google Play.</span>
							</li>
						</ol>
						<AppButton locale={locale} />
					</div>
					<figure className="pwa-device">
						<img
							alt="Главный экран приложения с расходами, планами и лимитами"
							decoding="async"
							height="1040"
							src="/pwa-home.png"
							width="520"
						/>
						<figcaption>Так приложение выглядит после установки</figcaption>
					</figure>
				</div>
			</section>

			<section className="steps-section" id="how">
				<div className="shell" data-reveal>
					<div className="section-heading">
						<h2>Сказали. Проверили. Запомнили.</h2>
						<p>
							Личный учёт расходов без таблиц, обязательных форм и попыток
							вспомнить всё вечером.
						</p>
					</div>
					<div className="steps-list">
						<article>
							<span>01</span>
							<ChatCircleText size={30} />
							<h3>Отправьте как удобно</h3>
							<p>
								В приложении вручную, текстом, голосом или по фото. В Telegram
								работают те же быстрые способы.
							</p>
						</article>
						<article>
							<span>02</span>
							<NoteReviewIcon />
							<h3>Проверьте детали</h3>
							<p>
								Сумму, магазин, дату и категорию можно поправить до сохранения.
							</p>
						</article>
						<article>
							<span>03</span>
							<Check size={30} weight="bold" />
							<h3>Продолжайте свои дела</h3>
							<p>Подтверждённый расход появится в истории и сводках.</p>
						</article>
					</div>
				</div>
			</section>

			<section className="review-section" id="review">
				<div className="shell review-layout" data-reveal>
					<div className="review-copy">
						<h2>Сервис не решает за вас</h2>
						<p>
							Он предлагает готовую запись. Вы подтверждаете её, исправляете или
							отменяете.
						</p>
						<ul>
							<li>
								<Check size={18} /> Принимает голос, текст и фото чека
							</li>
							<li>
								<Check size={18} /> Показывает сумму, позиции и категорию
							</li>
							<li>
								<Check size={18} /> Сохраняет только после подтверждения
							</li>
						</ul>
					</div>
					<CaptureStory locale={locale} />
				</div>
			</section>

			<section className="miniapp-section" id="capabilities">
				<div className="shell miniapp-layout">
					<div className="miniapp-copy" data-reveal>
						<h2>Больше, чем список расходов</h2>
						<p>
							Приложение собирает историю, планы, лимиты и общие расходы в одном
							месте. Нужное находится за несколько касаний.
						</p>
						<dl className="app-capabilities">
							<div>
								<dt>История и поиск</dt>
								<dd>Ищите по покупке, магазину, категории или #тегу.</dd>
							</div>
							<div>
								<dt>Лимиты по категориям</dt>
								<dd>
									Следите за неделей или месяцем и получайте предупреждения.
								</dd>
							</div>
							<div>
								<dt>Планы покупок</dt>
								<dd>
									Собирайте списки, суммы и даты, затем отмечайте купленное.
								</dd>
							</div>
							<div>
								<dt>Личное и общее</dt>
								<dd>
									Переключайте пространства и получайте уведомления из каждого.
								</dd>
							</div>
						</dl>
					</div>

					<div className="app-showcase" data-reveal>
						<figure className="app-shot app-shot--plans">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Меню личного и семейного пространства"
								decoding="async"
								height="1040"
								src="/pwa-spaces.png"
								width="520"
							/>
							<figcaption>Личное и семейное рядом</figcaption>
						</figure>
						<figure className="app-shot app-shot--overview">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Экран планов покупок со списками, суммами и датами"
								decoding="async"
								height="1040"
								src="/pwa-plans.png"
								width="520"
							/>
							<figcaption>Планы превращаются в расходы</figcaption>
						</figure>
						<figure className="app-shot app-shot--plus">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Единый список уведомлений из личного и семейного пространства"
								decoding="async"
								height="1040"
								src="/pwa-notifications.png"
								width="520"
							/>
							<figcaption>Уведомления из всех пространств</figcaption>
						</figure>
					</div>
				</div>
			</section>

			<section className="pricing-section" id="pricing">
				<div className="shell" data-reveal>
					<div className="pricing-heading">
						<p className="section-label">Тарифы без скрытых функций</p>
						<h2>
							Начните бесплатно. Платите, когда умных добавлений нужно больше.
						</h2>
						<p>
							История, ручной ввод, редактирование и доступ к своим данным
							остаются доступны на обоих тарифах.
						</p>
					</div>

					<div className="pricing-plans">
						<article className="pricing-plan">
							<div className="pricing-plan__head">
								<div>
									<span>Базовый</span>
									<strong>0 ₽</strong>
								</div>
								<small>Без подписки</small>
							</div>
							<p>Для знакомства с сервисом и спокойного ручного учёта.</p>
							<ul>
								<li>
									<Check size={18} weight="bold" /> 20 приветственных разборов
									один раз
								</li>
								<li>
									<Check size={18} weight="bold" /> Все способы добавления
									расхода
								</li>
								<li>
									<Check size={18} weight="bold" /> 15 стандартных, 3 своих
									категории и 3 лимита
								</li>
								<li>
									<Check size={18} weight="bold" /> 10 активных планов покупок
								</li>
								<li>
									<Check size={18} weight="bold" /> Личное и ещё одно своё
									пространство
								</li>
								<li>
									<Check size={18} weight="bold" /> Фото и голос хранятся 3 дня
								</li>
							</ul>
							<a
								className="pricing-plan__action"
								href={landingAppPath(locale)}
								onClick={trackLandingAppClick}
							>
								Начать с Базового <ArrowRight size={18} />
							</a>
						</article>

						<article className="pricing-plan pricing-plan--plus">
							<div className="pricing-plan__head">
								<div>
									<span>Плюс</span>
									<strong>
										249 ₽ <small>/ 30 дней</small>
									</strong>
								</div>
								<small>Для регулярного учёта</small>
							</div>
							<p>
								Больше умных добавлений, планов и пространства для семейных
								сценариев.
							</p>
							<ul>
								<li>
									<Check size={18} weight="bold" /> 400 разборов на оплаченный
									период
								</li>
								<li>
									<Check size={18} weight="bold" /> До 100 своих категорий и
									лимитов
								</li>
								<li>
									<Check size={18} weight="bold" /> До 100 активных планов
									покупок
								</li>
								<li>
									<Check size={18} weight="bold" /> До 10 своих пространств
								</li>
								<li>
									<Check size={18} weight="bold" /> Фото и голос хранятся 30
									дней
								</li>
								<li>
									<Check size={18} weight="bold" /> Пакеты разборов дешевле
								</li>
							</ul>
							<a
								className="pricing-plan__action"
								href={landingAppPath(locale, "view=subscription")}
								onClick={trackLandingAppClick}
							>
								Подключить Плюс <ArrowRight size={18} />
							</a>
						</article>
					</div>

					<div className="pack-pricing">
						<div className="pack-pricing__copy">
							<span>Разборы не сгорают вместе с подпиской</span>
							<h3>Можно просто докупить пакет</h3>
							<p>
								Пакет не меняет тариф и дату продления. Сначала расходуется
								лимит Плюс, затем приветственный и купленный остаток.
							</p>
						</div>
						<div className="pack-pricing__list" aria-label="Стоимость пакетов">
							<div>
								<strong>100</strong>
								<span>99 ₽ на Базовом</span>
								<b>79 ₽ с Плюс</b>
							</div>
							<div>
								<strong>500</strong>
								<span>399 ₽ на Базовом</span>
								<b>299 ₽ с Плюс</b>
							</div>
							<div>
								<strong>1 500</strong>
								<span>899 ₽ на Базовом</span>
								<b>699 ₽ с Плюс</b>
							</div>
						</div>
					</div>

					<p className="parse-note">
						Разбор списывается только за успешный результат: текст стоит 1,
						голос 2, фото 3, большой чек 5, оценка предмета по фото 10. Ручной
						ввод разборы не расходует.
					</p>
				</div>
			</section>

			<section className="shared-section" id="shared">
				<div className="shell shared-layout">
					<div data-reveal>
						<UsersThree size={42} weight="light" />
						<h2>Разделите общий расход</h2>
						<p>
							Выберите расход и участников. Приложение посчитает доли и покажет,
							кто кому должен.
						</p>
					</div>
					<div
						className="split-showcase"
						data-reveal
						aria-label="Разделение общего расхода в приложении"
					>
						<figure className="app-shot split-shot split-shot--detail">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Общий расход с долями участников"
								decoding="async"
								height="1040"
								src="/pwa-splits-detail.png"
								width="520"
							/>
							<figcaption>Откройте общий расход</figcaption>
						</figure>
						<figure className="app-shot split-shot split-shot--editor">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Распределение суммы между участниками"
								decoding="async"
								height="1040"
								src="/pwa-splits-editor.png"
								width="520"
							/>
							<figcaption>Распределите доли</figcaption>
						</figure>
						<figure className="app-shot split-shot split-shot--list">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Итог разделения с суммой долга"
								decoding="async"
								height="1040"
								src="/pwa-splits-list.png"
								width="520"
							/>
							<figcaption>Посмотрите, кто кому должен</figcaption>
						</figure>
					</div>
				</div>
			</section>

			<section className="faq-section">
				<div className="shell faq-layout" data-reveal>
					<div>
						<p className="section-label">Коротко о важном</p>
						<h2>До первого расхода</h2>
					</div>
					<div>
						<details>
							<summary>Что такое PWA и нужно ли что-то скачивать?</summary>
							<p>
								PWA означает устанавливаемое веб-приложение. Откройте его по
								ссылке и добавьте на главный экран. Оно запускается отдельно и
								не требует App Store или Google Play.
							</p>
						</details>
						<details>
							<summary>Бот сам сохраняет всё без проверки?</summary>
							<p>
								Нет. Он предлагает разобранный расход, а вы подтверждаете или
								исправляете результат.
							</p>
						</details>
						<details>
							<summary>Что останется доступно без Плюс?</summary>
							<p>
								История расходов, ручное добавление, редактирование и доступ к
								данным не блокируются. Ограничения действуют на новые умные
								разборы и создание новых категорий, лимитов, планов и
								пространств.
							</p>
						</details>
						<details>
							<summary>Купленные пакеты пропадут после окончания Плюс?</summary>
							<p>
								Нет. Купленный остаток хранится отдельно. Пакет не продлевает
								подписку и остаётся доступным после её окончания.
							</p>
						</details>
						<details>
							<summary>Можно пользоваться только лично?</summary>
							<p>
								Да. Общие пространства и разделение расходов подключаются только
								когда нужны. Приложение посчитает доли и покажет, кто кому
								должен.
							</p>
						</details>
						<details>
							<summary>Где хранятся данные и чеки?</summary>
							<p>
								Основные данные и исходные файлы российского запуска размещаются
								на инфраструктуре в России.
							</p>
						</details>
					</div>
				</div>
			</section>

			<section className="final-cta">
				<div className="shell final-cta__inner" data-reveal>
					<span className="final-cta__mark">
						<BrandMark />
					</span>
					<p>Покупка уже случилась.</p>
					<h2>Запишите, пока не забыли.</h2>
					<AppButton light locale={locale} />
					<a
						className="text-link text-link--inverse"
						href={TELEGRAM_URL}
						rel="noreferrer"
						target="_blank"
					>
						Открыть бота <TelegramLogo size={18} weight="fill" />
					</a>
				</div>
			</section>

			<SiteFooter locale={locale} />
		</main>,
		locale,
	);
};

const voiceBars = Array.from({ length: 15 }, (_, index) => ({
	id: `bar-${index}`,
	height: `${8 + ((index * 11) % 25)}px`,
}));

const NoteReviewIcon = () => (
	<svg aria-hidden="true" className="note-review-icon" viewBox="0 0 32 32">
		<path d="M7 5h18v22H7z" />
		<path d="m11 17 3 3 7-8" />
	</svg>
);

const LegalHeader = ({ locale }: { locale: LandingLocale }) => (
	<header className="legal-header shell">
		<Brand locale={locale} />
		<a className="text-link" href={landingAppPath(locale)}>
			{locale === "en"
				? "Open the app"
				: locale === "es"
					? "Abrir la aplicación"
					: "Открыть приложение"}{" "}
			<ArrowRight size={17} />
		</a>
	</header>
);

const LegalPage = ({
	title,
	locale = "ru",
	children,
}: {
	title: string;
	locale?: LandingLocale;
	children: React.ReactNode;
}) => (
	<main className="legal-page">
		<LegalHeader locale={locale} />
		<article className="legal-document shell">
			<p className="section-label">
				{locale === "en"
					? "Effective July 21, 2026"
					: locale === "es"
						? "Vigente desde el 21 de julio de 2026"
						: `Действует с ${EFFECTIVE_DATE}`}
			</p>
			<h1>{title}</h1>
			{children}
		</article>
		<SiteFooter locale={locale} />
	</main>
);

type InternationalLegalLocale = Exclude<LandingLocale, "ru">;

const internationalLegalCopy = {
	en: {
		privacyPageTitle: "Privacy Notice — Poka ne zabyl",
		privacyTitle: "Privacy Notice",
		privacyLead:
			"This notice explains how Poka ne zabyl collects, uses, stores, and protects personal data when you use the web app or optional Telegram features.",
		controller: "Data controller",
		controllerText:
			"The controller responsible for the service is the following Russian individual entrepreneur:",
		data: "Personal data we collect",
		dataItems: [
			"your name, verified email address or mobile phone number, and authentication records;",
			"Telegram ID, username, chat and message identifiers when you choose to connect Telegram;",
			"texts, voice recordings, receipt photos, documents, expenses, plans, categories, and shared-space data you submit;",
			"device, browser, IP address, security events, and technical logs;",
			"subscription, order, quota, and payment status without bank card details.",
		],
		purposes: "Purposes and legal bases",
		purposeItems: [
			"To create and operate your account, provide recognition, store records, support shared spaces, and process purchases where this is necessary to perform our agreement or take steps at your request.",
			"To prevent abuse, secure accounts, diagnose failures, and improve reliability where this is necessary for our legitimate interests and does not override your rights.",
			"To keep payment, accounting, and compliance records where required by law.",
			"For optional processing where you have given specific consent. You may withdraw that consent at any time.",
		],
		automation: "Recognition and automated processing",
		automationText:
			"Automated tools may turn text, audio, and images into draft expenses or plans. You review and confirm the result. The service does not use this recognition to make decisions that produce legal or similarly significant effects about you.",
		recipients: "Service providers and processing locations",
		recipientParagraphs: [
			"We use Telegram as an optional communication channel, SMS.RU for phone verification calls, Robokassa for payments, Russian hosting and storage providers, and recognition technology providers. Each provider receives only the data needed for its task.",
			"Core account records and uploaded source files for this service are hosted in Russia. If your data is subject to GDPR or another law governing international processing, the applicable mandatory safeguards and rights continue to apply. We do not start an additional cross-border transfer to a provider unless a valid legal mechanism is available.",
		],
		retention: "Retention",
		retentionParagraphs: [
			"We keep data only while it is needed for the purposes above, while your account is active, or for a mandatory legal retention period.",
			"Original photos and voice recordings are kept for 3 days on Basic and 30 days on Plus. Confirmed expense and plan records remain until you delete them, close the account, or ask us to erase them where the law permits.",
		],
		rights: "Your rights",
		rightsText:
			"Depending on the law that applies to you, you may request access, correction, deletion, restriction, portability, or object to processing. You may withdraw consent without affecting processing that was lawful before withdrawal and lodge a complaint with your local data protection authority.",
		contactPrefix: "Send privacy requests to",
		security: "Security and analytics",
		securityText:
			"We use access controls, short-lived verification codes, request limits, audit records, and technical safeguards. Public landing pages use Yandex Metrica for basic traffic measurement; session replay and form analytics are disabled, and authenticated app pages are not tracked by Metrica.",
		changes: "Changes",
		changesText:
			"We may update this notice when the service, providers, or legal requirements change. The current version and effective date are always published on this page.",
		consentPageTitle: "Data Processing Consent — Poka ne zabyl",
		consentTitle: "Consent to Personal Data Processing",
		consentLead:
			"This consent applies only to processing activities for which consent is the appropriate legal basis.",
		consentIntroBefore: "I voluntarily consent to",
		consentIntroAfter:
			"processing the personal data described below in accordance with the",
		privacyLink: "Privacy Notice",
		consentData: "Data covered by consent",
		consentDataText:
			"Account identifiers and contact details; optional Telegram identifiers; texts, audio, images, and documents I submit; expense and plan data; technical records; and subscription, quota, order, and payment status without bank card details.",
		consentPurposes: "Purposes",
		consentPurposesText:
			"Providing recognition and account features I request, storing and displaying my records, supporting shared spaces, responding to support requests, and enabling optional connected channels.",
		consentActions: "Processing operations",
		consentActionsText:
			"Collection, recording, organization, storage, correction, retrieval, use, disclosure to authorized processors, restriction, and deletion by automated means.",
		consentLimits: "Limits of this consent",
		consentLimitsText:
			"This consent does not authorize marketing and does not cover solely automated decisions with legal or similarly significant effects. Processing necessary to perform our agreement, protect the service, process payments, or comply with law may rely on another lawful basis described in the Privacy Notice.",
		withdrawal: "Withdrawal",
		withdrawalBefore: "I may withdraw consent at any time by contacting",
		withdrawalAfter:
			"Withdrawal does not affect prior lawful processing. We will stop consent-based processing unless another legal basis requires or permits us to continue. Some requested features may then become unavailable.",
	},
	es: {
		privacyPageTitle: "Aviso de privacidad — Poka ne zabyl",
		privacyTitle: "Aviso de privacidad",
		privacyLead:
			"Este aviso explica cómo Poka ne zabyl recopila, utiliza, conserva y protege los datos personales al usar la aplicación web o las funciones opcionales de Telegram.",
		controller: "Responsable del tratamiento",
		controllerText:
			"El responsable del tratamiento del servicio es el siguiente empresario individual ruso:",
		data: "Datos personales que recopilamos",
		dataItems: [
			"nombre, correo electrónico verificado o número de teléfono y registros de autenticación;",
			"ID de Telegram, nombre de usuario e identificadores de chats y mensajes si decides conectar Telegram;",
			"textos, grabaciones de voz, fotos de recibos, documentos, gastos, planes, categorías y datos de espacios compartidos que envíes;",
			"dispositivo, navegador, dirección IP, eventos de seguridad y registros técnicos;",
			"suscripción, pedidos, cuotas y estado de pagos sin datos de la tarjeta bancaria.",
		],
		purposes: "Finalidades y bases jurídicas",
		purposeItems: [
			"Crear y gestionar tu cuenta, reconocer entradas, guardar registros, ofrecer espacios compartidos y procesar compras cuando sea necesario para ejecutar nuestro contrato o atender tu solicitud.",
			"Prevenir abusos, proteger cuentas, diagnosticar fallos y mejorar la fiabilidad cuando sea necesario para nuestros intereses legítimos y no prevalezcan tus derechos.",
			"Conservar registros de pagos, contabilidad y cumplimiento cuando lo exija la ley.",
			"Realizar tratamientos opcionales para los que hayas dado un consentimiento específico, que puedes retirar en cualquier momento.",
		],
		automation: "Reconocimiento y tratamiento automatizado",
		automationText:
			"Las herramientas automatizadas pueden convertir texto, audio e imágenes en borradores de gastos o planes. Tú revisas y confirmas el resultado. El servicio no utiliza este reconocimiento para tomar decisiones que produzcan efectos jurídicos o de importancia similar sobre ti.",
		recipients: "Proveedores y lugares de tratamiento",
		recipientParagraphs: [
			"Utilizamos Telegram como canal opcional, SMS.RU para llamadas de verificación, Robokassa para pagos, proveedores rusos de alojamiento y almacenamiento y proveedores de tecnología de reconocimiento. Cada proveedor recibe solo los datos necesarios para su función.",
			"Los registros principales de la cuenta y los archivos originales se alojan en Rusia. Si tus datos están sujetos al RGPD u otra norma sobre tratamiento internacional, siguen siendo aplicables las garantías y los derechos obligatorios correspondientes. No iniciamos una transferencia adicional a otro proveedor sin un mecanismo jurídico válido.",
		],
		retention: "Conservación",
		retentionParagraphs: [
			"Conservamos los datos solo mientras sean necesarios para las finalidades indicadas, mientras la cuenta esté activa o durante un plazo obligatorio por ley.",
			"Las fotos y grabaciones originales se conservan 3 días en Basic y 30 días en Plus. Los registros confirmados permanecen hasta que los elimines, cierres la cuenta o solicites su supresión cuando la ley lo permita.",
		],
		rights: "Tus derechos",
		rightsText:
			"Según la legislación aplicable, puedes solicitar acceso, rectificación, supresión, limitación o portabilidad, y oponerte al tratamiento. Puedes retirar el consentimiento sin afectar al tratamiento lícito anterior y presentar una reclamación ante tu autoridad local de protección de datos.",
		contactPrefix: "Envía las solicitudes de privacidad a",
		security: "Seguridad y analítica",
		securityText:
			"Aplicamos controles de acceso, códigos de corta duración, límites de solicitudes, registros de auditoría y medidas técnicas. Las páginas públicas utilizan Yandex Metrica para medición básica; la reproducción de sesiones y la analítica de formularios están desactivadas y las páginas autenticadas no son rastreadas por Metrica.",
		changes: "Cambios",
		changesText:
			"Podemos actualizar este aviso cuando cambien el servicio, los proveedores o los requisitos legales. La versión vigente y su fecha siempre se publican en esta página.",
		consentPageTitle: "Consentimiento de tratamiento — Poka ne zabyl",
		consentTitle: "Consentimiento para el tratamiento de datos personales",
		consentLead:
			"Este consentimiento se aplica solo a las actividades para las que el consentimiento sea la base jurídica adecuada.",
		consentIntroBefore: "Consiento voluntariamente que",
		consentIntroAfter:
			"trate los datos personales descritos a continuación conforme al",
		privacyLink: "Aviso de privacidad",
		consentData: "Datos incluidos",
		consentDataText:
			"Identificadores de cuenta y datos de contacto; identificadores opcionales de Telegram; textos, audios, imágenes y documentos que envíe; datos de gastos y planes; registros técnicos; y estado de suscripción, cuotas, pedidos y pagos sin datos de la tarjeta.",
		consentPurposes: "Finalidades",
		consentPurposesText:
			"Prestar las funciones de reconocimiento y cuenta que solicite, guardar y mostrar mis registros, permitir espacios compartidos, responder a solicitudes de soporte y habilitar canales opcionales conectados.",
		consentActions: "Operaciones de tratamiento",
		consentActionsText:
			"Recopilación, registro, organización, conservación, rectificación, consulta, uso, comunicación a encargados autorizados, limitación y supresión por medios automatizados.",
		consentLimits: "Límites del consentimiento",
		consentLimitsText:
			"Este consentimiento no autoriza comunicaciones comerciales ni decisiones exclusivamente automatizadas con efectos jurídicos o similares. El tratamiento necesario para ejecutar el contrato, proteger el servicio, procesar pagos o cumplir la ley puede basarse en otra base jurídica descrita en el Aviso de privacidad.",
		withdrawal: "Retirada",
		withdrawalBefore:
			"Puedo retirar el consentimiento en cualquier momento escribiendo a",
		withdrawalAfter:
			"La retirada no afecta al tratamiento lícito anterior. Dejaremos de tratar datos sobre la base del consentimiento salvo que otra base jurídica permita o exija continuar. Algunas funciones solicitadas podrían dejar de estar disponibles.",
	},
} as const;

const OfferPage = () => {
	usePageTitle("Публичная оферта — Пока не забыл");
	return (
		<LegalPage title="Публичная оферта">
			<p className="legal-lead">
				О заключении договора возмездного оказания услуг сервиса «Пока не
				забыл».
			</p>
			<h2>1. Общие положения</h2>
			<p>
				Настоящий документ является предложением {operator.name} (далее —
				«Исполнитель») заключить договор с совершеннолетним дееспособным
				пользователем сервиса (далее — «Пользователь») на изложенных ниже
				условиях.
			</p>
			<p>
				Акцептом оферты является оплата платного тарифа или дополнительного
				пакета. Бесплатное использование регулируется применимыми положениями
				оферты в части, не связанной с оплатой.
			</p>

			<h2>2. Сервис</h2>
			<p>
				Исполнитель предоставляет доступ к сервису «Пока не забыл» через
				Telegram-бота и устанавливаемое веб-приложение. Веб-приложение может
				работать в обычном браузере, внутри Telegram и после добавления на
				главный экран устройства. Все способы входа относятся к одному сервису и
				используют общий аккаунт и данные.
			</p>
			<p>
				Сервис помогает принимать текст, голосовые сообщения и изображения,
				добавлять расходы вручную, хранить подтверждённые записи и показывать
				историю, категории, лимиты и планы покупок.
			</p>
			<p>
				Результаты автоматического распознавания могут содержать ошибки.
				Пользователь обязан проверить сумму, дату, категорию, участников и
				другие существенные данные перед подтверждением. Сервис не является
				банком, бухгалтерской системой или источником финансовых рекомендаций.
			</p>

			<h2>3. Тарифы и лимиты</h2>
			<p>
				Тариф «Базовый» предоставляется без оплаты и включает один
				приветственный набор из 20 разборов, 15 стандартных и до 3
				пользовательских категорий, до 3 лимитов по категориям, до 10 активных
				планов покупок и до 2 принадлежащих Пользователю пространств, включая
				«Личное». Приветственный набор не начисляется повторно.
			</p>
			<p>
				Тариф «Плюс» стоит 249 рублей, действует 30 календарных дней с момента
				активации и включает 400 разборов на оплаченный период, до 100
				пользовательских категорий, 100 лимитов по категориям, 100 активных
				планов покупок и 10 принадлежащих Пользователю пространств.
			</p>
			<p>
				Дополнительные пакеты содержат 100, 500 или 1500 разборов. Для тарифа
				«Базовый» они стоят 99, 399 и 899 рублей, для тарифа «Плюс» — 79, 299 и
				699 рублей соответственно. Покупка пакета увеличивает только запас
				разборов и не меняет текущий тариф или дату его обновления.
			</p>
			<p>
				Неиспользованный регулярный лимит «Плюс» не переносится на следующий
				период. Купленный остаток хранится отдельно и не исчезает после
				окончания «Плюс». До оплаты сервис показывает наименование покупки, цену
				и предоставляемый объём.
			</p>
			<p>
				Разбор списывается только после успешного результата. Текстовый ввод
				стоит 1 разбор, голосовой — 2, обычное изображение — 3, чек с 20 и более
				распознанными позициями — 5, определение предмета и его примерной цены
				по фотографии — 10. Технические ошибки, повторы обработки и ручное
				добавление расхода разборы не расходуют.
			</p>
			<p>
				Лимиты категорий, планов и пространств применяются только к созданию
				новых объектов. Снижение тарифа не удаляет и не скрывает историю и уже
				созданные данные. Исходные фотографии и голосовые записи хранятся 3 дня
				на тарифе «Базовый» и 30 дней на тарифе «Плюс»; удаление исходника не
				удаляет подтверждённую запись.
			</p>

			<h2>4. Оплата и активация</h2>
			<p>
				Расчёты производятся безналично через платёжного партнёра Robokassa.
				Данные банковской карты Исполнитель не получает и не хранит. Платный
				доступ или пакет активируется после получения серверного подтверждения
				успешной оплаты.
			</p>
			<p>
				Одна оплата тарифа «Плюс» предоставляет доступ на 30 дней и сама по себе
				не включает автоматическое продление. Рекуррентное списание может быть
				подключено только после отдельного явно выраженного согласия
				Пользователя.
			</p>
			<p>
				Удаление ярлыка веб-приложения с устройства не удаляет аккаунт, данные
				или активный платный период и само по себе не является отказом от
				договора.
			</p>

			<h2>5. Права и обязанности</h2>
			<p>
				Исполнитель поддерживает работоспособность сервиса, устраняет
				подтверждённые ошибки и обеспечивает доступ в пределах оплаченных
				условий. Временные перерывы возможны для обслуживания, обновления или по
				причинам, не зависящим от Исполнителя.
			</p>
			<p>
				Пользователь обязуется предоставлять законный контент, не загружать
				чужие персональные данные без основания, не пытаться обходить лимиты и
				не использовать сервис для противоправных действий.
			</p>

			<h2>6. Отказ и возврат</h2>
			<p>
				Пользователь вправе отказаться от договора в порядке, предусмотренном
				законодательством Российской Федерации, с оплатой фактически оказанных
				услуг и документально подтверждённых расходов Исполнителя. Порядок
				обращения опубликован на странице <a href="/refunds">«Возвраты»</a>.
			</p>

			<h2>7. Персональные данные</h2>
			<p>
				Обработка персональных данных осуществляется по{" "}
				<a href="/privacy">Политике обработки персональных данных</a>. Отправляя
				в бот сообщения и файлы, Пользователь подтверждает наличие прав на их
				передачу.
			</p>

			<h2>8. Ответственность и споры</h2>
			<p>
				Стороны несут ответственность по законодательству Российской Федерации.
				До обращения в суд Пользователь может направить претензию на{" "}
				<a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Это не ограничивает
				предусмотренные законом способы защиты прав потребителя.
			</p>

			<h2>9. Изменение оферты</h2>
			<p>
				Новая редакция действует с момента публикации и применяется к будущим
				покупкам. Условия уже оплаченного периода не ухудшаются задним числом.
			</p>

			<OperatorDetails />
		</LegalPage>
	);
};

const InternationalPrivacyPage = ({
	locale,
}: {
	locale: InternationalLegalLocale;
}) => {
	const copy = internationalLegalCopy[locale];
	return (
		<LegalPage title={copy.privacyTitle} locale={locale}>
			<p className="legal-lead">{copy.privacyLead}</p>
			<h2>1. {copy.controller}</h2>
			<p>
				{copy.controllerText} {operator.name}, INN {operator.inn}, OGRNIP{" "}
				{operator.ogrnip}. {copy.contactPrefix}{" "}
				<a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
			</p>
			<h2>2. {copy.data}</h2>
			<ul>
				{copy.dataItems.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
			<h2>3. {copy.purposes}</h2>
			<ul>
				{copy.purposeItems.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
			<h2>4. {copy.automation}</h2>
			<p>{copy.automationText}</p>
			<h2>5. {copy.recipients}</h2>
			{copy.recipientParagraphs.map((paragraph) => (
				<p key={paragraph}>{paragraph}</p>
			))}
			<h2>6. {copy.retention}</h2>
			{copy.retentionParagraphs.map((paragraph) => (
				<p key={paragraph}>{paragraph}</p>
			))}
			<h2>7. {copy.rights}</h2>
			<p>{copy.rightsText}</p>
			<p>
				{copy.contactPrefix} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
			</p>
			<h2>8. {copy.security}</h2>
			<p>{copy.securityText}</p>
			<h2>9. {copy.changes}</h2>
			<p>{copy.changesText}</p>
			<OperatorDetails locale={locale} />
		</LegalPage>
	);
};

const PrivacyPage = ({ locale }: { locale: LandingLocale }) => {
	usePageTitle(
		locale === "ru"
			? "Политика конфиденциальности — Пока не забыл"
			: internationalLegalCopy[locale].privacyPageTitle,
	);
	if (locale !== "ru") return <InternationalPrivacyPage locale={locale} />;
	return (
		<LegalPage title="Политика обработки персональных данных">
			<p className="legal-lead">
				Политика описывает, какие данные получает сервис «Пока не забыл» и зачем
				они нужны.
			</p>
			<h2>1. Оператор</h2>
			<p>
				Оператором персональных данных является {operator.name}, ИНН{" "}
				{operator.inn}, ОГРНИП {operator.ogrnip}. Обращения принимаются по
				адресу <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
			</p>

			<h2>2. Какие данные обрабатываются</h2>
			<ul>
				<li>Telegram ID, имя, username, идентификаторы чатов и сообщений;</li>
				<li>
					адрес электронной почты, если пользователь привязал его для входа, и
					сведения о подтверждении одноразового кода;
				</li>
				<li>
					номер мобильного телефона и сведения о подтверждении проверочным
					звонком, если пользователь выбрал вход по телефону;
				</li>
				<li>
					текст сообщений, голосовые записи, фотографии чеков и иные
					отправленные файлы;
				</li>
				<li>сведения о расходах, категориях, участниках и подтверждениях;</li>
				<li>
					технические журналы, IP-адрес, сведения об устройстве и события
					безопасности;
				</li>
				<li>
					сведения о заказе и статусе оплаты без реквизитов банковской карты.
				</li>
			</ul>

			<h2>3. Цели и основания</h2>
			<p>
				Данные используются для регистрации, связи аккаунта с Telegram,
				подтверждённой электронной почтой или телефоном, входа в браузерное
				приложение, распознавания пользовательского ввода, сохранения расходов,
				работы групповых сценариев, поддержки, обеспечения безопасности,
				исполнения договора, платежей и соблюдения закона.
			</p>
			<p>
				Основаниями являются согласие субъекта, заключение и исполнение
				договора, а также обязанности Оператора, установленные законом.
			</p>

			<h2>4. Действия с данными</h2>
			<p>
				Оператор может собирать, записывать, систематизировать, хранить,
				уточнять, извлекать, использовать, передавать уполномоченным
				обработчикам, блокировать и удалять данные с применением
				автоматизированных средств.
			</p>

			<h2>5. Сервисы и получатели</h2>
			<p>
				Для работы используются Telegram как канал взаимодействия, SMS.RU для
				проверочных звонков, Robokassa для оплаты, российские поставщики
				хостинга и хранения, а также поставщики технологий распознавания. Им
				передаётся только объём данных, необходимый для соответствующей
				операции.
			</p>
			<p>
				Основные пользовательские записи и исходные файлы российского запуска
				хранятся в России. Если для отдельной функции требуется трансграничная
				передача, она выполняется только после выполнения применимых требований
				и получения необходимого согласия.
			</p>

			<h2>6. Срок хранения и удаление</h2>
			<p>
				Данные хранятся до достижения целей обработки, прекращения аккаунта или
				истечения обязательных сроков хранения. Пользователь может запросить
				доступ, исправление, блокирование или удаление данных по адресу {EMAIL}.
				Отдельные сведения могут сохраняться, если этого требует закон.
			</p>
			<p>
				Исходные фотографии и голосовые записи хранятся 3 дня на тарифе
				«Базовый» и 30 дней на тарифе «Плюс», считая с момента загрузки. После
				удаления исходника распознанные и подтверждённые сведения о расходе
				сохраняются до удаления аккаунта, запроса Пользователя или наступления
				другого основания для удаления.
			</p>

			<h2>7. Безопасность</h2>
			<p>
				Оператор применяет организационные и технические меры защиты,
				разграничивает доступ и ведёт учёт операций. Сессии браузерного
				приложения защищаются технической cookie; одноразовые коды имеют
				ограниченный срок действия и число попыток. Пользователь отвечает за
				безопасность своего Telegram-аккаунта и электронной почты и не должен
				отправлять в сервис лишние сведения, не относящиеся к расходам.
			</p>

			<h2>8. Сайт</h2>
			<p>
				На публичных страницах используется Яндекс Метрика для оценки
				посещаемости и переходов в Telegram. Сервис может обрабатывать IP-адрес,
				параметры устройства и браузера, адреса просмотренных страниц и cookie.
				Вебвизор и аналитика форм отключены; страницы Mini App не отслеживаются.
				Технический хостинг также может фиксировать IP-адрес и параметры запроса
				в журналах безопасности. Устанавливаемое веб-приложение сохраняет на
				устройстве только публичные файлы интерфейса и экран отсутствия связи;
				личные расходы, чеки и ответы API в офлайн-кэш не записываются.
			</p>

			<OperatorDetails />
		</LegalPage>
	);
};

const InternationalConsentPage = ({
	locale,
}: {
	locale: InternationalLegalLocale;
}) => {
	const copy = internationalLegalCopy[locale];
	return (
		<LegalPage title={copy.consentTitle} locale={locale}>
			<p className="legal-lead">{copy.consentLead}</p>
			<p>
				{copy.consentIntroBefore} {operator.name}, INN {operator.inn},{" "}
				{copy.consentIntroAfter}{" "}
				<a href={legalPagePath(locale, "privacy")}>{copy.privacyLink}</a>.
			</p>
			<h2>{copy.consentData}</h2>
			<p>{copy.consentDataText}</p>
			<h2>{copy.consentPurposes}</h2>
			<p>{copy.consentPurposesText}</p>
			<h2>{copy.consentActions}</h2>
			<p>{copy.consentActionsText}</p>
			<h2>{copy.consentLimits}</h2>
			<p>{copy.consentLimitsText}</p>
			<h2>{copy.withdrawal}</h2>
			<p>
				{copy.withdrawalBefore} <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.{" "}
				{copy.withdrawalAfter}
			</p>
			<OperatorDetails locale={locale} />
		</LegalPage>
	);
};

const ConsentPage = ({ locale }: { locale: LandingLocale }) => {
	usePageTitle(
		locale === "ru"
			? "Согласие на обработку данных — Пока не забыл"
			: internationalLegalCopy[locale].consentPageTitle,
	);
	if (locale !== "ru") return <InternationalConsentPage locale={locale} />;
	return (
		<LegalPage title="Согласие на обработку персональных данных">
			<p className="legal-lead">
				Текст согласия, принимаемого пользователем при начале работы с сервисом.
			</p>
			<p>
				Я свободно, своей волей и в своём интересе даю {operator.name}, ИНН{" "}
				{operator.inn}, согласие на обработку моих персональных данных на
				условиях <a href="/privacy">Политики обработки персональных данных</a>.
			</p>
			<h2>Состав данных</h2>
			<p>
				Telegram ID, имя и username, подтверждённые адрес электронной почты или
				номер мобильного телефона, идентификаторы чатов и сообщений,
				отправленные тексты, аудиозаписи, изображения и документы, сведения о
				расходах, технические данные и сведения о тарифе, лимитах, заказах и
				платежах без реквизитов банковской карты.
			</p>
			<h2>Цели</h2>
			<p>
				Предоставление функций сервиса, автоматическое распознавание ввода,
				сохранение и отображение расходов, работа групп, поддержка,
				безопасность, исполнение договора и обработка оплаты.
			</p>
			<h2>Действия</h2>
			<p>
				Сбор, запись, систематизация, хранение, уточнение, извлечение,
				использование, передача уполномоченным обработчикам, блокирование и
				удаление с применением автоматизированных средств.
			</p>
			<h2>Срок и отзыв</h2>
			<p>
				Согласие действует до достижения целей обработки или его отзыва. Отзыв
				направляется на <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. После получения
				отзыва Оператор прекращает обработку и удаляет данные, кроме случаев,
				когда закон разрешает или требует дальнейшее хранение.
			</p>
			<p>
				Отзыв согласия может сделать невозможным дальнейшее использование
				функций, для которых обработка необходима.
			</p>
			<OperatorDetails />
		</LegalPage>
	);
};

const RefundPage = () => {
	usePageTitle("Возвраты — Пока не забыл");
	return (
		<LegalPage title="Отказ от услуги и возврат оплаты">
			<p className="legal-lead">
				Как отказаться от платного доступа или сообщить об ошибочном платеже.
			</p>
			<h2>Как обратиться</h2>
			<p>
				Напишите на <a href={`mailto:${EMAIL}`}>{EMAIL}</a> с адреса, который
				был указан при оплате, либо сообщите Telegram ID плательщика. Укажите
				номер платежа, сумму, дату и причину обращения. Не отправляйте данные
				банковской карты.
			</p>
			<h2>Как рассматривается возврат</h2>
			<p>
				Пользователь вправе отказаться от услуги в соответствии с
				законодательством Российской Федерации. При расчёте возврата учитываются
				уже оказанный объём услуги и фактически понесённые Исполнителем расходы,
				связанные с исполнением договора.
			</p>
			<p>
				При технической ошибке, двойном списании или непредоставлении
				оплаченного доступа Исполнитель проверяет платёж и возвращает подлежащую
				возврату сумму тем же способом, которым была произведена оплата, если
				иной порядок не согласован и не запрещён платёжной системой.
			</p>
			<h2>Срок ответа</h2>
			<p>
				Обращение рассматривается в сроки, установленные законодательством
				Российской Федерации. Для проверки операции Исполнитель вправе запросить
				сведения, позволяющие однозначно сопоставить обращение с платежом.
			</p>
			<OperatorDetails />
		</LegalPage>
	);
};

const PaymentStatus = ({ success }: { success: boolean }) => {
	usePageTitle(
		success
			? "Платёж принят — Пока не забыл"
			: "Платёж не завершён — Пока не забыл",
	);
	return (
		<main className="status-page">
			<div className="status-card">
				<Brand />
				<div className={`status-icon ${success ? "status-icon--success" : ""}`}>
					{success ? <Check size={32} weight="bold" /> : <Receipt size={32} />}
				</div>
				<h1>{success ? "Платёж принят" : "Платёж не завершён"}</h1>
				<p>
					{success
						? "Проверяем подтверждение платёжной системы. Новый лимит появится в боте после подтверждения."
						: "Деньги не списаны. Можно вернуться в бот и попробовать ещё раз."}
				</p>
				<a className="button button--primary" href="/app">
					Вернуться в приложение
				</a>
				<TelegramButton />
			</div>
		</main>
	);
};

const OperatorDetails = ({
	locale = "ru",
}: {
	locale?: LandingLocale;
}) => {
	const labels =
		locale === "en"
			? {
					title: "Controller details and contacts",
					operator: "Controller",
					inn: "Tax ID (INN)",
					ogrnip: "Registration number (OGRNIP)",
					address: "Registered address",
					email: "Email",
					phone: "Phone",
				}
			: locale === "es"
				? {
						title: "Datos y contacto del responsable",
						operator: "Responsable",
						inn: "Identificación fiscal (INN)",
						ogrnip: "Número de registro (OGRNIP)",
						address: "Domicilio registrado",
						email: "Correo electrónico",
						phone: "Teléfono",
					}
				: {
						title: "Реквизиты и контакты",
						operator: "Исполнитель",
						inn: "ИНН",
						ogrnip: "ОГРНИП",
						address: "Адрес",
						email: "Электронная почта",
						phone: "Телефон",
					};
	return (
		<section className="operator-details">
			<h2>{labels.title}</h2>
			<dl>
				<div>
					<dt>{labels.operator}</dt>
					<dd>{operator.name}</dd>
				</div>
				<div>
					<dt>{labels.inn}</dt>
					<dd>{operator.inn}</dd>
				</div>
				<div>
					<dt>{labels.ogrnip}</dt>
					<dd>{operator.ogrnip}</dd>
				</div>
				<div>
					<dt>{labels.address}</dt>
					<dd>{operator.address}</dd>
				</div>
				<div>
					<dt>{labels.email}</dt>
					<dd>
						<a href={`mailto:${EMAIL}`}>{EMAIL}</a>
					</dd>
				</div>
				<div>
					<dt>{labels.phone}</dt>
					<dd>
						<a href="tel:+79138078160">{PHONE}</a>
					</dd>
				</div>
			</dl>
		</section>
	);
};

const SiteFooter = ({ locale = "ru" }: { locale?: LandingLocale }) =>
	localizeLandingTree(
		<footer className="footer">
			<div className="shell footer__top">
				<div>
					<Brand inverse locale={locale} />
					<p>Приложение для учёта расходов с быстрым помощником в Telegram.</p>
				</div>
				<nav aria-label="Юридические документы">
					<a href="/offer">Оферта</a>
					<a href={legalPagePath(locale, "privacy")}>Конфиденциальность</a>
					<a href={legalPagePath(locale, "consent")}>Согласие</a>
					<a href="/refunds">Возвраты</a>
				</nav>
				<div className="footer__contacts">
					<a href={`mailto:${EMAIL}`}>{EMAIL}</a>
					<a href="tel:+79138078160">{PHONE}</a>
				</div>
			</div>
			<div className="shell footer__bottom">
				<span>© 2026 {operator.name}</span>
				<span>
					ИНН {operator.inn} · ОГРНИП {operator.ogrnip}
				</span>
			</div>
		</footer>,
		locale,
	);

const usePageTitle = (title: string) => {
	useEffect(() => {
		document.title = title;
	}, [title]);
};
