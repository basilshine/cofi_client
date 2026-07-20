const COUNTER_ID = 110761833;

export type MetrikaGoal =
	| "landing_app_click"
	| "app_open"
	| "registration"
	| "first_expense";

export const reachMetrikaGoal = (goal: MetrikaGoal) => {
	const ym = (
		window as Window & {
			ym?: (counter: number, method: string, goal: string) => void;
		}
	).ym;
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
