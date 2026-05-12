import type { ChatMessage } from "@cofi/api";

const LAST_READ_MAIN_PREFIX = "cofi.chat.lastReadMainMsgId.";

export const asChronological = (descMessages: ChatMessage[]) =>
	[...descMessages].reverse();

export const messageIdCompare = (a: string, b: string): number => {
	const na = Number(a);
	const nb = Number(b);
	if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return String(a).localeCompare(String(b));
};

export const maxMessageIdInList = (list: ChatMessage[]): string | null => {
	if (!list.length) return null;
	let best = String(list[0].id);
	for (let i = 1; i < list.length; i++) {
		const s = String(list[i].id);
		if (messageIdCompare(best, s) < 0) best = s;
	}
	return best;
};

export const readLastReadMain = (spaceId: string | number): string | null => {
	try {
		return localStorage.getItem(LAST_READ_MAIN_PREFIX + String(spaceId));
	} catch {
		return null;
	}
};

export const writeLastReadMain = (
	spaceId: string | number,
	messageId: string | number,
) => {
	try {
		localStorage.setItem(
			LAST_READ_MAIN_PREFIX + String(spaceId),
			String(messageId),
		);
	} catch {
		// ignore storage errors
	}
};

export const isMainChatUnread = (
	lastRead: string | null,
	latestId: string | undefined,
): boolean => {
	if (!latestId) return false;
	if (!lastRead) return true;
	return messageIdCompare(lastRead, latestId) < 0;
};
