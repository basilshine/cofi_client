import { Navigate, useLocation } from "react-router-dom";

/** Sends `/console` to the dashboard overview. */
export const ConsoleIndexRedirect = () => {
	const { search } = useLocation();
	return <Navigate replace to={{ pathname: "dashboard", search }} />;
};
