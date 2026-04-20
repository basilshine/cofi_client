import type {
	ExpenseDetail,
	ExpensePatch,
	ExpenseThreadItemProposal,
	ExpenseThreadMessage,
	ExpenseThreadSummary,
	PayeeMismatchHint,
	SpaceMember,
	WsEnvelope,
} from "@cofi/api";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { httpClient } from "../../../shared/lib/httpClient";
import { wsClient } from "../../../shared/lib/wsClient";
import type { BuilderItem } from "../components/transactionBuilderTypes";
import {
	newBuilderItem,
	parseTags,
	toNumber,
} from "../components/transactionBuilderTypes";

const MESSAGE_LIMIT = 50;

/** Thread creator or space owner — same privilege as split/finalize in expense threads. */
export const userIsThreadOrSpaceMaster = (
	summary: ExpenseThreadSummary | null,
	threadMembers: SpaceMember[],
	currentUserId: number,
): boolean => {
	if (summary == null) return false;
	const isThreadMaster =
		Number(summary.thread.created_by_user_id) === Number(currentUserId);
	const isSpaceOwner = threadMembers.some(
		(m) => Number(m.user_id) === Number(currentUserId) && m.role === "owner",
	);
	return isThreadMaster || isSpaceOwner;
};

export const expenseTotal = (exp: ExpenseDetail | null): number => {
	const items = exp?.items ?? [];
	return items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
};

const expenseItemsToBuilder = (exp: ExpenseDetail | null): BuilderItem[] => {
	const items = exp?.items ?? [];
	if (items.length === 0) return [newBuilderItem()];
	return items.map((it) => ({
		id: String(it.id ?? crypto.randomUUID()),
		name: it.name ?? "",
		amount: String(it.amount ?? ""),
		tags: (it.tags ?? []).map((t) => t.name).join(", "),
		notes: it.notes?.trim() ?? "",
	}));
};

/** Equal currency split (cents). */
export const equalParts = (total: number, n: number): number[] => {
	if (n <= 0) return [];
	const cents = Math.round(total * 100);
	const base = Math.floor(cents / n);
	const rem = cents - base * n;
	const out: number[] = [];
	for (let i = 0; i < n; i++) {
		const extra = i < rem ? 1 : 0;
		out.push((base + extra) / 100);
	}
	return out;
};

/** Percents to amounts; last row absorbs rounding drift. */
export const percentsToAmounts = (pcts: number[], total: number): number[] => {
	const n = pcts.length;
	if (n === 0) return [];
	const sumPct = pcts.reduce((s, p) => s + p, 0);
	if (Math.abs(sumPct - 100) > 0.05 && total > 0) {
		// allow small drift; normalize if way off
	}
	const raw = pcts.map((p) => (total * p) / 100);
	const rounded = raw.map((x) => Math.round(x * 100) / 100);
	const sum = rounded.reduce((s, x) => s + x, 0);
	const drift = Math.round((total - sum) * 100) / 100;
	if (n > 0 && Math.abs(drift) >= 0.001) {
		const lastIdx = n - 1;
		const last = rounded[lastIdx];
		if (last !== undefined) {
			rounded[lastIdx] = Math.round((last + drift) * 100) / 100;
		}
	}
	return rounded;
};

export type SplitPercentRow = { user_id: number; percent: string };

