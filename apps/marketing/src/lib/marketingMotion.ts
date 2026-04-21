import type { Transition, Variants } from "framer-motion";

/** Calm, editorial easing — avoid bouncy springs on marketing surfaces */
export const marketingEase = [0.22, 1, 0.36, 1] as const;

export const marketingTransition: Transition = {
	duration: 0.45,
	ease: marketingEase,
};

export const pageVariants: Variants = {
	initial: { opacity: 0, y: 12 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.4, ease: marketingEase },
	},
	exit: {
		opacity: 0,
		y: -8,
		transition: { duration: 0.22, ease: marketingEase },
	},
};

export const fadeUpVariants: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: marketingEase },
	},
};

export const staggerContainer: Variants = {
	hidden: {},
	visible: {
		transition: { staggerChildren: 0.07, delayChildren: 0.06 },
	},
};

export const staggerItem: Variants = {
	hidden: { opacity: 0, y: 14 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.45, ease: marketingEase },
	},
};
