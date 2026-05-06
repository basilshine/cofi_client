import { useEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { RecurringSchedulesPage } from "../recurring/RecurringSchedulesPage";

/**
 * Space-scoped wrapper around the global Recurring page so the in-space
 * shell (header + 5-tab nav) stays consistent with Overview / Chat /
 * Expenses / Splits.
 *
 * The underlying list is currently global per tenant; future work can
 * server-filter by `space_id` once the API supports it. Today the wrapper
 * makes the navigation correct even if the list itself is shared.
 */
export const SpaceRecurringPage = () => {
	const { spaceId } = useParams<{ spaceId: string }>();
	const { spaces, selectedSpaceId, setSelectedSpaceId } = useWorkspaceSpaces();

	const numericSpaceId = useMemo(() => {
		const n = Number(spaceId);
		return Number.isFinite(n) ? n : null;
	}, [spaceId]);

	const spaceName = useMemo(() => {
		if (!spaces || spaceId == null) return null;
		return (
			spaces.find((s) => String(s.id) === String(spaceId))?.name?.trim() ?? null
		);
	}, [spaces, spaceId]);

	useConsoleHeaderTitle("Recurring", spaceName);

	useEffect(() => {
		if (numericSpaceId == null) return;
		if (
			selectedSpaceId == null ||
			String(selectedSpaceId) !== String(numericSpaceId)
		) {
			setSelectedSpaceId(numericSpaceId);
		}
	}, [numericSpaceId, selectedSpaceId, setSelectedSpaceId]);

	if (numericSpaceId == null) {
		return <Navigate replace to="/console/home" />;
	}

	return <RecurringSchedulesPage />;
};
