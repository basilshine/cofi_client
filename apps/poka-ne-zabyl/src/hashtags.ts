const hashtagPattern = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;

export const hashtagsFromText = (value: string) =>
	Array.from(value.matchAll(hashtagPattern), (match) =>
		match[1].toLowerCase(),
	).filter((tag, index, tags) => tags.indexOf(tag) === index);

export const notesWithTags = (notes: string, tags: string[]) => {
	const result = notes.trim();
	const existing = new Set(hashtagsFromText(result));
	const missing = tags
		.map((tag) =>
			tag.trim().replace(/^#/, "").replace(/\s+/g, "_").toLowerCase(),
		)
		.filter((tag) => tag && !existing.has(tag))
		.filter((tag, index, values) => values.indexOf(tag) === index)
		.map((tag) => `#${tag}`);
	return [result, ...missing].filter(Boolean).join(" ");
};

export const hashtagAtCursor = (value: string, cursor: number) => {
	const match = value.slice(0, cursor).match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
	if (!match) return null;
	return {
		start: cursor - match[1].length - 1,
		query: match[1].toLowerCase(),
	};
};

export const hashtagSuggestions = (tags: string[], query: string) =>
	Array.from(
		new Set(tags.map((tag) => tag.trim().replace(/^#/, "").toLowerCase())),
	)
		.filter((tag) => tag && (!query || tag.includes(query)))
		.sort((left, right) => {
			const leftStarts = left.startsWith(query) ? 0 : 1;
			const rightStarts = right.startsWith(query) ? 0 : 1;
			return leftStarts - rightStarts || left.localeCompare(right, "ru");
		})
		.slice(0, 6);

export const tagsAfterNotesEdit = (
	current: string[],
	previousNotes: string,
	nextNotes: string,
) => {
	const previous = hashtagsFromText(previousNotes);
	const next = hashtagsFromText(nextNotes);
	return previous.length || next.length ? next : current;
};

export const replaceHashtagAtCursor = (
	value: string,
	cursor: number,
	tag: string,
) => {
	const active = hashtagAtCursor(value, cursor);
	if (!active) return { value, cursor };
	const insertion = `#${tag} `;
	const nextValue = `${value.slice(0, active.start)}${insertion}${value.slice(cursor)}`;
	return { value: nextValue, cursor: active.start + insertion.length };
};
