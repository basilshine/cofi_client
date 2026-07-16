export const REQUEST_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code = "") {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

export const isQuotaExhaustedError = (error: unknown) =>
	error instanceof ApiError &&
	(error.status === 402 || error.code === "quota_exhausted");

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
