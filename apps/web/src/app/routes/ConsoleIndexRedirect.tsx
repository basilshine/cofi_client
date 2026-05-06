import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { readCeitsPrimarySpaceId } from "../../shared/lib/ceitsUserPrefs";

/**
 * `/console` entry — sends people to their primary space chat when one
 * exists, otherwise to the global Home (overview of all spaces). The legacy
 * `/console/dashboard` route still works for deep links.
 */
export const ConsoleIndexRedirect = () => {
	const { search } = useLocation();
	const { user } = useAuth();
	const primary = readCeitsPrimarySpaceId(user);
	if (primary != null) {
		return (
			<Navigate
				replace
				to={`chat?spaceId=${encodeURIComponent(String(primary))}`}
			/>
		);
	}
	return <Navigate replace to={{ pathname: "home", search }} />;
};
