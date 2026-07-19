export const PULL_REFRESH_THRESHOLD = 64;

export const pullRefreshDistance = (deltaX: number, deltaY: number) =>
	deltaY <= 0 || Math.abs(deltaX) > deltaY ? 0 : Math.min(88, deltaY * 0.45);
