import { useEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { RecurringSchedulesPage } from "../../widgets/recurring-schedules-page";

/**
 * Space-scoped wrapper around the Recurring page. Recurring is a record
 * projection inside a space; the global page remains a cross-space management
 * surface.
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

	return (
		<RecurringSchedulesPage spaceId={numericSpaceId} spaceName={spaceName} />
	);
};
