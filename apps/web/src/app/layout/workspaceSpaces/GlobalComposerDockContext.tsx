import { createContext, useContext } from "react";

type GlobalComposerDockContextValue = {
	isCollapsed: boolean;
	onCollapsedChange: (isCollapsed: boolean) => void;
	shouldShow: boolean;
};

const GlobalComposerDockContext =
	createContext<GlobalComposerDockContextValue | null>(null);

export const GlobalComposerDockProvider = GlobalComposerDockContext.Provider;

export const useGlobalComposerDock = () =>
	useContext(GlobalComposerDockContext);
