export const shouldUseFullscreen = (platform: string) =>
	platform === "android" || platform === "android_x" || platform === "ios";
