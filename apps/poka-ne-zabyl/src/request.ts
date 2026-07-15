export const REQUEST_TIMEOUT_MS = 30_000;

export const requestError = (error: unknown) => {
	if (
		error instanceof DOMException &&
		(error.name === "AbortError" || error.name === "TimeoutError")
	)
		return new Error("Сервис не ответил. Попробуйте ещё раз");
	return error instanceof Error
		? error
		: new Error("Не удалось загрузить данные");
};