export const useExpenseThreadState = (
	spaceId: string | number | null,
	expenseId: string | number | null,
) => {
	const [expense, setExpense] = useState<ExpenseDetail | null>(null);
	const [proposals, setProposals] = useState<ExpenseThreadItemProposal[]>([]);
	const [draftDescription, setDraftDescription] = useState("");
	/** Short label for lists and thread context (required for save). */
	const [draftTitle, setDraftTitle] = useState("");
	const [draftPayeeText, setDraftPayeeText] = useState("");
	const [draftCurrency, setDraftCurrency] = useState("USD");
	/** YYYY-MM-DD or empty (server may treat empty txn_date as today on patch). */
	const [draftTxnDate, setDraftTxnDate] = useState("");
	const [draftInvoiceRef, setDraftInvoiceRef] = useState("");
	const [draftNotes, setDraftNotes] = useState("");
	const [draftVendorId, setDraftVendorId] = useState<number | null>(null);
	const [draftItems, setDraftItems] = useState<BuilderItem[]>([
		newBuilderItem(),
	]);
	const [summary, setSummary] = useState<ExpenseThreadSummary | null>(null);
	const [threadMessages, setThreadMessages] = useState<ExpenseThreadMessage[]>(
		[],
	);
	const [threadMembers, setThreadMembers] = useState<SpaceMember[]>([]);
	const [splitRows, setSplitRows] = useState<SplitPercentRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [loadOlderBusy, setLoadOlderBusy] = useState(false);
	const [hasOlder, setHasOlder] = useState(false);
	const [splitsSaving, setSplitsSaving] = useState(false);
	const [threadParseInput, setThreadParseInput] = useState("");
	const [threadCaptureBusy, setThreadCaptureBusy] = useState(false);
	const [isThreadRecording, setIsThreadRecording] = useState(false);
	const [payeeMismatchNotice, setPayeeMismatchNotice] =
		useState<PayeeMismatchHint | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);

	const total = expenseTotal(expense);
	const thread = summary?.thread;
	const threadId = thread?.id ?? null;
	const finalized = thread?.status === "finalized";

	const applyExpenseToDraftHeaders = useCallback((exp: ExpenseDetail) => {
		setDraftDescription(exp.description?.trim() ?? "");
		setDraftTitle(exp.title?.trim() || "Expense");
		setDraftPayeeText(exp.payee_text?.trim() ?? "");
		setDraftCurrency((exp.currency || "USD").toUpperCase());
		setDraftTxnDate(
			typeof exp.txn_date === "string" && exp.txn_date.length >= 10
				? exp.txn_date.slice(0, 10)
				: "",
		);
		setDraftInvoiceRef(exp.business_meta?.invoice_ref ?? "");
		setDraftNotes(exp.business_meta?.notes ?? "");
		setDraftVendorId(exp.vendor?.id ?? null);
	}, []);

	const buildExpenseHeaderPatch = useCallback((): ExpensePatch => {
		const cur = (draftCurrency.trim() || "USD").toUpperCase();
		const patch: ExpensePatch = {
			title: draftTitle.trim() || "Expense",
			description: draftDescription.trim(),
			payee_text: draftPayeeText.trim(),
			currency: cur,
			txn_date: draftTxnDate.trim(),
			business_meta: {
				invoice_ref: draftInvoiceRef.trim(),
				notes: draftNotes.trim(),
			},
		};
		if (draftVendorId == null) {
			patch.vendor_id_clear = true;
		} else {
			patch.vendor_id = draftVendorId;
		}
		return patch;
	}, [
		draftTitle,
		draftDescription,
		draftPayeeText,
		draftCurrency,
		draftTxnDate,
		draftInvoiceRef,
		draftNotes,
		draftVendorId,
	]);

	const refreshExpenseAndProposals = useCallback(async () => {
		if (spaceId == null || expenseId == null) return;
		try {
			const [exp, propRes] = await Promise.all([
				apiClient.threads.getThreadExpense(spaceId, expenseId),
				apiClient.threads.listProposals(spaceId, expenseId),
			]);
			setExpense(exp);
			setProposals(propRes.proposals ?? []);
			applyExpenseToDraftHeaders(exp);
			setDraftItems(expenseItemsToBuilder(exp));
		} catch {
			// ignore — caller may show load error
		}
	}, [spaceId, expenseId, applyExpenseToDraftHeaders]);

	const load = useCallback(async () => {
		if (spaceId == null || expenseId == null) {
			setExpense(null);
			setProposals([]);
			setDraftDescription("");
			setDraftTitle("");
			setDraftPayeeText("");
			setDraftCurrency("USD");
			setDraftTxnDate("");
			setDraftInvoiceRef("");
			setDraftNotes("");
			setDraftVendorId(null);
			setDraftItems([newBuilderItem()]);
			setSummary(null);
			setThreadMessages([]);
			setThreadMembers([]);
			setSplitRows([]);
			setActionError(null);
			return;
		}
		setLoading(true);
		setActionError(null);
		try {
			await apiClient.threads.getOrCreate(spaceId, expenseId);
			const [exp, sum, mem, splitRes, propRes] = await Promise.all([
				apiClient.threads.getThreadExpense(spaceId, expenseId),
				apiClient.threads.getSummary(spaceId, expenseId),
				apiClient.spaces.listMembers(spaceId).then((r) => r.members),
				apiClient.finances.expenses.listSplits(expenseId).catch(() => null),
				apiClient.threads.listProposals(spaceId, expenseId),
			]);
			setExpense(exp);
			setProposals(propRes.proposals ?? []);
			applyExpenseToDraftHeaders(exp);
			setDraftItems(expenseItemsToBuilder(exp));
			setSummary(sum);
			setThreadMembers(mem);
			const tid = sum.thread.id;
			const { messages: initial } = await apiClient.threads.listMessages(tid, {
				limit: MESSAGE_LIMIT,
			});
			setThreadMessages(initial);
			setHasOlder(initial.length === MESSAGE_LIMIT);

			const t = expenseTotal(exp);
			if (splitRes?.splits?.length && t > 0) {
				const byUser = new Map(
					splitRes.splits.map((s) => [s.user_id, s.amount]),
				);
				setSplitRows(
					mem.map((m) => {
						const uid = Number(m.user_id);
						const amt = byUser.get(uid) ?? 0;
						const pct = t > 0 ? (amt / t) * 100 : 0;
						return {
							user_id: uid,
							percent: String(Math.round(pct * 100) / 100),
						};
					}),
				);
			} else {
				// No saved splits yet: draft owner (thread creator) holds 100%; others 0%.
				// Creator adjusts after others contribute via capture proposals.
				const creatorId = Number(sum.thread.created_by_user_id);
				setSplitRows(
					mem.map((m) => {
						const uid = Number(m.user_id);
						return {
							user_id: uid,
							percent: uid === creatorId ? "100" : "0",
						};
					}),
				);
			}
		} catch (e) {
			setActionError(
				e instanceof Error ? e.message : "Failed to load expense thread",
			);
			setExpense(null);
			setProposals([]);
			setSummary(null);
			setThreadMessages([]);
		} finally {
			setLoading(false);
		}
	}, [spaceId, expenseId, applyExpenseToDraftHeaders]);

	useEffect(() => {
		void load();
	}, [load]);

	/** Live thread updates on `thread:{id}`: messages + capture proposals. */
	useEffect(() => {
		if (threadId == null) return;

		const topic = `thread:${String(threadId)}`;
		const expectedTid = Number(threadId);
		let cancelled = false;
		let unsubscribe: (() => void) | undefined;

		const handleEvent = (e: WsEnvelope) => {
			if (e.op === "expense_thread.message.created") {
				const raw = e.data?.message;
				if (!raw || typeof raw !== "object") return;
				const msg = raw as ExpenseThreadMessage;
				if (Number(msg.thread_id) !== expectedTid) return;

				setThreadMessages((prev) => {
					if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
					setSummary((s) =>
						s ? { ...s, message_count: s.message_count + 1 } : s,
					);
					return [...prev, msg];
				});
				return;
			}

			if (e.op === "expense_thread.proposal.created") {
				const raw = e.data?.proposal;
				if (!raw || typeof raw !== "object") return;
				const proposal = raw as ExpenseThreadItemProposal;
				if (Number(proposal.thread_id) !== expectedTid) return;

				setProposals((prev) => {
					if (prev.some((p) => String(p.id) === String(proposal.id))) {
						return prev;
					}
					// Newest first (matches GET /thread/proposals)
					return [proposal, ...prev];
				});
				return;
			}

			if (e.op === "expense_thread.proposal.resolved") {
				const d = e.data;
				if (!d || typeof d !== "object") return;
				const pid = (d as { proposal_id?: unknown }).proposal_id;
				const st = (d as { status?: unknown }).status;
				if (pid == null || (st !== "accepted" && st !== "rejected")) return;

				setProposals((prev) =>
					prev.map((p) =>
						String(p.id) === String(pid)
							? {
									...p,
									status: st as "accepted" | "rejected",
								}
							: p,
					),
				);
				return;
			}

			if (e.op === "expense_thread.message.deleted") {
				const d = e.data;
				if (!d || typeof d !== "object") return;
				const mid = (d as { message_id?: unknown }).message_id;
				if (mid == null) return;
				setThreadMessages((prev) =>
					prev.filter((m) => String(m.id) !== String(mid)),
				);
				setSummary((s) =>
					s
						? {
								...s,
								message_count: Math.max(0, s.message_count - 1),
							}
						: s,
				);
				return;
			}

			if (e.op === "expense_thread.message.updated") {
				const raw = e.data?.message;
				if (!raw || typeof raw !== "object") return;
				const msg = raw as ExpenseThreadMessage;
				if (Number(msg.thread_id) !== expectedTid) return;
				setThreadMessages((prev) =>
					prev.map((m) => (String(m.id) === String(msg.id) ? msg : m)),
				);
			}
		};

		void (async () => {
			try {
				const unsub = await wsClient.subscribe(topic, handleEvent);
				if (cancelled) {
					unsub();
					return;
				}
				unsubscribe = unsub;
			} catch {
				// missing token or WS unavailable — thread still works via REST
			}
		})();

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, [threadId]);

	const sendThreadMessage = useCallback(
		async (body: string) => {
			const text = body.trim();
			if (!text || threadId == null || finalized) return;
			setActionError(null);
			try {
				const { message } = await apiClient.threads.postMessage(threadId, {
					body: text,
				});
				setThreadMessages((prev) => {
					if (prev.some((m) => String(m.id) === String(message.id))) {
						return prev;
					}
					setSummary((s) =>
						s ? { ...s, message_count: s.message_count + 1 } : s,
					);
					return [...prev, message];
				});
			} catch (e) {
				setActionError(e instanceof Error ? e.message : "Failed to send");
			}
		},
		[threadId, finalized],
	);

	const updateThreadMessage = useCallback(
		async (messageId: string | number, body: string) => {
			const text = body.trim();
			if (!text || threadId == null || finalized) return;
			setActionError(null);
			try {
				const { message } = await apiClient.threads.patchMessage(
					threadId,
					messageId,
					{ body: text },
				);
				setThreadMessages((prev) =>
					prev.map((m) => (String(m.id) === String(message.id) ? message : m)),
				);
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to update message",
				);
			}
		},
		[threadId, finalized],
	);

	const deleteThreadMessage = useCallback(
		async (messageId: string | number) => {
			if (threadId == null || finalized) return;
			setActionError(null);
			try {
				await apiClient.threads.deleteMessage(threadId, messageId);
				setThreadMessages((prev) =>
					prev.filter((m) => String(m.id) !== String(messageId)),
				);
				setSummary((s) =>
					s
						? {
								...s,
								message_count: Math.max(0, s.message_count - 1),
							}
						: s,
				);
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to delete message",
				);
			}
		},
		[threadId, finalized],
	);

	const loadOlderThreadMessages = useCallback(async () => {
		if (threadId == null || threadMessages.length === 0 || loadOlderBusy)
			return;
		const cursor = threadMessages[0]?.id;
		if (cursor == null) return;
		setLoadOlderBusy(true);
		setActionError(null);
		try {
			const { messages: older } = await apiClient.threads.listMessages(
				threadId,
				{ cursor, limit: MESSAGE_LIMIT },
			);
			if (older.length === 0) {
				setHasOlder(false);
				return;
			}
			setThreadMessages((prev) => [...older, ...prev]);
			setHasOlder(older.length === MESSAGE_LIMIT);
		} catch (e) {
			setActionError(
				e instanceof Error ? e.message : "Failed to load older messages",
			);
		} finally {
			setLoadOlderBusy(false);
		}
	}, [threadId, threadMessages, loadOlderBusy]);

	const toggleApprove = useCallback(
		async (currentUserId: number) => {
			if (threadId == null || finalized) return;
			setActionError(null);
			try {
				const approverIds = summary?.approver_user_ids ?? [];
				const iApproved = approverIds.some(
					(id) => Number(id) === currentUserId,
				);
				if (iApproved) {
					await apiClient.threads.unapprove(threadId);
					setSummary((prev) =>
						prev
							? {
									...prev,
									approval_count: Math.max(0, prev.approval_count - 1),
									approver_user_ids: prev.approver_user_ids.filter(
										(id) => Number(id) !== currentUserId,
									),
								}
							: prev,
					);
				} else {
					await apiClient.threads.approve(threadId);
					setSummary((prev) =>
						prev
							? {
									...prev,
									approval_count: prev.approval_count + 1,
									approver_user_ids: [...prev.approver_user_ids, currentUserId],
								}
							: prev,
					);
				}
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Approval update failed",
				);
			}
		},
		[threadId, finalized, summary?.approver_user_ids],
	);

	const finalizeThread = useCallback(async (): Promise<boolean> => {
		if (threadId == null) return false;
		setActionError(null);
		try {
			await apiClient.threads.finalize(threadId);
			await load();
			return true;
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Finalize failed");
			return false;
		}
	}, [threadId, load]);

	const setEqualSplitPercents = useCallback(() => {
		const n = threadMembers.length;
		if (n <= 0) return;
		const eq = 100 / n;
		setSplitRows(
			threadMembers.map((m, i) => ({
				user_id: Number(m.user_id),
				percent:
					i === n - 1
						? String(Math.round((100 - eq * (n - 1)) * 100) / 100)
						: String(Math.round(eq * 100) / 100),
			})),
		);
	}, [threadMembers]);

	/** 100% to draft owner, 0% to everyone else (matches default before first save). */
	const resetSplitOwnerHundred = useCallback(() => {
		if (summary == null) return;
		const creatorId = Number(summary.thread.created_by_user_id);
		setSplitRows(
			threadMembers.map((m) => {
				const uid = Number(m.user_id);
				return {
					user_id: uid,
					percent: uid === creatorId ? "100" : "0",
				};
			}),
		);
	}, [summary, threadMembers]);

	const setPercentChange = useCallback((userId: number, value: string) => {
		setSplitRows((prev) =>
			prev.map((row) =>
				row.user_id === userId ? { ...row, percent: value } : row,
			),
		);
	}, []);

	const saveSplits = useCallback(
		async (currentUserId: number) => {
			if (expenseId == null || summary == null || finalized) return;
			if (!userIsThreadOrSpaceMaster(summary, threadMembers, currentUserId)) {
				return;
			}
			const pcts = splitRows.map((r) => Number.parseFloat(r.percent));
			if (pcts.some((p) => Number.isNaN(p) || p < 0)) {
				setActionError("Enter a valid percentage for each member.");
				return;
			}
			const sumPct = pcts.reduce((s, p) => s + p, 0);
			if (Math.abs(sumPct - 100) > 0.1) {
				setActionError("Percentages must sum to 100%.");
				return;
			}
			const amounts = percentsToAmounts(pcts, total);
			setSplitsSaving(true);
			setActionError(null);
			try {
				await apiClient.finances.expenses.putSplits(
					expenseId,
					splitRows.map((r, i) => ({
						user_id: r.user_id,
						amount: amounts[i] ?? 0,
					})),
				);
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to save splits",
				);
			} finally {
				setSplitsSaving(false);
			}
		},
		[expenseId, summary, finalized, splitRows, total, threadMembers],
	);

	const changeDraftItem = useCallback(
		(id: string, patch: Partial<BuilderItem>) => {
			setDraftItems((prev) =>
				prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
			);
		},
		[],
	);

	const addDraftItem = useCallback(() => {
		setDraftItems((prev) => [...prev, newBuilderItem()]);
	}, []);

	const removeDraftItem = useCallback((id: string) => {
		setDraftItems((prev) =>
			prev.length <= 1 ? prev : prev.filter((i) => i.id !== id),
		);
	}, []);

	const saveExpenseHeader = useCallback(
		async (ownerUserId: number): Promise<boolean> => {
			if (spaceId == null || expenseId == null || expense == null || finalized)
				return false;
			if (Number(expense.user_id) !== ownerUserId) return false;
			if (expense.status !== "draft") return false;
			const titleTrim = draftTitle.trim();
			if (!titleTrim) {
				setActionError("Title is required — set a short label in the form.");
				return false;
			}
			const cur = (draftCurrency.trim() || "USD").toUpperCase();
			if (cur.length !== 3) {
				setActionError("Currency must be a 3-letter ISO code (e.g. USD).");
				return false;
			}
			setThreadCaptureBusy(true);
			setActionError(null);
			try {
				await apiClient.finances.expenses.update(
					expenseId,
					buildExpenseHeaderPatch(),
				);
				await refreshExpenseAndProposals();
				return true;
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to save expense",
				);
				return false;
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[
			spaceId,
			expenseId,
			expense,
			finalized,
			draftTitle,
			draftCurrency,
			buildExpenseHeaderPatch,
			refreshExpenseAndProposals,
		],
	);

	const saveDraftExpense = useCallback(
		async (ownerUserId: number) => {
			if (spaceId == null || expenseId == null || expense == null || finalized)
				return;
			if (Number(expense.user_id) !== ownerUserId) return;
			if (expense.status !== "draft") return;
			const titleTrim = draftTitle.trim();
			if (!titleTrim) {
				setActionError(
					"Title is required — use Edit expense to set a short label.",
				);
				return;
			}
			const cur = (draftCurrency.trim() || "USD").toUpperCase();
			if (cur.length !== 3) {
				setActionError("Currency must be a 3-letter ISO code (e.g. USD).");
				return;
			}
			const payloadItems = draftItems
				.map((it) => {
					const amount = toNumber(it.amount);
					const tagNames = parseTags(it.tags);
					const tags = tagNames.length > 0 ? tagNames : ["general"];
					const lineNotes = (it.notes ?? "").trim();
					return {
						amount,
						name: it.name.trim(),
						emotion: "neutral",
						tags: tags.map((name) => ({ name })),
						...(lineNotes ? { notes: lineNotes } : {}),
					};
				})
				.filter((it) => it.name && it.amount !== 0);
			if (!payloadItems.length) {
				setActionError("Add at least one line with a name and amount.");
				return;
			}
			setThreadCaptureBusy(true);
			setActionError(null);
			try {
				await apiClient.finances.expenses.update(expenseId, {
					...buildExpenseHeaderPatch(),
					items: payloadItems,
				});
				await refreshExpenseAndProposals();
			} catch (e) {
				setActionError(e instanceof Error ? e.message : "Failed to save draft");
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[
			spaceId,
			expenseId,
			expense,
			finalized,
			draftItems,
			buildExpenseHeaderPatch,
			refreshExpenseAndProposals,
		],
	);

	const createProposalFromParsed = useCallback(
		async (
			description: string,
			parsed: {
				name: string;
				amount: number;
				tags?: string[];
				notes?: string;
			}[],
			parseMeta?: { vendorName?: string; payeeText?: string },
		) => {
			if (spaceId == null || expenseId == null || finalized) return;
			const lines = parsed
				.map((p) => {
					const name = String(p?.name ?? "").trim();
					const amount = Number(p?.amount);
					const lineNotes = String(p?.notes ?? "").trim();
					return {
						name,
						amount,
						tags: p.tags?.length ? p.tags : ["general"],
						emotion: "neutral" as const,
						...(lineNotes ? { notes: lineNotes } : {}),
					};
				})
				.filter(
					(p) =>
						p.name.length > 0 && Number.isFinite(p.amount) && p.amount !== 0,
				);
			if (!lines.length) {
				setActionError(
					"Nothing to propose — parser returned no lines with a name and non-zero amount.",
				);
				return;
			}
			setThreadCaptureBusy(true);
			setActionError(null);
			try {
				const vn = parseMeta?.vendorName?.trim();
				const pt = parseMeta?.payeeText?.trim();
				await apiClient.threads.createProposal(spaceId, expenseId, {
					description: description.trim(),
					items: lines,
					...(vn ? { parsed_vendor_name: vn } : {}),
					...(pt ? { parsed_payee_text: pt } : {}),
				});
				setThreadParseInput("");
				await refreshExpenseAndProposals();
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to submit proposal",
				);
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[spaceId, expenseId, finalized, refreshExpenseAndProposals],
	);

	const submitThreadParseText = useCallback(async () => {
		if (spaceId == null) return;
		const text = threadParseInput.trim();
		if (!text) return;
		setThreadCaptureBusy(true);
		setActionError(null);
		try {
			const res = await httpClient.post<{
				items?: {
					name: string;
					amount: number;
					tags?: string[];
					notes?: string;
				}[];
				vendor_name?: string;
				payee_text?: string;
			}>(`/api/v1/spaces/${String(spaceId)}/transactions/parse/text`, {
				text,
			});
			const parsed = res.data?.items ?? [];
			await createProposalFromParsed(text, parsed, {
				vendorName: res.data?.vendor_name,
				payeeText: res.data?.payee_text,
			});
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Failed to parse text");
		} finally {
			setThreadCaptureBusy(false);
		}
	}, [spaceId, threadParseInput, createProposalFromParsed]);

	const submitThreadParsePhoto = useCallback(
		async (file: File) => {
			if (spaceId == null) return;
			setThreadCaptureBusy(true);
			setActionError(null);
			try {
				const fd = new FormData();
				fd.append("image", file);
				const res = await httpClient.post<{
					items?: {
						name: string;
						amount: number;
						tags?: string[];
						notes?: string;
					}[];
					vendor_name?: string;
					payee_text?: string;
				}>(`/api/v1/spaces/${String(spaceId)}/transactions/parse/photo`, fd, {
					headers: { "Content-Type": "multipart/form-data" },
				});
				const parsed = res.data?.items ?? [];
				const description = `Photo: ${file.name}`;
				await createProposalFromParsed(description, parsed, {
					vendorName: res.data?.vendor_name,
					payeeText: res.data?.payee_text,
				});
			} catch (e) {
				setActionError(
					e instanceof Error ? e.message : "Failed to parse photo",
				);
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[spaceId, createProposalFromParsed],
	);

	const stopThreadRecordingAndParse = useCallback(async () => {
		const rec = mediaRecorderRef.current;
		if (!rec || rec.state !== "recording") return;
		const stopPromise = new Promise<void>((resolve) => {
			rec.addEventListener("stop", () => resolve(), { once: true });
		});
		rec.stop();
		await stopPromise;
		const blob = new Blob(mediaChunksRef.current, {
			type: rec.mimeType || "audio/webm",
		});
		mediaChunksRef.current = [];
		if (spaceId == null) return;
		setThreadCaptureBusy(true);
		setActionError(null);
		try {
			const fd = new FormData();
			fd.append(
				"voice",
				new File([blob], "voice.webm", { type: blob.type || "audio/webm" }),
			);
			const res = await httpClient.post<{
				items?: {
					name: string;
					amount: number;
					tags?: string[];
					notes?: string;
				}[];
				transcription?: string;
				vendor_name?: string;
				payee_text?: string;
			}>(`/api/v1/spaces/${String(spaceId)}/transactions/parse/voice`, fd, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			const parsed = res.data?.items ?? [];
			const description = res.data?.transcription?.trim() || "Voice expense";
			await createProposalFromParsed(description, parsed, {
				vendorName: res.data?.vendor_name,
				payeeText: res.data?.payee_text,
			});
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Failed to parse voice");
		} finally {
			setThreadCaptureBusy(false);
		}
	}, [spaceId, createProposalFromParsed]);

	const toggleThreadRecording = useCallback(async () => {
		if (isThreadRecording) {
			setIsThreadRecording(false);
			await stopThreadRecordingAndParse();
			return;
		}
		setActionError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const rec = new MediaRecorder(stream);
			mediaRecorderRef.current = rec;
			mediaChunksRef.current = [];
			rec.addEventListener("dataavailable", (e) => {
				if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
			});
			rec.addEventListener("stop", () => {
				for (const t of stream.getTracks()) {
					t.stop();
				}
			});
			rec.start();
			setIsThreadRecording(true);
		} catch (e) {
			setIsThreadRecording(false);
			setActionError(
				e instanceof Error ? e.message : "Microphone permission denied",
			);
		}
	}, [isThreadRecording, stopThreadRecordingAndParse]);

	const acceptProposal = useCallback(
		async (proposalId: number, currentUserId: number) => {
			if (spaceId == null || expenseId == null) return;
			if (summary == null) {
				setActionError("Thread is still loading — try again in a moment.");
				return;
			}
			if (!userIsThreadOrSpaceMaster(summary, threadMembers, currentUserId)) {
				setActionError(
					"Only the thread creator or space owner can merge captures into the draft.",
				);
				return;
			}
			setThreadCaptureBusy(true);
			setActionError(null);
			setPayeeMismatchNotice(null);
			try {
				const res = await apiClient.threads.acceptProposal(
					spaceId,
					expenseId,
					proposalId,
				);
				if (res.payee_mismatch?.mismatch) {
					setPayeeMismatchNotice(res.payee_mismatch);
				}
				if (res.message) {
					const merged = res.message;
					setThreadMessages((prev) => {
						if (prev.some((m) => String(m.id) === String(merged.id))) {
							return prev;
						}
						setSummary((s) =>
							s ? { ...s, message_count: s.message_count + 1 } : s,
						);
						return [...prev, merged];
					});
				}
				await refreshExpenseAndProposals();
			} catch (e) {
				setActionError(e instanceof Error ? e.message : "Failed to accept");
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[spaceId, expenseId, summary, threadMembers, refreshExpenseAndProposals],
	);

	const rejectProposal = useCallback(
		async (proposalId: number) => {
			if (spaceId == null || expenseId == null) return;
			setThreadCaptureBusy(true);
			setActionError(null);
			try {
				await apiClient.threads.rejectProposal(spaceId, expenseId, proposalId);
				await refreshExpenseAndProposals();
			} catch (e) {
				setActionError(e instanceof Error ? e.message : "Failed to reject");
			} finally {
				setThreadCaptureBusy(false);
			}
		},
		[spaceId, expenseId, refreshExpenseAndProposals],
	);

	const handleThreadParseKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
				e.preventDefault();
				void submitThreadParseText();
			}
		},
		[submitThreadParseText],
	);

	return {
		expense,
		proposals,
		draftDescription,
		setDraftDescription,
		draftTitle,
		setDraftTitle,
		draftPayeeText,
		setDraftPayeeText,
		draftCurrency,
		setDraftCurrency,
		draftTxnDate,
		setDraftTxnDate,
		draftInvoiceRef,
		setDraftInvoiceRef,
		draftNotes,
		setDraftNotes,
		draftVendorId,
		setDraftVendorId,
		draftItems,
		changeDraftItem,
		addDraftItem,
		removeDraftItem,
		saveExpenseHeader,
		saveDraftExpense,
		summary,
		threadMessages,
		threadMembers,
		splitRows,
		total,
		loading,
		actionError,
		setActionError,
		loadOlderBusy,
		hasOlder,
		splitsSaving,
		threadId,
		finalized,
		load,
		sendThreadMessage,
		updateThreadMessage,
		deleteThreadMessage,
		loadOlderThreadMessages,
		toggleApprove,
		finalizeThread,
		setEqualSplitPercents,
		resetSplitOwnerHundred,
		setPercentChange,
		saveSplits,
		threadParseInput,
		setThreadParseInput,
		threadCaptureBusy,
		isThreadRecording,
		submitThreadParseText,
		submitThreadParsePhoto,
		toggleThreadRecording,
		handleThreadParseKeyDown,
		acceptProposal,
		rejectProposal,
		payeeMismatchNotice,
		dismissPayeeMismatchNotice: () => setPayeeMismatchNotice(null),
	};
};

export type ExpenseThreadController = ReturnType<typeof useExpenseThreadState>;
