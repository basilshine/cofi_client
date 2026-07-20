import {
	Children,
	type ReactElement,
	type ReactNode,
	cloneElement,
	isValidElement,
} from "react";
import type { LandingLocale } from "./landing-locale";

export type { LandingLocale } from "./landing-locale";

export const landingLocaleFromPath = (path: string): LandingLocale => {
	if (path === "/en") return "en";
	if (path === "/es") return "es";
	return "ru";
};

export const landingHomePath = (locale: LandingLocale) =>
	locale === "ru" ? "/" : `/${locale}/`;

export const localizedLandingImage = (locale: LandingLocale, source: string) =>
	locale === "ru" ? source : source.replace("/pwa-", `/pwa-${locale}-`);

const translations: Record<
	Exclude<LandingLocale, "ru">,
	Record<string, string>
> = {
	en: {
		"Как расход проходит от ввода до сохранения":
			"How an expense moves from input to saved",
		Голос: "Voice",
		Текст: "Text",
		"Фото чека": "Receipt photo",
		"Запишите голосом": "Record by voice",
		"Скажите сумму и назначение расхода":
			"Say the amount and what the expense was for",
		"Проверьте запись": "Review the entry",
		"Приложение заполнит сумму, продавца и категорию":
			"The app fills in the amount, merchant, and category",
		"Сохраните расход": "Save the expense",
		"Подтверждённая запись появится в истории":
			"The confirmed entry appears in your history",
		"Напишите текстом": "Type it",
		"Достаточно одной обычной фразы": "One natural sentence is enough",
		"Исправьте при необходимости": "Edit if needed",
		"Все распознанные поля остаются доступными":
			"Every recognized field remains editable",
		"Подтвердите результат": "Confirm the result",
		"До подтверждения сервис ничего не решает за вас":
			"Nothing is finalized until you confirm",
		"Сфотографируйте чек": "Photograph the receipt",
		"Можно снять чек или выбрать фото из галереи":
			"Take a new photo or choose one from your gallery",
		"Сверьте позиции": "Review the line items",
		"Проверьте магазин, сумму и содержимое чека":
			"Check the merchant, amount, and receipt contents",
		"Получите готовую запись": "Get a complete entry",
		"Расход сохранится вместе с распознанными позициями":
			"The expense is saved with the recognized line items",
		"Основная навигация": "Main navigation",
		"Как это работает": "How it works",
		Приложение: "App",
		Тарифы: "Pricing",
		"Для компании": "Shared expenses",
		"Приложение для телефона": "An app for your phone",
		"Расходы, пока не забылись": "Expenses, before they slip your mind",
		"Откройте по ссылке, добавьте на экран телефона и пользуйтесь как обычным приложением. Telegram остаётся быстрым помощником.":
			"Open it from a link, add it to your home screen, and use it like any other app. Telegram remains your quick assistant.",
		"Открыть бота": "Open the bot",
		"Пример записи расхода": "Example of adding an expense",
		"Кофе и круассан 550 ₽": "Coffee and croissant ₽550",
		"Голосовое сообщение": "Voice message",
		сказал: "said it",
		проверил: "checked it",
		запомнил: "saved it",
		Расход: "Expense",
		"Кофейня · сегодня": "Coffee shop · today",
		"Приложение без магазина приложений": "An app without an app store",
		"PWA открывается по обычной ссылке, а затем добавляется на главный экран. После установки оно запускается отдельным окном и остаётся под рукой, как привычное приложение.":
			"A PWA opens from a regular link and can then be added to your home screen. Once installed, it opens in its own window and stays close at hand, just like a familiar app.",
		Откройте: "Open",
		"Нажмите «Открыть приложение» на этой странице.":
			"Tap “Open the app” on this page.",
		Добавьте: "Add it",
		"Выберите установку или добавление на главный экран.":
			"Choose Install or Add to Home Screen.",
		Пользуйтесь: "Use it",
		"Открывайте по иконке без App Store и Google Play.":
			"Launch it from its icon, without the App Store or Google Play.",
		"Главный экран приложения с расходами, планами и лимитами":
			"App home screen with expenses, plans, and limits",
		"Так приложение выглядит после установки":
			"This is how the app looks after installation",
		"Сказали. Проверили. Запомнили.": "Say it. Check it. Save it.",
		"Личный учёт расходов без таблиц, обязательных форм и попыток вспомнить всё вечером.":
			"Track personal expenses without spreadsheets, rigid forms, or trying to remember everything at night.",
		"Отправьте как удобно": "Add it your way",
		"В приложении вручную, текстом, голосом или по фото. В Telegram работают те же быстрые способы.":
			"Add it manually, by text, voice, or photo in the app. The same quick options work in Telegram.",
		"Проверьте детали": "Check the details",
		"Сумму, магазин, дату и категорию можно поправить до сохранения.":
			"You can adjust the amount, merchant, date, and category before saving.",
		"Продолжайте свои дела": "Get on with your day",
		"Подтверждённый расход появится в истории и сводках.":
			"The confirmed expense appears in your history and summaries.",
		"Сервис не решает за вас": "You stay in control",
		"Он предлагает готовую запись. Вы подтверждаете её, исправляете или отменяете.":
			"The service prepares an entry. You confirm, edit, or cancel it.",
		"Принимает голос, текст и фото чека":
			"Accepts voice, text, and receipt photos",
		"Показывает сумму, позиции и категорию":
			"Shows the amount, line items, and category",
		"Сохраняет только после подтверждения":
			"Saves only after your confirmation",
		"Больше, чем список расходов": "More than an expense list",
		"Приложение собирает историю, планы, лимиты и общие расходы в одном месте. Нужное находится за несколько касаний.":
			"The app brings history, plans, limits, and shared expenses together. Everything you need is a few taps away.",
		"История и поиск": "History and search",
		"Ищите по покупке, магазину, категории или #тегу.":
			"Search by purchase, merchant, category, or #tag.",
		"Лимиты по категориям": "Category limits",
		"Следите за неделей или месяцем и получайте предупреждения.":
			"Keep an eye on the week or month and get alerts.",
		"Планы покупок": "Purchase plans",
		"Собирайте списки, суммы и даты, затем отмечайте купленное.":
			"Build lists with amounts and dates, then mark items as bought.",
		"Личное и общее": "Personal and shared",
		"Переключайте пространства и получайте уведомления из каждого.":
			"Switch between spaces and receive notifications from each one.",
		"Меню личного и семейного пространства": "Personal and family space menu",
		"Личное и семейное рядом": "Personal and family, side by side",
		"Экран планов покупок со списками, суммами и датами":
			"Purchase plans screen with lists, amounts, and dates",
		"Планы превращаются в расходы": "Plans turn into expenses",
		"Единый список уведомлений из личного и семейного пространства":
			"A single notification list for personal and family spaces",
		"Уведомления из всех пространств": "Notifications from every space",
		"Тарифы без скрытых функций": "Straightforward pricing",
		"Начните бесплатно. Платите, когда умных добавлений нужно больше.":
			"Start free. Pay when you need more smart entries.",
		"История, ручной ввод, редактирование и доступ к своим данным остаются доступны на обоих тарифах.":
			"History, manual entry, editing, and access to your data remain available on both plans.",
		Базовый: "Basic",
		"Без подписки": "No subscription",
		"Для знакомства с сервисом и спокойного ручного учёта.":
			"For getting started and simple manual tracking.",
		"20 приветственных разборов один раз": "20 welcome smart entries, one time",
		"Все способы добавления расхода": "Every way to add an expense",
		"15 стандартных, 3 своих категории и 3 лимита":
			"15 standard categories, 3 custom categories, and 3 limits",
		"10 активных планов покупок": "10 active purchase plans",
		"Личное и ещё одно своё пространство":
			"Your personal space plus one more space",
		"Фото и голос хранятся 3 дня": "Photos and voice are stored for 3 days",
		"Начать с Базового": "Start with Basic",
		Плюс: "Plus",
		"/ 30 дней": "/ 30 days",
		"Для регулярного учёта": "For regular tracking",
		"Больше умных добавлений, планов и пространства для семейных сценариев.":
			"More smart entries, plans, and room for family scenarios.",
		"400 разборов на оплаченный период": "400 smart entries per paid period",
		"До 100 своих категорий и лимитов":
			"Up to 100 custom categories and limits",
		"До 100 активных планов покупок": "Up to 100 active purchase plans",
		"До 10 своих пространств": "Up to 10 spaces of your own",
		"Фото и голос хранятся 30 дней": "Photos and voice are stored for 30 days",
		"Пакеты разборов дешевле": "Discounted smart-entry packs",
		"Подключить Плюс": "Get Plus",
		"Разборы не сгорают вместе с подпиской":
			"Purchased entries do not expire with your subscription",
		"Можно просто докупить пакет": "You can simply add a pack",
		"Пакет не меняет тариф и дату продления. Сначала расходуется лимит Плюс, затем приветственный и купленный остаток.":
			"A pack does not change your plan or renewal date. Your Plus allowance is used first, followed by welcome and purchased entries.",
		"Стоимость пакетов": "Pack pricing",
		"99 ₽ на Базовом": "₽99 on Basic",
		"79 ₽ с Плюс": "₽79 with Plus",
		"399 ₽ на Базовом": "₽399 on Basic",
		"299 ₽ с Плюс": "₽299 with Plus",
		"899 ₽ на Базовом": "₽899 on Basic",
		"699 ₽ с Плюс": "₽699 with Plus",
		"Разбор списывается только за успешный результат: текст стоит 1, голос 2, фото 3, большой чек 5, оценка предмета по фото 10. Ручной ввод разборы не расходует.":
			"An entry is charged only for a successful result: text costs 1, voice 2, a photo 3, a large receipt 5, and photo item estimation 10. Manual entry uses no allowance.",
		"Разделите общий расход": "Split a shared expense",
		"Выберите расход и участников. Приложение посчитает доли и покажет, кто кому должен.":
			"Choose an expense and the participants. The app calculates each share and shows who owes whom.",
		"Разделение общего расхода в приложении":
			"Splitting a shared expense in the app",
		"Общий расход с долями участников":
			"A shared expense with participant shares",
		"Откройте общий расход": "Open the shared expense",
		"Распределение суммы между участниками":
			"Distributing the amount among participants",
		"Распределите доли": "Assign the shares",
		"Итог разделения с суммой долга": "Split result with the amount owed",
		"Посмотрите, кто кому должен": "See who owes whom",
		"Коротко о важном": "The essentials",
		"До первого расхода": "Before your first expense",
		"Что такое PWA и нужно ли что-то скачивать?":
			"What is a PWA, and do I need to download anything?",
		"PWA означает устанавливаемое веб-приложение. Откройте его по ссылке и добавьте на главный экран. Оно запускается отдельно и не требует App Store или Google Play.":
			"A PWA is an installable web app. Open it from a link and add it to your home screen. It runs in its own window and does not require the App Store or Google Play.",
		"Бот сам сохраняет всё без проверки?":
			"Does the bot save everything without review?",
		"Нет. Он предлагает разобранный расход, а вы подтверждаете или исправляете результат.":
			"No. It prepares the expense, and you confirm or edit the result.",
		"Что останется доступно без Плюс?": "What remains available without Plus?",
		"История расходов, ручное добавление, редактирование и доступ к данным не блокируются. Ограничения действуют на новые умные разборы и создание новых категорий, лимитов, планов и пространств.":
			"Expense history, manual entry, editing, and access to your data remain available. Limits apply to new smart entries and to creating new categories, limits, plans, and spaces.",
		"Купленные пакеты пропадут после окончания Плюс?":
			"Do purchased packs disappear when Plus ends?",
		"Нет. Купленный остаток хранится отдельно. Пакет не продлевает подписку и остаётся доступным после её окончания.":
			"No. Your purchased balance is stored separately. A pack does not extend the subscription and remains available after it ends.",
		"Можно пользоваться только лично?": "Can I use it just for myself?",
		"Да. Общие пространства и разделение расходов подключаются только когда нужны. Приложение посчитает доли и покажет, кто кому должен.":
			"Yes. Shared spaces and expense splitting are there only when you need them. The app calculates each share and shows who owes whom.",
		"Где хранятся данные и чеки?": "Where are data and receipts stored?",
		"Основные данные и исходные файлы российского запуска размещаются на инфраструктуре в России.":
			"Core data and source files for the Russian service are hosted on infrastructure in Russia.",
		"Покупка уже случилась.": "The purchase already happened.",
		"Запишите, пока не забыли.": "Save it before you forget.",
		"Приложение для учёта расходов с быстрым помощником в Telegram.":
			"An expense-tracking app with a fast Telegram assistant.",
		"Юридические документы": "Legal documents in Russian",
		Оферта: "Terms (RU)",
		Конфиденциальность: "Privacy (RU)",
		Согласие: "Consent (RU)",
		Возвраты: "Refunds (RU)",
		ИНН: "Tax ID",
		ОГРНИП: "Sole proprietor ID",
		"· ОГРНИП": "· Sole proprietor ID",
	},
	es: {
		"Как расход проходит от ввода до сохранения":
			"Cómo pasa un gasto desde la entrada hasta guardarse",
		Голос: "Voz",
		Текст: "Texto",
		"Фото чека": "Foto del recibo",
		"Запишите голосом": "Grábalo por voz",
		"Скажите сумму и назначение расхода":
			"Di el importe y para qué fue el gasto",
		"Проверьте запись": "Revisa el registro",
		"Приложение заполнит сумму, продавца и категорию":
			"La aplicación completa el importe, comercio y categoría",
		"Сохраните расход": "Guarda el gasto",
		"Подтверждённая запись появится в истории":
			"El registro confirmado aparece en tu historial",
		"Напишите текстом": "Escríbelo",
		"Достаточно одной обычной фразы": "Una frase natural es suficiente",
		"Исправьте при необходимости": "Corrige si hace falta",
		"Все распознанные поля остаются доступными":
			"Todos los campos reconocidos se pueden editar",
		"Подтвердите результат": "Confirma el resultado",
		"До подтверждения сервис ничего не решает за вас":
			"Nada queda decidido hasta que lo confirmes",
		"Сфотографируйте чек": "Fotografía el recibo",
		"Можно снять чек или выбрать фото из галереи":
			"Haz una foto o elige una de la galería",
		"Сверьте позиции": "Revisa los artículos",
		"Проверьте магазин, сумму и содержимое чека":
			"Comprueba el comercio, el importe y el contenido del recibo",
		"Получите готовую запись": "Obtén un registro completo",
		"Расход сохранится вместе с распознанными позициями":
			"El gasto se guarda con los artículos reconocidos",
		"Основная навигация": "Navegación principal",
		"Как это работает": "Cómo funciona",
		Приложение: "Aplicación",
		Тарифы: "Precios",
		"Для компании": "Gastos compartidos",
		"Приложение для телефона": "Una aplicación para tu móvil",
		"Расходы, пока не забылись": "Tus gastos, antes de que se te olviden",
		"Откройте по ссылке, добавьте на экран телефона и пользуйтесь как обычным приложением. Telegram остаётся быстрым помощником.":
			"Ábrela desde un enlace, añádela a la pantalla de inicio y úsala como cualquier otra aplicación. Telegram sigue siendo tu asistente rápido.",
		"Открыть бота": "Abrir el bot",
		"Пример записи расхода": "Ejemplo de cómo añadir un gasto",
		"Кофе и круассан 550 ₽": "Café y cruasán, 550 ₽",
		"Голосовое сообщение": "Mensaje de voz",
		сказал: "lo dijiste",
		проверил: "lo revisaste",
		запомнил: "se guardó",
		Расход: "Gasto",
		"Кофейня · сегодня": "Cafetería · hoy",
		"Приложение без магазина приложений":
			"Una aplicación sin tienda de aplicaciones",
		"PWA открывается по обычной ссылке, а затем добавляется на главный экран. После установки оно запускается отдельным окном и остаётся под рукой, как привычное приложение.":
			"Una PWA se abre desde un enlace normal y después se añade a la pantalla de inicio. Una vez instalada, se abre en su propia ventana y está siempre a mano, como cualquier aplicación.",
		Откройте: "Ábrela",
		"Нажмите «Открыть приложение» на этой странице.":
			"Pulsa “Abrir la aplicación” en esta página.",
		Добавьте: "Añádela",
		"Выберите установку или добавление на главный экран.":
			"Elige Instalar o Añadir a la pantalla de inicio.",
		Пользуйтесь: "Úsala",
		"Открывайте по иконке без App Store и Google Play.":
			"Ábrela desde su icono, sin App Store ni Google Play.",
		"Главный экран приложения с расходами, планами и лимитами":
			"Pantalla principal con gastos, planes y límites",
		"Так приложение выглядит после установки":
			"Así se ve la aplicación después de instalarla",
		"Сказали. Проверили. Запомнили.": "Dilo. Revísalo. Guárdalo.",
		"Личный учёт расходов без таблиц, обязательных форм и попыток вспомнить всё вечером.":
			"Controla tus gastos sin hojas de cálculo, formularios rígidos ni intentar recordarlo todo por la noche.",
		"Отправьте как удобно": "Añádelo como prefieras",
		"В приложении вручную, текстом, голосом или по фото. В Telegram работают те же быстрые способы.":
			"Añádelo manualmente, por texto, voz o foto en la aplicación. En Telegram funcionan las mismas opciones rápidas.",
		"Проверьте детали": "Revisa los detalles",
		"Сумму, магазин, дату и категорию можно поправить до сохранения.":
			"Puedes corregir el importe, comercio, fecha y categoría antes de guardar.",
		"Продолжайте свои дела": "Sigue con tu día",
		"Подтверждённый расход появится в истории и сводках.":
			"El gasto confirmado aparecerá en el historial y los resúmenes.",
		"Сервис не решает за вас": "Tú mantienes el control",
		"Он предлагает готовую запись. Вы подтверждаете её, исправляете или отменяете.":
			"El servicio prepara un registro. Tú lo confirmas, corriges o cancelas.",
		"Принимает голос, текст и фото чека":
			"Acepta voz, texto y fotos de recibos",
		"Показывает сумму, позиции и категорию":
			"Muestra el importe, los artículos y la categoría",
		"Сохраняет только после подтверждения":
			"Solo guarda después de tu confirmación",
		"Больше, чем список расходов": "Mucho más que una lista de gastos",
		"Приложение собирает историю, планы, лимиты и общие расходы в одном месте. Нужное находится за несколько касаний.":
			"La aplicación reúne historial, planes, límites y gastos compartidos. Todo está a unos pocos toques.",
		"История и поиск": "Historial y búsqueda",
		"Ищите по покупке, магазину, категории или #тегу.":
			"Busca por compra, comercio, categoría o #etiqueta.",
		"Лимиты по категориям": "Límites por categoría",
		"Следите за неделей или месяцем и получайте предупреждения.":
			"Controla la semana o el mes y recibe avisos.",
		"Планы покупок": "Planes de compra",
		"Собирайте списки, суммы и даты, затем отмечайте купленное.":
			"Crea listas con importes y fechas, y marca lo que ya compraste.",
		"Личное и общее": "Personal y compartido",
		"Переключайте пространства и получайте уведомления из каждого.":
			"Cambia de espacio y recibe notificaciones de cada uno.",
		"Меню личного и семейного пространства":
			"Menú de espacios personal y familiar",
		"Личное и семейное рядом": "Lo personal y lo familiar, juntos",
		"Экран планов покупок со списками, суммами и датами":
			"Pantalla de planes con listas, importes y fechas",
		"Планы превращаются в расходы": "Los planes se convierten en gastos",
		"Единый список уведомлений из личного и семейного пространства":
			"Una lista de notificaciones para los espacios personal y familiar",
		"Уведомления из всех пространств": "Notificaciones de todos los espacios",
		"Тарифы без скрытых функций": "Precios claros",
		"Начните бесплатно. Платите, когда умных добавлений нужно больше.":
			"Empieza gratis. Paga cuando necesites más registros inteligentes.",
		"История, ручной ввод, редактирование и доступ к своим данным остаются доступны на обоих тарифах.":
			"El historial, la entrada manual, la edición y el acceso a tus datos siguen disponibles en ambos planes.",
		Базовый: "Básico",
		"Без подписки": "Sin suscripción",
		"Для знакомства с сервисом и спокойного ручного учёта.":
			"Para empezar y llevar un control manual sencillo.",
		"20 приветственных разборов один раз":
			"20 registros inteligentes de bienvenida, una sola vez",
		"Все способы добавления расхода": "Todas las formas de añadir un gasto",
		"15 стандартных, 3 своих категории и 3 лимита":
			"15 categorías estándar, 3 propias y 3 límites",
		"10 активных планов покупок": "10 planes de compra activos",
		"Личное и ещё одно своё пространство":
			"Tu espacio personal y otro espacio propio",
		"Фото и голос хранятся 3 дня": "Las fotos y la voz se guardan 3 días",
		"Начать с Базового": "Empezar con Básico",
		Плюс: "Plus",
		"/ 30 дней": "/ 30 días",
		"Для регулярного учёта": "Para un control habitual",
		"Больше умных добавлений, планов и пространства для семейных сценариев.":
			"Más registros inteligentes, planes y espacio para situaciones familiares.",
		"400 разборов на оплаченный период":
			"400 registros inteligentes por periodo pagado",
		"До 100 своих категорий и лимитов":
			"Hasta 100 categorías y límites propios",
		"До 100 активных планов покупок": "Hasta 100 planes de compra activos",
		"До 10 своих пространств": "Hasta 10 espacios propios",
		"Фото и голос хранятся 30 дней": "Las fotos y la voz se guardan 30 días",
		"Пакеты разборов дешевле": "Paquetes con descuento",
		"Подключить Плюс": "Activar Plus",
		"Разборы не сгорают вместе с подпиской":
			"Los registros comprados no caducan con la suscripción",
		"Можно просто докупить пакет": "También puedes comprar un paquete",
		"Пакет не меняет тариф и дату продления. Сначала расходуется лимит Плюс, затем приветственный и купленный остаток.":
			"Un paquete no cambia tu plan ni la fecha de renovación. Primero se usa la cuota de Plus y después los registros de bienvenida y comprados.",
		"Стоимость пакетов": "Precios de los paquetes",
		"99 ₽ на Базовом": "99 ₽ con Básico",
		"79 ₽ с Плюс": "79 ₽ con Plus",
		"399 ₽ на Базовом": "399 ₽ con Básico",
		"299 ₽ с Плюс": "299 ₽ con Plus",
		"899 ₽ на Базовом": "899 ₽ con Básico",
		"699 ₽ с Плюс": "699 ₽ con Plus",
		"Разбор списывается только за успешный результат: текст стоит 1, голос 2, фото 3, большой чек 5, оценка предмета по фото 10. Ручной ввод разборы не расходует.":
			"Solo se descuenta por un resultado correcto: texto 1, voz 2, foto 3, recibo grande 5 y estimación de un artículo por foto 10. La entrada manual no consume registros.",
		"Разделите общий расход": "Divide un gasto compartido",
		"Выберите расход и участников. Приложение посчитает доли и покажет, кто кому должен.":
			"Elige el gasto y los participantes. La aplicación calcula cada parte y muestra quién debe a quién.",
		"Разделение общего расхода в приложении":
			"División de un gasto compartido en la aplicación",
		"Общий расход с долями участников":
			"Gasto compartido con las partes de cada participante",
		"Откройте общий расход": "Abre el gasto compartido",
		"Распределение суммы между участниками":
			"Distribución del importe entre participantes",
		"Распределите доли": "Reparte las partes",
		"Итог разделения с суммой долга":
			"Resultado de la división con el importe adeudado",
		"Посмотрите, кто кому должен": "Comprueba quién debe a quién",
		"Коротко о важном": "Lo esencial",
		"До первого расхода": "Antes de tu primer gasto",
		"Что такое PWA и нужно ли что-то скачивать?":
			"¿Qué es una PWA y tengo que descargar algo?",
		"PWA означает устанавливаемое веб-приложение. Откройте его по ссылке и добавьте на главный экран. Оно запускается отдельно и не требует App Store или Google Play.":
			"Una PWA es una aplicación web instalable. Ábrela desde un enlace y añádela a la pantalla de inicio. Funciona en su propia ventana y no necesita App Store ni Google Play.",
		"Бот сам сохраняет всё без проверки?":
			"¿El bot guarda todo sin que lo revise?",
		"Нет. Он предлагает разобранный расход, а вы подтверждаете или исправляете результат.":
			"No. Prepara el gasto y tú confirmas o corriges el resultado.",
		"Что останется доступно без Плюс?": "¿Qué seguirá disponible sin Plus?",
		"История расходов, ручное добавление, редактирование и доступ к данным не блокируются. Ограничения действуют на новые умные разборы и создание новых категорий, лимитов, планов и пространств.":
			"El historial, la entrada manual, la edición y el acceso a tus datos siguen disponibles. Los límites se aplican a nuevos registros inteligentes y a la creación de categorías, límites, planes y espacios.",
		"Купленные пакеты пропадут после окончания Плюс?":
			"¿Desaparecen los paquetes comprados cuando termina Plus?",
		"Нет. Купленный остаток хранится отдельно. Пакет не продлевает подписку и остаётся доступным после её окончания.":
			"No. El saldo comprado se guarda por separado. Un paquete no amplía la suscripción y sigue disponible cuando esta termina.",
		"Можно пользоваться только лично?": "¿Puedo usarlo solo para mí?",
		"Да. Общие пространства и разделение расходов подключаются только когда нужны. Приложение посчитает доли и покажет, кто кому должен.":
			"Sí. Los espacios compartidos y la división de gastos están ahí solo cuando los necesitas. La aplicación calcula cada parte y muestra quién debe a quién.",
		"Где хранятся данные и чеки?": "¿Dónde se guardan los datos y recibos?",
		"Основные данные и исходные файлы российского запуска размещаются на инфраструктуре в России.":
			"Los datos principales y los archivos originales del servicio ruso se alojan en infraestructura situada en Rusia.",
		"Покупка уже случилась.": "La compra ya ocurrió.",
		"Запишите, пока не забыли.": "Guárdala antes de olvidarla.",
		"Приложение для учёта расходов с быстрым помощником в Telegram.":
			"Una aplicación para controlar gastos con un asistente rápido en Telegram.",
		"Юридические документы": "Documentos legales en ruso",
		Оферта: "Condiciones (RU)",
		Конфиденциальность: "Privacidad (RU)",
		Согласие: "Consentimiento (RU)",
		Возвраты: "Reembolsos (RU)",
		ИНН: "NIF",
		ОГРНИП: "Registro de empresario individual",
		"· ОГРНИП": "· Registro de empresario individual",
	},
};

