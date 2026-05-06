import { httpClient } from "../../shared/lib/httpClient";

export type InvitePreviewResponse = {
	status: "ready" | "expired" | "used" | "not_found";
	invite_kind?: "space" | "tenant_only";
	space_id?: number;
	space_name?: string;
	tenant_id?: number;
	tenant_name?: string;
	inviter_user_id?: number;
	inviter_name?: string;
	inviter_email?: string;
	invitee_email?: string;
	invited_space_role?: string;
	invited_tenant_role?: string | null;
	expires_at?: string;
};

export const fetchInvitePreview = async (
	token: string,
): Promise<InvitePreviewResponse> => {
	const res = await httpClient.get<InvitePreviewResponse>(
		"/api/v1/invites/preview",
		{ params: { token } },
	);
	return res.data;
};
