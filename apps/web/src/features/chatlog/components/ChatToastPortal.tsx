import { createPortal } from "react-dom";

type ChatToastPortalProps = {
	message: string | null;
};

export const ChatToastPortal = ({ message }: ChatToastPortalProps) => {
	if (!message) return null;

	return createPortal(
		<output
			aria-live="polite"
			className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] block max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-center text-sm text-foreground shadow-lg"
		>
			{message}
		</output>,
		document.body,
	);
};
