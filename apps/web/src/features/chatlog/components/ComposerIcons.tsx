import { Mic, SendHorizontal, Zap } from "lucide-react";

type IconProps = {
	className?: string;
};

export const ParseSubmitIcon = ({ className = "h-5 w-5" }: IconProps) => (
	<Zap aria-hidden className={className} />
);

export const MicIcon = ({ className = "h-5 w-5" }: IconProps) => (
	<Mic aria-hidden className={className} />
);

export const SendMessageIcon = ({ className = "h-5 w-5" }: IconProps) => (
	<SendHorizontal aria-hidden className={className} />
);
