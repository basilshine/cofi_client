export type BuilderItem = {
	id: string;
	name: string;
	amount: string; // keep as string for controlled input
	tags: string; // comma separated
};

export const newBuilderItem = (): BuilderItem => ({
	id: crypto.randomUUID(),
	name: "",
	amount: "",
	tags: "",
});

export const toNumber = (s: string) => {
	const n = Number(String(s).replace(",", "."));
	return Number.isFinite(n) ? n : 0;
};

export const parseTags = (s: string) =>
	s
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);

