/** Detects failed `fetch`/`fetchJson` errors that represent a missing resource (typically HTTP 404). */
export const isNotFoundHttpError = (e: unknown): boolean => {
	if (!(e instanceof Error)) return false;
	return /\b404\b/.test(e.message);
};
