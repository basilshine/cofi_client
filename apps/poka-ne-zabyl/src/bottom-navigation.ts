const SCROLL_DIRECTION_THRESHOLD = 8;

export const compactBottomNavigation = (
	compact: boolean,
	previousY: number,
	currentY: number,
) => {
	if (currentY <= 24) return false;
	const delta = currentY - previousY;
	return Math.abs(delta) < SCROLL_DIRECTION_THRESHOLD ? compact : delta > 0;
};
