export const shouldUseFullscreen = (platform: string) =>
	platform === "android" || platform === "android_x" || platform === "ios";

export type HomeScreenPlatform = "ios" | "android" | "desktop";

export const homeScreenPlatform = (userAgent: string): HomeScreenPlatform => {
	if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
	if (/android/i.test(userAgent)) return "android";
	return "desktop";
};
