import LogRocket from "logrocket";

export const useLogRocket = () => {
	// Log a message or object
	const log = (message: string, data?: unknown) => {
		if (data !== undefined) {
			LogRocket.log(message, data);
		} else {
			LogRocket.log(message);
		}
	};

	// Capture an exception
	const captureException = (error: unknown) => {
		if (error instanceof Error) {
			LogRocket.captureException(error);
		} else {
			LogRocket.log("Non-Error exception captured", error);
		}
	};

	// Identify a user (optional, call after login)
	const identify = (
		userId: string,
		traits?: Record<string, string | number | boolean>,
	) => {
		LogRocket.identify(userId, traits);
	};

	return { log, captureException, identify };
};