export const landingText = (locale: LandingLocale, russian: string) =>
	locale === "ru" ? russian : translations[locale][russian] || russian;

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

export const localizeLandingTree = (
	node: ReactNode,
	locale: LandingLocale,
): ReactNode => {
	if (locale === "ru" || node === null || node === undefined) return node;
	if (typeof node === "string") {
		const normalized = normalize(node);
		return normalized ? landingText(locale, normalized) : node;
	}
	if (!isValidElement(node)) return node;

	const element = node as ReactElement<Record<string, unknown>>;
	const nextProps: Record<string, unknown> = {};
	for (const attribute of ["aria-label", "alt", "title"] as const) {
		const value = element.props[attribute];
		if (typeof value === "string")
			nextProps[attribute] = landingText(locale, value);
	}
	const source = element.props.src;
	if (typeof source === "string" && source.startsWith("/pwa-")) {
		nextProps.src = localizedLandingImage(locale, source);
	}
	if (element.props.children !== undefined) {
		nextProps.children = Children.map(
			element.props.children as ReactNode,
			(child) => localizeLandingTree(child, locale),
		);
	}
	return cloneElement(element, nextProps);
};

export const landingSeo = {
	ru: {
		title: "Приложение для учёта расходов | Пока не забыл",
		description:
			"Приложение для расходов: история, лимиты, планы, общие пространства и разделение трат между участниками. Работает без магазина приложений.",
	},
	en: {
		title: "Expense tracker app | Пока не забыл",
		description:
			"Track expenses by text, voice, or receipt photo. Set category limits, plan purchases, share spaces, and split costs from an installable web app.",
	},
	es: {
		title: "Aplicación para controlar gastos | Пока не забыл",
		description:
			"Registra gastos por texto, voz o foto del recibo. Crea límites, planea compras, comparte espacios y divide gastos desde una aplicación web instalable.",
	},
} as const;
