const COUNTER_ID = 110761833;
const TAG_URL = "https://mc.yandex.ru/metrika/tag.js";

type YandexMetrika = ((
	counter: number,
	method: string,
	...args: unknown[]
) => void) & {
	a?: unknown[][];
	l?: number;
};

type MetrikaWindow = Window & {
	ym?: YandexMetrika;
};

export type MetrikaGoal =
	| "landing_app_click"
	| "app_open"
	| "registration"
	| "first_expense";

export const initializeMetrika = () => {
	const metrikaWindow = window as MetrikaWindow;
	if (metrikaWindow.ym) return false;

	const ym: YandexMetrika = (...args) => {
		if (!ym.a) ym.a = [];
		ym.a.push(args);
	};
	ym.l = Date.now();
	metrikaWindow.ym = ym;
	ym(COUNTER_ID, "init", {
		clickmap: true,
		trackLinks: true,
		accurateTrackBounce: true,
	});

	if ([...document.scripts].some(({ src }) => src === TAG_URL)) return true;
	const script = document.createElement("script");
	script.async = true;
	script.src = TAG_URL;
	document.head.appendChild(script);
	return true;
};

export const reachMetrikaGoal = (goal: MetrikaGoal) => {
	const ym = (window as MetrikaWindow).ym;
	if (!ym) return false;
	ym(COUNTER_ID, "reachGoal", goal);
	return true;
};

export const trackFirstExpenseGoal = (
	userID: number | undefined,
	existingExpenseCount: number,
) => {
	if (!userID || existingExpenseCount !== 0) return false;
	const key = `pnz:metrika:first-expense:${userID}`;
	if (window.localStorage.getItem(key)) return false;
	if (!reachMetrikaGoal("first_expense")) return false;
	window.localStorage.setItem(key, "1");
	return true;
};
