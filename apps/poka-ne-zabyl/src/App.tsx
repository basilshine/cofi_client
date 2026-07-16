import {
	ArrowRight,
	CalendarCheck,
	ChatCircleText,
	Check,
	Microphone,
	Paperclip,
	Receipt,
	TelegramLogo,
	UsersThree,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { Suspense, lazy, useEffect } from "react";

const MiniApp = lazy(async () => {
	const module = await import("./MiniApp");
	return { default: module.MiniApp };
});

const TELEGRAM_URL = "https://t.me/poka_ne_zabyl_bot";
const EMAIL = "support@poka-ne-zabyl.ru";
const PHONE = "+7 913 807-81-60";
const EFFECTIVE_DATE = "13 июля 2026 года";

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
			return (
				<Suspense fallback={null}>
					<MiniApp />
				</Suspense>
			);
		case "/offer":
			return <OfferPage />;
		case "/privacy":
			return <PrivacyPage />;
		case "/consent":
			return <ConsentPage />;
		case "/refunds":
			return <RefundPage />;
		case "/payment/success":
			return <PaymentStatus success />;
		case "/payment/failed":
			return <PaymentStatus success={false} />;
		default:
			return <LandingPage />;
	}
};

const BrandMark = () => (
	<svg aria-hidden="true" viewBox="0 0 44 44">
		<path d="M21 22C7 20 5 12 10 10c5-2 11 5 11 12Z" />
		<path d="M21 22C16 8 20 3 24 6c4 3 1 11-3 16Z" />
		<path d="M21 22c-2 14 4 18 7 13 2-4-2-10-7-13Z" />
		<path d="m21 22 8 8L41 12" className="brand__check" />
		<circle cx="21" cy="22" r="2.4" />
	</svg>
);

