export const AVATAR_IMAGE_SIZE = 256;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

export const avatarCropLayout = (
	imageWidth: number,
	imageHeight: number,
	zoom: number,
	offsetX: number,
	offsetY: number,
) => {
	const scale =
		Math.max(AVATAR_IMAGE_SIZE / imageWidth, AVATAR_IMAGE_SIZE / imageHeight) *
		clamp(zoom, 1, 3);
	const width = imageWidth * scale;
	const height = imageHeight * scale;
	const maxX = (width - AVATAR_IMAGE_SIZE) / 2;
	const maxY = (height - AVATAR_IMAGE_SIZE) / 2;
	const x = clamp(offsetX, -maxX, maxX);
	const y = clamp(offsetY, -maxY, maxY);

	return {
		width,
		height,
		offsetX: x,
		offsetY: y,
		drawX: (AVATAR_IMAGE_SIZE - width) / 2 + x,
		drawY: (AVATAR_IMAGE_SIZE - height) / 2 + y,
	};
};

export const avatarFileFromCanvas = async (canvas: HTMLCanvasElement) => {
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/webp", 0.82),
	);
	if (!blob) throw new Error("Could not prepare the profile photo");
	return new File([blob], "avatar.webp", { type: blob.type });
};
