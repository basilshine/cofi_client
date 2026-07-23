export type ModalSheetState = "expanded" | "peek";

export const modalSwipeAction = (
	state: ModalSheetState,
	deltaY: number,
	threshold = 64,
) => {
	if (Math.abs(deltaY) < threshold) return "none";
	if (state === "expanded") return deltaY > 0 ? "peek" : "none";
	return deltaY > 0 ? "close" : "expand";
};
