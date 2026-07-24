import { renderToString } from "react-dom/server";
import { App } from "./App";

export { ACQUISITION_FAQ, GENERAL_FAQ, PUBLIC_PAGE_SEO } from "./seo";

export const render = (pathname: string) =>
	renderToString(<App pathname={pathname} />);
