import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Legacy `/console/transactions` — redirects to the space expenses list at
 * `/console/chat/expenses`, preserving `spaceId` when present.
 */
export const TransactionsPage = () => {
	const [searchParams] = useSearchParams();
	const spaceIdRaw = searchParams.get("spaceId");
	const selectSpaceId =
		spaceIdRaw != null && Number.isFinite(Number(spaceIdRaw))
			? Number(spaceIdRaw)
			: undefined;

	const to =
		selectSpaceId != null
			? `/console/chat/expenses?spaceId=${encodeURIComponent(String(selectSpaceId))}`
			: "/console/chat/expenses";

	return (
		<Navigate
			replace
			state={selectSpaceId != null ? { selectSpaceId } : undefined}
			to={to}
		/>
	);
};
