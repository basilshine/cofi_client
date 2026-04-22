import { motion, useReducedMotion } from "framer-motion";

type Props = {
	disabled?: boolean;
	onStop: () => void;
};

export const ComposerVoiceRecording = ({
	disabled = false,
	onStop,
}: Props) => {
	const reduceMotion = useReducedMotion();
	const spring = reduceMotion
		? { duration: 0.15 }
		: { type: "spring" as const, stiffness: 380, damping: 28 };

	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/[0.07] p-4 shadow-sm"
			initial={reduceMotion ? false : { opacity: 0.85, y: 6 }}
			transition={spring}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 flex-1 space-y-2">
					<p className="text-xs font-semibold uppercase tracking-wide text-destructive">
						Recording
					</p>
					<div aria-hidden className="flex h-12 items-end gap-1">
						{[0, 1, 2, 3, 4].map((i) => (
							<motion.div
								className="w-1.5 origin-bottom rounded-full bg-destructive/75"
								key={i}
								style={{ height: 32 }}
								animate={
									reduceMotion
										? { scaleY: 0.6 }
										: { scaleY: [0.35, 1, 0.35] }
								}
								transition={
									reduceMotion
										? {}
										: {
												repeat: Number.POSITIVE_INFINITY,
												duration: 0.55,
												delay: i * 0.09,
												ease: "easeInOut",
											}
								}
							/>
						))}
					</div>
					<p className="text-xs text-muted-foreground">Tap stop when finished.</p>
				</div>
				<button
					aria-label="Stop recording"
					className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border-2 border-destructive bg-background px-6 text-sm font-semibold text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
					disabled={disabled}
					onClick={() => void onStop()}
					type="button"
				>
					Stop
				</button>
			</div>
		</motion.div>
	);
};
