import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

/** Published by ChatLogPage for shell breadcrumbs (space + optional expense thread). */
export type ChatBreadcrumbPayload = {
	spaceName: string | null;
	thread: {
		label: string;
		detail?: string | null;
	} | null;
};

const ChatBreadcrumbValueContext = createContext<ChatBreadcrumbPayload | null>(
	null,
);

const SetChatBreadcrumbContext = createContext<
	((value: ChatBreadcrumbPayload | null) => void) | null
>(null);

export const ChatBreadcrumbProvider = ({
	children,
}: { children: ReactNode }) => {
	const [value, setValue] = useState<ChatBreadcrumbPayload | null>(null);
	const setChatBreadcrumb = useCallback(
		(next: ChatBreadcrumbPayload | null) => {
			setValue(next);
		},
		[],
	);
	const memoValue = useMemo(() => value, [value]);
	return (
		<SetChatBreadcrumbContext.Provider value={setChatBreadcrumb}>
			<ChatBreadcrumbValueContext.Provider value={memoValue}>
				{children}
			</ChatBreadcrumbValueContext.Provider>
		</SetChatBreadcrumbContext.Provider>
	);
};

export const useChatBreadcrumbValue = (): ChatBreadcrumbPayload | null =>
	useContext(ChatBreadcrumbValueContext);

export const useSetChatBreadcrumb = (): ((
	value: ChatBreadcrumbPayload | null,
) => void) => {
	const fn = useContext(SetChatBreadcrumbContext);
	return fn ?? (() => {});
};
