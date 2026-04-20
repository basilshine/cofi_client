import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Space, SpaceMember, WsEnvelope } from "@cofi/api";
import { wsClient } from "../../shared/lib/wsClient";
import { ExpenseMessageCard } from "./components/ExpenseMessageCard";
import { DraftExpenseCard } from "./components/DraftExpenseCard";
import { httpClient } from "../../shared/lib/httpClient";
import { ManualTransactionEditor } from "./components/ManualTransactionEditor";
import type { BuilderItem } from "./components/transactionBuilderTypes";
import { newBuilderItem, parseTags, toNumber } from "./components/transactionBuilderTypes";

const DEFAULT_LIMIT = 50;

const asChronological = (descMessages: ChatMessage[]) => [...descMessages].reverse();

export const ChatLogPage = () => {
	const [wsStatus, setWsStatus] = useState<"disconnected" | "connected">("disconnected");
	const [spaces, setSpaces] = useState<Space[] | null>(null);
	const [selectedSpaceId, setSelectedSpaceId] = useState<string | number | null>(
		null,
	);
	const [members, setMembers] = useState<SpaceMember[] | null>(null);

	const [messages, setMessages] = useState<ChatMessage[] | null>(null); // chronological (asc)
	const [oldestMessageId, setOldestMessageId] = useState<string | number | null>(null);
	const [hasMore, setHasMore] = useState(true);

	const [newSpaceName, setNewSpaceName] = useState("");
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteToken, setInviteToken] = useState<string | null>(null);
	const [acceptInviteToken, setAcceptInviteToken] = useState("");

	const [composerText, setComposerText] = useState("");
	const [composerMode, setComposerMode] = useState<"chat" | "transaction">("chat");
	const [activeDraftExpenseId, setActiveDraftExpenseId] = useState<string | number | null>(
		null,
	);
	const [manualDescription, setManualDescription] = useState("");
	const [manualItems, setManualItems] = useState<BuilderItem[]>([newBuilderItem()]);
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const unsubscribeRef = useRef<null | (() => void)>(null);
	const [isTransactionsOpen, setIsTransactionsOpen] = useState(false);
	const [spaceTransactions, setSpaceTransactions] = useState<any[] | null>(null);

	const selectedSpace = useMemo(() => {
		if (!spaces || selectedSpaceId === null) return null;
		return spaces.find((s) => String(s.id) === String(selectedSpaceId)) ?? null;
	}, [selectedSpaceId, spaces]);

	const handleLoadSpaces = async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const list = (await wsClient.rpc<Space[]>("spaces.list", {})) ?? [];
			setSpaces(list);
			const firstId = list[0]?.id ?? null;
			setSelectedSpaceId((prev) => prev ?? firstId);
		} catch (err) {
			setSpaces(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to load spaces");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSelectSpace = async (spaceId: string | number) => {
		setSelectedSpaceId(spaceId);
		setInviteToken(null);
		setComposerText("");
		setActiveDraftExpenseId(null);
		setManualDescription("");
		setManualItems([newBuilderItem()]);
		setMessages(null);
		setMembers(null);
		setOldestMessageId(null);
		setHasMore(true);

		unsubscribeRef.current?.();
		unsubscribeRef.current = null;

		setIsLoading(true);
		setErrorMessage(null);
		try {
			const [m, msgDesc] = await Promise.all([
				wsClient.rpc<SpaceMember[]>("spaces.members", { spaceId }),
				wsClient.rpc<ChatMessage[]>("chat.list", { spaceId, limit: DEFAULT_LIMIT }),
			]);
			setMembers(m);
			const msgAsc = asChronological(msgDesc);
			setMessages(msgAsc);
			setOldestMessageId(msgAsc[0]?.id ?? null);
			setHasMore(msgDesc.length === DEFAULT_LIMIT);

			// Subscribe to live events for this space
			unsubscribeRef.current = await wsClient.subscribe(`space:${String(spaceId)}`, (e: WsEnvelope) => {
				if (e.op !== "chat.message.created") return;
				const message = (e.data?.message ?? null) as ChatMessage | null;
				if (!message) return;

				if (message.related_expense_id) {
					setActiveDraftExpenseId(message.related_expense_id);
				}

				setMessages((prev) => {
					const list = prev ?? [];
					if (list.some((m) => String(m.id) === String(message.id))) return list;
					return [...list, message];
				});
			});
		} catch (err) {
			setMembers(null);
			setMessages(null);
			setErrorMessage(err instanceof Error ? err.message : "Failed to load space");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateSpace = async () => {
		const name = newSpaceName.trim();
		if (!name) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const created = await wsClient.rpc<Space>("spaces.create", { name });
			setNewSpaceName("");
			await handleLoadSpaces();
			await handleSelectSpace(created.id);
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to create space");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateInvite = async () => {
		if (selectedSpaceId === null) return;
		const email = inviteEmail.trim();
		if (!email) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await wsClient.rpc<{ token: string; expires_at: string }>("spaces.invite", {
				spaceId: selectedSpaceId,
				email,
			});
			setInviteToken(res.token ?? null);
			setInviteEmail("");
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to create invite");
		} finally {
			setIsLoading(false);
		}
	};

	const handleAcceptInvite = async () => {
		const token = acceptInviteToken.trim();
		if (!token) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await wsClient.rpc("invites.accept", { token });
			setAcceptInviteToken("");
			await handleLoadSpaces();
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to accept invite");
		} finally {
			setIsLoading(false);
		}
	};

	const handleLoadOlder = async () => {
		if (selectedSpaceId === null || !oldestMessageId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const olderDesc = await wsClient.rpc<ChatMessage[]>("chat.list", {
				spaceId: selectedSpaceId,
				limit: DEFAULT_LIMIT,
				before: oldestMessageId,
			});
			const olderAsc = asChronological(olderDesc);
			setMessages((prev) => {
				const next = [...(olderAsc ?? []), ...(prev ?? [])];
				return next;
			});
			setOldestMessageId((prev) => olderAsc[0]?.id ?? prev);
			setHasMore(olderDesc.length === DEFAULT_LIMIT);
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to load older");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSend = async () => {
		if (selectedSpaceId === null) return;
		const text = composerText.trim();
		setIsLoading(true);
		setErrorMessage(null);
		try {
			if (composerMode === "chat") {
				if (!text) return;
				const created = await wsClient.rpc<ChatMessage>("chat.send", {
					spaceId: selectedSpaceId,
					text,
				});
				setComposerText("");
				setMessages((prev) => [...(prev ?? []), created]);
				setOldestMessageId((prev) => prev ?? created.id);
				return;
			}

			// Transaction mode: button parses TEXT only → fills Manual editor
			if (!text) return;
			const res = await httpClient.post<{ items?: { name: string; amount: number; tags?: string[] }[] }>(
				`v1/spaces/${String(selectedSpaceId)}/transactions/parse/text`,
				{ text },
			);
			const parsed = res.data?.items ?? [];
			const next = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
				}));
			setManualItems(next.length ? next : [newBuilderItem()]);
			setComposerText("");
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : "Failed to send message");
		} finally {
			setIsLoading(false);
		}
	};

	const handleChangeManualItem = (id: string, patch: Partial<BuilderItem>) =>
		setManualItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

	const handleAddManualItem = () => setManualItems((prev) => [...prev, newBuilderItem()]);

	const handleRemoveManualItem = (id: string) =>
		setManualItems((prev) => prev.filter((i) => i.id !== id));

	const handleSaveDraft = async () => {
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const payloadItems = manualItems
				.map((it) => ({
					name: it.name.trim(),
					amount: toNumber(it.amount),
					tags: parseTags(it.tags),
				}))
				.filter((it) => it.name && it.amount !== 0);

			if (!payloadItems.length) return;

			const res = await httpClient.post<{ expense?: { id: string | number } }>(
				`v1/spaces/${String(selectedSpaceId)}/transactions/manual`,
				{ description: manualDescription.trim(), items: payloadItems },
			);
			setActiveDraftExpenseId(res.data?.expense?.id ?? null);

			// Clear manual after save (requested UX)
			setManualDescription("");
			setManualItems([newBuilderItem()]);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to save draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleApproveDraft = async () => {
		if (!activeDraftExpenseId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await httpClient.post(`v1/finances/expenses/${String(activeDraftExpenseId)}/confirm`);
			setActiveDraftExpenseId(null);
			setManualDescription("");
			setManualItems([newBuilderItem()]);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to approve draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeclineDraft = async () => {
		if (!activeDraftExpenseId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			await httpClient.post(`v1/finances/expenses/${String(activeDraftExpenseId)}/cancel`);
			setActiveDraftExpenseId(null);
			setManualDescription("");
			setManualItems([newBuilderItem()]);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to decline draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteDraftWorkspace = async () => {
		// Cancel draft if exists, otherwise just clear manual state
		if (activeDraftExpenseId) {
			await handleDeclineDraft();
			return;
		}
		setManualDescription("");
		setManualItems([newBuilderItem()]);
	};

	const handleParsePhotoFile = async (file: File) => {
		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const fd = new FormData();
			fd.append("image", file);
			const res = await httpClient.post<{ items?: { name: string; amount: number; tags?: string[] }[] }>(
				`v1/spaces/${String(selectedSpaceId)}/transactions/parse/photo`,
				fd,
				{ headers: { "Content-Type": "multipart/form-data" } },
			);
			const parsed = res.data?.items ?? [];
			const next = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
				}));
			setManualItems(next.length ? next : [newBuilderItem()]);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to parse photo");
		} finally {
			setIsLoading(false);
		}
	};

	const handleStopRecordingAndParse = async () => {
		const rec = mediaRecorderRef.current;
		if (!rec) return;
		if (rec.state !== "recording") return;

		const stopPromise = new Promise<void>((resolve) => {
			rec.addEventListener("stop", () => resolve(), { once: true });
		});
		rec.stop();
		await stopPromise;

		const blob = new Blob(mediaChunksRef.current, { type: rec.mimeType || "audio/webm" });
		mediaChunksRef.current = [];

		if (!selectedSpaceId) return;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const fd = new FormData();
			fd.append("voice", new File([blob], "voice.webm", { type: blob.type || "audio/webm" }));
			const res = await httpClient.post<{ items?: { name: string; amount: number; tags?: string[] }[] }>(
				`v1/spaces/${String(selectedSpaceId)}/transactions/parse/voice`,
				fd,
				{ headers: { "Content-Type": "multipart/form-data" } },
			);
			const parsed = res.data?.items ?? [];
			const next = parsed
				.filter((p) => p?.name?.trim() && Number(p.amount) !== 0)
				.map((p) => ({
					id: crypto.randomUUID(),
					name: p.name.trim(),
					amount: String(p.amount),
					tags: (p.tags ?? []).join(", "),
				}));
			setManualItems(next.length ? next : [newBuilderItem()]);
		} catch (e) {
			setErrorMessage(e instanceof Error ? e.message : "Failed to parse voice");
		} finally {
			setIsLoading(false);
		}
	};

	const handleToggleRecording = async () => {
		if (composerMode !== "transaction") return;
		if (isRecording) {
			setIsRecording(false);
			await handleStopRecordingAndParse();
			return;
		}

		setErrorMessage(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const rec = new MediaRecorder(stream);
			mediaRecorderRef.current = rec;
			mediaChunksRef.current = [];
			rec.addEventListener("dataavailable", (e) => {
				if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
			});
			rec.addEventListener("stop", () => {
				stream.getTracks().forEach((t) => t.stop());
			});
			rec.start();
			setIsRecording(true);
		} catch (e) {
			setIsRecording(false);
			setErrorMessage(e instanceof Error ? e.message : "Microphone permission denied");
		}
	};

	const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSend();
	};

	// Draft approve/decline happens on the inline chat draft card now.

	const handleOpenTransactions = async () => {
		if (!selectedSpaceId) return;
		setIsTransactionsOpen(true);
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const res = await httpClient.get<any[]>(
				`v1/spaces/${String(selectedSpaceId)}/transactions?limit=100`,
			);
			setSpaceTransactions(res.data ?? []);
		} catch (e) {
			setSpaceTransactions(null);
			setErrorMessage(e instanceof Error ? e.message : "Failed to load transactions");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const run = async () => {
			try {
				await wsClient.connect();
				setWsStatus("connected");
			} catch {
				setWsStatus("disconnected");
			}
			await handleLoadSpaces();
		};
		void run();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!spaces?.length) return;
		if (selectedSpaceId === null) return;
		void handleSelectSpace(selectedSpaceId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSpaceId]);

	useEffect(() => {
		return () => {
			unsubscribeRef.current?.();
			unsubscribeRef.current = null;
		};
	}, []);

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Chat</h1>
				<p className="text-sm text-muted-foreground">
					Shared-space chat (multi-user) with system expense cards.
				</p>
				<div className="text-xs text-muted-foreground">WS: {wsStatus}</div>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-[320px_1fr]">
				<aside className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center justify-between gap-2">
						<div className="text-sm font-medium">Spaces</div>
						<button
							className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading}
							onClick={() => void handleLoadSpaces()}
							type="button"
						>
							Refresh
						</button>
					</div>

					<div className="mt-3 space-y-2">
						<div className="grid gap-2">
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									New space name
								</span>
								<input
									aria-label="New space name"
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setNewSpaceName(e.target.value)}
									placeholder="Team budget"
									type="text"
									value={newSpaceName}
								/>
							</label>
							<button
								className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
								disabled={isLoading || !newSpaceName.trim()}
								onClick={() => void handleCreateSpace()}
								type="button"
							>
								Create space
							</button>
						</div>

						<div className="mt-3 grid gap-2">
							<div className="text-xs font-medium text-muted-foreground">
								Your spaces
							</div>
							{spaces?.length ? (
								<ul className="space-y-1">
									{spaces.map((s) => {
										const isActive =
											selectedSpaceId !== null &&
											String(s.id) === String(selectedSpaceId);
										return (
											<li key={String(s.id)}>
												<button
													aria-label={`Select space ${s.name}`}
													className={[
														"w-full rounded-md px-3 py-2 text-left text-sm",
														isActive
															? "bg-accent text-foreground"
															: "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
													].join(" ")}
													onClick={() => setSelectedSpaceId(s.id)}
													type="button"
												>
													<div className="truncate font-medium">{s.name}</div>
													<div className="mt-0.5 truncate text-xs text-muted-foreground">
														id: {String(s.id)}
													</div>
												</button>
											</li>
										);
									})}
								</ul>
							) : (
								<div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
									No spaces found.
								</div>
							)}
						</div>
					</div>

					<div className="mt-6 space-y-3">
						<div className="text-sm font-medium">Members</div>
						{selectedSpace ? (
							<div className="text-xs text-muted-foreground">
								Space: <span className="font-medium text-foreground">{selectedSpace.name}</span>
							</div>
						) : null}

						{members?.length ? (
							<ul className="space-y-1">
								{members.map((m) => (
									<li
										className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
										key={`${m.user_id}-${m.role}`}
									>
										<div className="min-w-0">
											<div className="truncate text-sm font-medium">
												{m.name || m.email || `user_${m.user_id}`}
											</div>
											<div className="truncate text-xs text-muted-foreground">
												id: {m.user_id}
												{m.email ? ` · ${m.email}` : ""}
											</div>
										</div>
										<span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
											{m.role.toUpperCase()}
										</span>
									</li>
								))}
							</ul>
						) : (
							<div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
								{selectedSpace ? "No members loaded." : "Select a space."}
							</div>
						)}

						<div className="grid gap-2">
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Invite user by email (owner only)
								</span>
								<input
									aria-label="Invite email"
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setInviteEmail(e.target.value)}
									placeholder="friend@example.com"
									type="email"
									value={inviteEmail}
								/>
							</label>
							<button
								className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
								disabled={isLoading || !selectedSpaceId || !inviteEmail.trim()}
								onClick={() => void handleCreateInvite()}
								type="button"
							>
								Create invite
							</button>
							{inviteToken ? (
								<div className="rounded-md border border-border bg-muted p-3 text-xs">
									<div className="text-[10px] font-semibold text-muted-foreground">
										Invite token (paste into “Accept invite”)
									</div>
									<div className="mt-1 break-all font-mono">{inviteToken}</div>
								</div>
							) : null}
						</div>

						<div className="grid gap-2">
							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									Accept invite (paste token)
								</span>
								<input
									aria-label="Invite token"
									className="h-10 rounded-md border border-border bg-background px-3 text-sm"
									onChange={(e) => setAcceptInviteToken(e.target.value)}
									placeholder="invite token…"
									type="text"
									value={acceptInviteToken}
								/>
							</label>
							<button
								className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
								disabled={isLoading || !acceptInviteToken.trim()}
								onClick={() => void handleAcceptInvite()}
								type="button"
							>
								Accept invite
							</button>
						</div>
					</div>
				</aside>

				<main className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<div className="truncate text-sm font-medium">
								{selectedSpace ? selectedSpace.name : "Select a space"}
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								Messages load newest-first; UI shows chronological order.
							</div>
						</div>
						<button
							className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
							disabled={isLoading || !selectedSpaceId}
							onClick={() => selectedSpaceId && void handleSelectSpace(selectedSpaceId)}
							type="button"
						>
							Reload
						</button>
					</div>

					{isTransactionsOpen ? (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div className="w-full max-w-3xl rounded-lg border border-border bg-card p-4">
								<div className="flex items-center justify-between gap-3">
									<div className="text-sm font-semibold">Space transactions</div>
									<button
										aria-label="Close transactions"
										className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
										onClick={() => setIsTransactionsOpen(false)}
										type="button"
									>
										Close
									</button>
								</div>
								<div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border bg-background">
									{spaceTransactions?.length ? (
										<ul className="divide-y divide-border">
											{spaceTransactions.map((t) => (
												<li className="p-3 text-sm" key={String(t.id)}>
													<div className="flex items-center justify-between gap-3">
														<div className="font-medium">#{String(t.id)}</div>
														<div className="text-xs text-muted-foreground">{t.status}</div>
													</div>
													<div className="mt-1 text-xs text-muted-foreground">
														{t.description || ""}
													</div>
												</li>
											))}
										</ul>
									) : (
										<div className="p-3 text-sm text-muted-foreground">
											No approved transactions linked in this space yet.
										</div>
									)}
								</div>
							</div>
						</div>
					) : null}

					<div className="mt-4 space-y-3">
						{hasMore ? (
							<button
								className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
								disabled={isLoading || !selectedSpaceId || !oldestMessageId}
								onClick={() => void handleLoadOlder()}
								type="button"
							>
								Load older
							</button>
						) : (
							<div className="text-xs text-muted-foreground">No more messages.</div>
						)}

						<div className="max-h-[520px] space-y-2 overflow-auto rounded-lg border border-border bg-background p-3">
							{messages?.length ? (
								messages.map((m) => {
									const isUser = m.sender_type === "user";
									return (
										<div
											className={[
												"flex",
												isUser ? "justify-start" : "justify-end",
											].join(" ")}
											key={String(m.id)}
										>
											<div
												className={[
													"max-w-[min(520px,90%)] space-y-2 rounded-lg border px-3 py-2",
													isUser
														? "border-border bg-card"
														: "border-primary/30 bg-primary/10",
												].join(" ")}
											>
												<div className="flex items-center justify-between gap-3">
													<div className="text-[10px] font-semibold text-muted-foreground">
														{isUser ? `USER · id:${String(m.user_id ?? "")}` : "SYSTEM"}
													</div>
													<div className="text-[10px] text-muted-foreground">
														{m.created_at ? new Date(m.created_at).toLocaleString() : ""}
													</div>
												</div>

												{m.related_transaction_id ? (
													<ExpenseMessageCard transactionId={m.related_transaction_id} />
												) : null}

												{m.related_expense_id ? (
													<DraftExpenseCard expenseId={m.related_expense_id} />
												) : null}

												<div className="whitespace-pre-wrap text-sm">{m.text}</div>
											</div>
										</div>
									);
								})
							) : (
								<div className="text-sm text-muted-foreground">
									{selectedSpaceId ? "No messages yet." : "Select a space to view chat."}
								</div>
							)}
						</div>

						<div className="rounded-lg border border-border bg-background p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="text-xs font-medium text-muted-foreground">
									Composer mode
								</div>
								<div className="flex items-center gap-2">
									<button
										aria-label="Chat mode"
										className={[
											"inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold",
											composerMode === "chat"
												? "border-primary bg-primary/10 text-foreground"
												: "border-border text-muted-foreground hover:bg-accent",
										].join(" ")}
										disabled={isLoading}
										onClick={() => setComposerMode("chat")}
										type="button"
									>
										Chat
									</button>
									<button
										aria-label="Transaction mode"
										className={[
											"inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold",
											composerMode === "transaction"
												? "border-primary bg-primary/10 text-foreground"
												: "border-border text-muted-foreground hover:bg-accent",
										].join(" ")}
										disabled={isLoading}
										onClick={() => setComposerMode("transaction")}
										type="button"
									>
										Transaction
									</button>
									<button
										aria-label="Open space transactions"
										className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
										disabled={isLoading || !selectedSpaceId}
										onClick={() => void handleOpenTransactions()}
										type="button"
									>
										Transactions
									</button>
								</div>
							</div>

							{composerMode === "transaction" && selectedSpaceId ? (
								<div className="mt-3">
									<div className="rounded-md border border-border bg-card p-3">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div className="text-xs font-medium text-muted-foreground">
												Transaction input
											</div>
											<div className="flex items-center gap-2">
												<label className="inline-flex cursor-pointer items-center">
													<input
														aria-label="Upload receipt image"
														className="hidden"
														accept="image/*"
														disabled={isLoading}
														onChange={(e) => {
															const f = e.target.files?.[0] ?? null;
															if (f) void handleParsePhotoFile(f);
															e.currentTarget.value = "";
														}}
														type="file"
													/>
													<span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent">
														Image
													</span>
												</label>

												<button
													aria-label="Record voice"
													className={[
														"inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold",
														isRecording
															? "border-destructive bg-destructive/10 text-destructive"
															: "border-border hover:bg-accent",
													].join(" ")}
													disabled={isLoading}
													onClick={() => void handleToggleRecording()}
													type="button"
												>
													{isRecording ? "Stop" : "Mic"}
												</button>
											</div>
										</div>
									</div>

									<div className="mt-3">
										<ManualTransactionEditor
											description={manualDescription}
											items={manualItems}
											disabled={isLoading}
											onAddItem={handleAddManualItem}
											onChangeDescription={setManualDescription}
											onChangeItem={handleChangeManualItem}
											onRemoveItem={handleRemoveManualItem}
											onSaveDraft={() => void handleSaveDraft()}
										/>
									</div>

									{activeDraftExpenseId ? (
										<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
											<div className="text-xs font-medium text-muted-foreground">
												Active draft:{" "}
												<span className="font-semibold text-foreground">
													{String(activeDraftExpenseId)}
												</span>
											</div>
											<div className="ml-auto flex items-center gap-2">
												<button
													aria-label="Approve active draft"
													className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
													disabled={isLoading}
													onClick={() => void handleApproveDraft()}
													type="button"
												>
													Approve
												</button>
												<button
													aria-label="Decline active draft"
													className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
													disabled={isLoading}
													onClick={() => void handleDeclineDraft()}
													type="button"
												>
													Decline
												</button>
												<button
													aria-label="Delete transaction workspace"
													className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
													disabled={isLoading}
													onClick={() => void handleDeleteDraftWorkspace()}
													type="button"
												>
													Delete
												</button>
											</div>
										</div>
									) : null}
								</div>
							) : null}

							<label className="grid gap-1">
								<span className="text-xs font-medium text-muted-foreground">
									{composerMode === "chat"
										? "Message (Ctrl/⌘ + Enter to send)"
										: "Transaction text (Ctrl/⌘ + Enter to parse)"}
								</span>
								<textarea
									aria-label="Chat message"
									className="min-h-24 rounded-md border border-border bg-card p-3 text-sm"
									onChange={(e) => setComposerText(e.target.value)}
									onKeyDown={handleComposerKeyDown}
									placeholder={
										composerMode === "chat"
											? "Write a message…"
											: "Example: Lunch 12.5, taxi 8"
									}
									value={composerText}
								/>
							</label>
							<div className="mt-2 flex items-center gap-2">
								<button
									className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
									disabled={
										isLoading ||
										!selectedSpaceId ||
										!composerText.trim()
									}
									onClick={() => void handleSend()}
									type="button"
								>
									{composerMode === "chat" ? "Send" : "Parse"}
								</button>
							</div>
						</div>
					</div>
				</main>
			</div>
		</section>
	);
};
