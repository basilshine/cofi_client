export const userMessageAccent = (userId?: number) => {
	if (userId == null) {
		return {
			borderLeftColor: "hsl(220 45% 52%)",
			surface: "hsl(220 20% 96% / 0.5)",
		};
	}
	const hue = (Number(userId) * 47) % 360;
	return {
		borderLeftColor: `hsl(${hue} 48% 45%)`,
		surface: `hsl(${hue} 35% 96% / 0.65)`,
	};
};
