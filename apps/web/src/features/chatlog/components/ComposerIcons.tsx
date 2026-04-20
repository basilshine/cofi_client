/** Inline SVGs for composer actions (no icon dependency). */

type IconProps = {
	className?: string;
};

export const ParseSubmitIcon = ({ className = "h-5 w-5" }: IconProps) => (
	<svg
		aria-hidden
		className={className}
		fill="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<title>Parse expense</title>
		<path
			clipRule="evenodd"
			d="M14.615 1.595a.75.75 0 0 1 .359.852l-1.992 7.302h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
			fillRule="evenodd"
		/>
	</svg>
);

export const SendMessageIcon = ({ className = "h-5 w-5" }: IconProps) => (
	<svg
		aria-hidden
		className={className}
		fill="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<title>Send message</title>
		<path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
	</svg>
);
