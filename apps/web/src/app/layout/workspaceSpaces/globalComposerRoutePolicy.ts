const dockHiddenRoutePattern = /^\/console\/(?:organization|quota)(?:\/|$)/;
const chatIndexRoutePattern = /^\/console\/chat\/?$/;
const chatThreadRoutePattern = /^\/console\/chat\/thread(?:\/|$)/;

export const hasNativeChatComposer = (pathname: string) =>
	chatIndexRoutePattern.test(pathname) || chatThreadRoutePattern.test(pathname);

export const isDockHiddenWorkspaceRoute = (pathname: string) =>
	dockHiddenRoutePattern.test(pathname);

export const shouldShowGlobalComposer = (pathname: string) =>
	!hasNativeChatComposer(pathname) && !isDockHiddenWorkspaceRoute(pathname);
