import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type ConsoleHeaderCenterContextValue = {
	/** Current node rendered in the app header center (full-bleed console only). */
	center: ReactNode | null;
	setCenter: (node: ReactNode | null) => void;
};

const ConsoleHeaderCenterContext =
	createContext<ConsoleHeaderCenterContextValue | null>(null);

export const ConsoleHeaderCenterProvider = ({
	children,
}: { children: ReactNode }) => {
	const [center, setCenterState] = useState<ReactNode | null>(null);

	const setCenter = useCallback((node: ReactNode | null) => {
		setCenterState(node);
	}, []);

	const value = useMemo(
		(): ConsoleHeaderCenterContextValue => ({ center, setCenter }),
		[center, setCenter],
	);

	return (
		<ConsoleHeaderCenterContext.Provider value={value}>
			{children}
		</ConsoleHeaderCenterContext.Provider>
	);
};

export const useConsoleHeaderCenter = (): ConsoleHeaderCenterContextValue => {
	const ctx = useContext(ConsoleHeaderCenterContext);
	if (!ctx) {
		throw new Error(
			"useConsoleHeaderCenter must be used within ConsoleHeaderCenterProvider",
		);
	}
	return ctx;
};

/**
 * Pushes a title into the global app header center while mounted; clears on unmount.
 */
export const useConsoleHeaderTitle = (
	pageLabel: string,
	spaceName: string | null | undefined,
) => {
	const { setCenter } = useConsoleHeaderCenter();

	useEffect(() => {
		const space = spaceName?.trim();
		setCenter(
			<div className="min-w-0 max-w-[min(100vw-10rem,36rem)] text-center">
				<p className="truncate font-display text-base font-normal tracking-tight text-foreground md:text-lg">
					{pageLabel}
					{space ? (
						<span className="font-normal text-muted-foreground">
							{" "}
							· {space}
						</span>
					) : null}
				</p>
			</div>,
		);
		return () => {
			setCenter(null);
		};
	}, [pageLabel, spaceName, setCenter]);
};
