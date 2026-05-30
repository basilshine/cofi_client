const settingsLikeRoutePattern =
	/^\/console\/(?:settings|account|organization|quota)(?:\/|$)/;
const spaceSettingsRoutePattern = /^\/console\/spaces\/[^/]+\/settings(?:\/|$)/;
const chatIndexRoutePattern = /^\/console\/chat\/?$/;
const chatThreadRoutePattern = /^\/console\/chat\/thread(?:\/|$)/;

export const hasNativeChatComposer = (pathname: string) =>
	chatIndexRoutePattern.test(pathname) || chatThreadRoutePattern.test(pathname);

export const isSettingsLikeWorkspaceRoute = (pathname: string) =>
	settingsLikeRoutePattern.test(pathname) ||
	spaceSettingsRoutePattern.test(pathname);

export const shouldShowGlobalComposer = (pathname: string) =>
	!hasNativeChatComposer(pathname) && !isSettingsLikeWorkspaceRoute(pathname);
