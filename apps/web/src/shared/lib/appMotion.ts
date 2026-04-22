import type { Variants } from "framer-motion";

/** Console / dense UI — slightly snappier than marketing, still non-bouncy */
export const appEase = [0.22, 1, 0.36, 1] as const;

/** Cross-fade + short slide for workspace route changes (dashboard, chat, …) */
export const workspacePageVariants: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.28, ease: appEase },
	},
	exit: {
		opacity: 0,
		y: -6,
		transition: { duration: 0.18, ease: appEase },
	},
};

/** Section / card entrance (e.g. dashboard hero) */
export const fadeUpVariants: Variants = {
	hidden: { opacity: 0, y: 16 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.4, ease: appEase },
	},
};

/** Auth / account full-width surfaces */
export const authSurfaceVariants: Variants = {
	hidden: { opacity: 0, y: 14 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.38, ease: appEase },
	},
};

export const staggerContainer: Variants = {
	hidden: {},
	visible: {
		transition: { staggerChildren: 0.06, delayChildren: 0.04 },
	},
};

export const staggerItem: Variants = {
	hidden: { opacity: 0, y: 12 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.35, ease: appEase },
	},
};
