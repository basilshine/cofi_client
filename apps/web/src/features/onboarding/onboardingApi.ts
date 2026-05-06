import { httpClient } from "../../shared/lib/httpClient";

export type OnboardingState = {
	completed: boolean;
	current_step: string;
	draft: Record<string, unknown>;
	has_pending_invite: boolean;
	first_space_id?: number;
};

export type OnboardingCompleteResponse = {
	first_space_id: number;
	welcome_text: string;
	quick_actions: Array<{ id: string; label: string }>;
	user_preferences_ceits: Record<string, unknown>;
};

export const onboardingApi = {
	getState: async (): Promise<OnboardingState> => {
		const res = await httpClient.get<OnboardingState>("/api/v1/onboarding");
		return res.data;
	},
	saveStep: async (body: {
		patch: Record<string, unknown>;
		cursor: string;
		invite_token?: string;
	}): Promise<OnboardingState> => {
		const res = await httpClient.post<OnboardingState>(
			"/api/v1/onboarding/step",
			body,
		);
		return res.data;
	},
	complete: async (): Promise<OnboardingCompleteResponse> => {
		const res = await httpClient.post<OnboardingCompleteResponse>(
			"/api/v1/onboarding/complete",
			{},
		);
		return res.data;
	},
};
