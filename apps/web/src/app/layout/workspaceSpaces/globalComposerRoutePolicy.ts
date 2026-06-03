const dockHiddenRoutePattern = /^\/console\/(?:organization|quota)(?:\/|$)/;
const chatIndexRoutePattern = /^\/console\/chat\/?$/;
const settingsRoutePattern = /^\/console\/settings(?:\/|$)/;

export const hasNativeChatComposer = (pathname: string) =>
	chatIndexRoutePattern.test(pathname);

export const isDockHiddenWorkspaceRoute = (pathname: string) =>
	dockHiddenRoutePattern.test(pathname);

export const hasSettingsActionDock = (pathname: string) =>
	settingsRoutePattern.test(pathname);

export const shouldShowGlobalComposer = (pathname: string) =>
	!hasNativeChatComposer(pathname) && !isDockHiddenWorkspaceRoute(pathname);
