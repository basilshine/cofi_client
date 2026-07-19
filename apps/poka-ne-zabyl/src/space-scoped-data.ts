export function spaceScopedItems<T>(
	items: T[],
	loadedSpaceID: number,
	activeSpaceID: number,
	previewMode = false,
): T[] {
	return previewMode || loadedSpaceID === activeSpaceID ? items : [];
}
