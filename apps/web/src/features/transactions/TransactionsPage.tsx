import { Navigate, useLocation, useSearchParams } from "react-router-dom";

/**
 * Legacy `/console/transactions` — redirects to the space expenses list at
 * `/console/spaces/:spaceId/expenses`, preserving `spaceId` when present.
 */
export const TransactionsPage = () => {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const locationSearchParams = new URLSearchParams(location.search);
	const spaceIdRaw =
		searchParams.get("spaceId") ?? locationSearchParams.get("spaceId");
	const selectSpaceId =
		spaceIdRaw != null && Number.isFinite(Number(spaceIdRaw))
			? Number(spaceIdRaw)
			: undefined;

	const to =
		selectSpaceId != null
			? `/console/spaces/${encodeURIComponent(String(selectSpaceId))}/expenses`
			: "/console/spaces";

	return (
		<Navigate
			replace
			state={selectSpaceId != null ? { selectSpaceId } : undefined}
			to={to}
		/>
	);
};