const Brand = ({ inverse = false }: { inverse?: boolean }) => (
	<a className={`brand ${inverse ? "brand--inverse" : ""}`} href="/">
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

const captureStories = [
	{
		type: "voice",
		label: "Голосом",
		prompt: "Кофе и круассан, 550 рублей",
		title: "Кофейня",
		amount: "550 ₽",
		detail: "Еда · сегодня",
		offset: "0s",
	},
	{
		type: "text",
		label: "Текстом",
		prompt: "Такси 780 ₽ домой",
		title: "Такси",
		amount: "780 ₽",
		detail: "Транспорт · сегодня",
		offset: "-12s",
	},
	{
		type: "photo",
		label: "Фото чека",
		prompt: "Чек из магазина",
		title: "Пятёрочка",
		amount: "2 840 ₽",
		detail: "Продукты · сегодня",
		offset: "-6s",
	},
] as const;

const CaptureStory = () => (
	<div className="capture-story" aria-label="Три способа записать расход">
		{captureStories.map((story) => (
			<div
				aria-hidden="true"
				className={`story-scene capture-scene capture-scene--${story.type}`}
				key={story.type}
				style={{ "--scene-offset": story.offset } as CSSProperties}
			>
				<div className="capture-source">
					<span className="capture-source__label">{story.label}</span>
					{story.type === "voice" && (
						<>
							<div className="comic-bubble">
								<span>{story.prompt}</span>
							</div>
							<div className="story-composer story-composer--voice">
								<Microphone size={22} weight="fill" />
								<div className="story-wave" aria-hidden="true">
									{voiceBars.slice(0, 11).map((bar) => (
										<i key={bar.id} style={{ height: bar.height }} />
									))}
								</div>
								<time>0:04</time>
							</div>
						</>
					)}
					{story.type === "text" && (
						<div className="story-composer">
							<Paperclip size={21} />
							<span className="typed-line">{story.prompt}</span>
							<span className="composer-send-dot" />
						</div>
					)}
					{story.type === "photo" && (
						<div className="story-photo">
							<div>
								<Receipt size={48} weight="light" />
								<span>2 840 ₽</span>
							</div>
							<p>
								<Paperclip size={18} /> {story.prompt}
							</p>
						</div>
					)}
				</div>
				<div className="capture-result">
					<div className="capture-result__top">
						<span>
							<Check size={16} weight="bold" /> Распознано
						</span>
						<small>{story.label}</small>
					</div>
					<p>{story.title}</p>
					<strong>{story.amount}</strong>
					<span>{story.detail}</span>
					<span className="capture-result__action">Проверить и сохранить</span>
				</div>
			</div>
		))}
	</div>
);

const sharedStories = [
	{
		name: "Маша",
		first: "Билеты 12 400, на двоих",
		secondName: "Антон",
		second: "Да, делим поровну",
		result: "По 6 200 ₽ каждому",
		offset: "0s",
	},
	{
		name: "Дима",
		first: "Ужин 4 800, я оплатил",
		secondName: "Лена",
		second: "Нас было четверо",
		result: "По 1 200 ₽ с человека",
		offset: "-12s",
	},
	{
		name: "Оля",
		first: "Подарок маме 9 000",
		secondName: "Саша",
		second: "Запиши 4 000 на меня",
		result: "Оля 5 000 ₽ · Саша 4 000 ₽",
		offset: "-6s",
	},
] as const;

const SharedStory = () => (
	<div className="shared-story" data-reveal aria-label="Примеры общих расходов">
		{sharedStories.map((story) => (
			<div
				aria-hidden="true"
				className="story-scene shared-scene"
				key={story.first}
				style={{ "--scene-offset": story.offset } as CSSProperties}
			>
				<p>
					<b>{story.name}</b>
					<span>{story.first}</span>
				</p>
				<p>
					<b>{story.secondName}</b>
					<span>{story.second}</span>
				</p>
				<div className="shared-result">
					<span>
						<Check size={17} weight="bold" /> Пока не забыл
					</span>
					<strong>{story.result}</strong>
					<small>Добавлено в общие расходы</small>
				</div>
			</div>
		))}
	</div>
);

const LandingPage = () => {
	usePageTitle("Приложение и Telegram-бот для учёта расходов — Пока не забыл");
	useEffect(() => {
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

	return (
		<main className="landing-page">
			<section className="hero">
				<header className="hero__nav shell">
					<Brand />
					<nav aria-label="Основная навигация">
						<a href="#how">Как это работает</a>
						<a href="#mini-app">Приложение</a>
						<a href="#pricing">Тарифы</a>
						<a href="#shared">Для компании</a>
						<TelegramButton />
					</nav>
				</header>
				<div className="hero__stage shell">
					<div className="hero__copy">
						<p className="hero__kicker">PWA-приложение и Telegram-бот</p>
						<h1>
							Расходы,
							<br />
							пока не забылись
						</h1>
						<p className="hero__lead">
							Записывайте расходы в приложении или отправляйте боту текст,
							голосовое или фото чека. Проверяйте данные перед сохранением.
						</p>
						<div className="hero__actions">
							<TelegramButton />
							<a className="text-link" href="/app">
								Открыть приложение <ArrowRight size={18} />
							</a>
						</div>
						<p className="hero__trust">
							Открывается в браузере, устанавливается на телефон и работает в
							Telegram
						</p>
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

			<section className="steps-section" id="how">
				<div className="shell" data-reveal>
					<div className="section-heading">
						<p className="section-label">Три коротких шага</p>
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
								В приложении вручную — или текст, голосовое и фото чека в
								Telegram.
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
						<p className="section-label">Сначала проверка</p>
						<h2>Бот не решает за вас</h2>
						<p>
							Он предлагает готовую запись. Вы подтверждаете её, исправляете или
							отменяете.
						</p>
						<ul>
							<li>
								<Check size={18} /> Показывает, что распознал
							</li>
							<li>
								<Check size={18} /> Не прячет сумму и категорию
							</li>
							<li>
								<Check size={18} /> Сохраняет только после подтверждения
							</li>
						</ul>
					</div>
					<CaptureStory />
				</div>
			</section>

			<section className="miniapp-section" id="mini-app">
				<div className="shell miniapp-layout">
					<div className="miniapp-copy" data-reveal>
						<p className="section-label">Приложение в браузере и Telegram</p>
						<h2>Расходы, лимиты и планы. Всё видно.</h2>
						<p>
							Откройте его в браузере, установите на телефон или запустите из
							бота: посмотрите месяц, проверьте лимиты и сохраните будущие
							покупки.
						</p>
						<div className="limit-promise">
							<CalendarCheck size={28} weight="light" />
							<div>
								<strong>Порядок сейчас и на будущее</strong>
								<span>
									Лимиты помогают не выйти за рамки, а планы сохраняют будущие
									покупки отдельно от расходов.
								</span>
							</div>
						</div>
						<ul className="miniapp-points">
							<li>
								<Check size={17} weight="bold" /> Проверка распознанных расходов
							</li>
							<li>
								<Check size={17} weight="bold" /> История, категории и лимиты
							</li>
							<li>
								<Check size={17} weight="bold" /> Отметьте «Куплено», когда план
								станет расходом
							</li>
						</ul>
					</div>

					<div className="app-showcase" data-reveal>
						<figure className="app-shot app-shot--plans">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Экран планов покупок с датами, суммами и действием Куплено"
								decoding="async"
								height="1040"
								loading="lazy"
								src="/mini-app-plans.png"
								width="520"
							/>
							<figcaption>Планы с датой и без даты</figcaption>
						</figure>
						<figure className="app-shot app-shot--overview">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Главный экран приложения с расходами, кандидатами, планами и лимитами"
								decoding="async"
								height="1040"
								loading="lazy"
								src="/mini-app-overview.png"
								width="520"
							/>
							<figcaption>Главная со всем важным на сегодня</figcaption>
						</figure>
						<figure className="app-shot app-shot--plus">
							<div className="app-shot__speaker" aria-hidden="true" />
							<img
								alt="Профиль приложения с тарифом, остатком разборов и подключением Плюс"
								decoding="async"
								height="1040"
								loading="lazy"
								src="/mini-app-plus.png"
								width="520"
							/>
							<figcaption>Тариф и остатки всегда перед глазами</figcaption>
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
							<a className="pricing-plan__action" href="/app">
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
							<a className="pricing-plan__action" href="/app?view=profile">
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
						<h2>
							Личные расходы.
							<br />И общие — когда нужны.
						</h2>
						<p>
							Личный учёт остаётся простым. Общие расходы подключаются только
							когда нужны.
						</p>
					</div>
					<SharedStory />
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
							<summary>Приложение работает только внутри Telegram?</summary>
							<p>
								Нет. Его можно открыть в обычном браузере и установить на
								телефон как PWA. Telegram-бот остаётся быстрым способом
								записывать расходы.
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
								Да. Групповой чат и общие расходы — дополнительный сценарий, а
								не обязательное условие.
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
					<TelegramButton light />
				</div>
			</section>

			<SiteFooter />
		</main>
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

const LegalHeader = () => (
	<header className="legal-header shell">
		<Brand />
		<a
			className="text-link"
			href={TELEGRAM_URL}
			rel="noreferrer"
			target="_blank"
		>
			Telegram <ArrowRight size={17} />
		</a>
	</header>
);

const LegalPage = ({
	title,
	children,
}: { title: string; children: React.ReactNode }) => (
	<main className="legal-page">
		<LegalHeader />
		<article className="legal-document shell">
			<p className="section-label">Действует с {EFFECTIVE_DATE}</p>
			<h1>{title}</h1>
			{children}
		</article>
		<SiteFooter />
	</main>
);

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
				Telegram-бота и веб-приложение. Сервис помогает принимать текст,
				голосовые сообщения и изображения, добавлять расходы вручную, хранить
				подтверждённые записи и показывать историю, лимиты и планы.
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
				приветственный набор из 20 разборов. Он не начисляется повторно. Тариф
				«Плюс» стоит 249 рублей, действует 30 календарных дней с момента
				активации и включает 400 разборов на оплаченный период, а также
				расширенные лимиты продукта.
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

const PrivacyPage = () => {
	usePageTitle("Политика конфиденциальности — Пока не забыл");
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
				Данные используются для регистрации, связи аккаунта с Telegram и
				подтверждённой электронной почтой, входа в браузерное приложение,
				распознавания пользовательского ввода, сохранения расходов, работы
				групповых сценариев, поддержки, обеспечения безопасности, исполнения
				договора, платежей и соблюдения закона.
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
				Для работы используются Telegram как канал взаимодействия, Robokassa для
				оплаты, российские поставщики хостинга и хранения, а также поставщики
				технологий распознавания. Им передаётся только объём данных, необходимый
				для соответствующей операции.
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

const ConsentPage = () => {
	usePageTitle("Согласие на обработку данных — Пока не забыл");
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
				Telegram ID, имя и username, подтверждённый адрес электронной почты,
				идентификаторы чатов и сообщений, отправленные тексты, аудиозаписи,
				изображения и документы, сведения о расходах, технические данные и
				сведения о заказах и платежах без реквизитов банковской карты.
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

const OperatorDetails = () => (
	<section className="operator-details">
		<h2>Реквизиты и контакты</h2>
		<dl>
			<div>
				<dt>Исполнитель</dt>
				<dd>{operator.name}</dd>
			</div>
			<div>
				<dt>ИНН</dt>
				<dd>{operator.inn}</dd>
			</div>
			<div>
				<dt>ОГРНИП</dt>
				<dd>{operator.ogrnip}</dd>
			</div>
			<div>
				<dt>Адрес</dt>
				<dd>{operator.address}</dd>
			</div>
			<div>
				<dt>Электронная почта</dt>
				<dd>
					<a href={`mailto:${EMAIL}`}>{EMAIL}</a>
				</dd>
			</div>
			<div>
				<dt>Телефон</dt>
				<dd>
					<a href="tel:+79138078160">{PHONE}</a>
				</dd>
			</div>
		</dl>
	</section>
);

const SiteFooter = () => (
	<footer className="footer">
		<div className="shell footer__top">
			<div>
				<Brand inverse />
				<p>Простой учёт расходов в приложении и Telegram.</p>
			</div>
			<nav aria-label="Юридические документы">
				<a href="/offer">Оферта</a>
				<a href="/privacy">Конфиденциальность</a>
				<a href="/consent">Согласие</a>
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
	</footer>
);

const usePageTitle = (title: string) => {
	useEffect(() => {
		document.title = title;
	}, [title]);
};
