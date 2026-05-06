import type { KeyboardEvent } from "react";
import type { AuthSocialProvider } from "./authSocialTypes";

const IconGoogle = () => (
	<svg
		aria-hidden
		focusable="false"
		className="h-[18px] w-[18px] shrink-0 text-[#2A3D4C]"
		fill="currentColor"
		viewBox="0 0 24 24"
	>
		<title>Google</title>
		<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
		<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
		<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
		<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
	</svg>
);

const IconApple = () => (
	<svg
		aria-hidden
		focusable="false"
		className="h-[18px] w-[18px] shrink-0 text-[#2A3D4C]"
		fill="currentColor"
		viewBox="0 0 24 24"
	>
		<title>Apple</title>
		<path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.17 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.65 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
	</svg>
);

const IconTelegram = () => (
	<svg
		aria-hidden
		focusable="false"
		className="h-[18px] w-[18px] shrink-0 text-[#2A3D4C]"
		fill="currentColor"
		viewBox="0 0 24 24"
	>
		<title>Telegram</title>
		<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.09.13.21.14.27-.01.06.01.24 0 .38z" />
	</svg>
);

const providerIcon = (p: AuthSocialProvider) => {
	switch (p) {
		case "google":
			return <IconGoogle />;
		case "apple":
			return <IconApple />;
		case "telegram":
			return <IconTelegram />;
	}
};

export type AuthProviderButtonProps = {
	provider: AuthSocialProvider;
	label: string;
	onClick: () => void;
};

/** Subtle helper under Telegram — entry + register only. */
export const AuthTelegramCaptureHint = () => (
	<p className="pl-[3.25rem] pr-1 text-[10px] leading-relaxed text-[#8A9199]">
		Best if you plan to capture expenses from Telegram.
	</p>
);

export const AuthProviderButton = ({
	provider,
	label,
	onClick,
}: AuthProviderButtonProps) => {
	const handleClick = () => {
		onClick();
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		onClick();
	};

	return (
		<button
			className="flex h-12 w-full items-center gap-3 rounded-xl border border-[#D4CEC6] bg-[#FFFCF8] px-3.5 text-left text-sm font-semibold text-[#122032] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-[#C4BDB2] hover:bg-[#FAF8F5] focus-visible:ring-2 focus-visible:ring-[#8B9F8E]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFCFA] active:scale-[0.998]"
			type="button"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
		>
			<span className="flex h-[18px] w-9 shrink-0 items-center justify-center">
				{providerIcon(provider)}
			</span>
			<span className="min-w-0 flex-1 truncate">{label}</span>
		</button>
	);
};
