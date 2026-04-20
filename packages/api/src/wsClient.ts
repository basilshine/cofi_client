export type WsEnvelope = {
	id?: string;
	type: "rpc" | "event" | "error";
	op?: string;
	topic?: string;
	data?: Record<string, unknown>;
	error?: { code: string; message: string };
};

export type WsClientConfig = {
	baseWsUrl: string; // e.g. ws://127.0.0.1:8090
	getAccessToken: () => string | null;
};

type RpcResolver = {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
};

const makeId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
	return `rpc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const createWsClient = (config: WsClientConfig) => {
	let socket: WebSocket | null = null;
	let isClosedByUser = false;

	const pending = new Map<string, RpcResolver>();
	const topicHandlers = new Map<string, Set<(env: WsEnvelope) => void>>();
	const globalHandlers = new Set<(env: WsEnvelope) => void>();

	const getWsUrl = () => {
		const base = config.baseWsUrl.replace(/\/+$/, "");
		return `${base}/api/v1/ws`;
	};

	const emit = (env: WsEnvelope) => {
		for (const h of globalHandlers) h(env);
		if (!env.topic) return;
		const set = topicHandlers.get(env.topic);
		if (!set) return;
		for (const h of set) h(env);
	};

	const handleMessage = (raw: MessageEvent<string>) => {
		let env: WsEnvelope | null = null;
		try {
			env = JSON.parse(raw.data) as WsEnvelope;
		} catch {
			return;
		}
		if (!env) return;

		if ((env.type === "rpc" || env.type === "error") && env.id) {
			const p = pending.get(env.id);
			if (!p) return;
			pending.delete(env.id);
			if (env.type === "error") {
				p.reject(new Error(env.error?.message ?? "WS error"));
				return;
			}
			p.resolve(env.data?.result);
			return;
		}

		if (env.type === "event") {
			emit(env);
		}
	};

	const connect = async () => {
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		const token = config.getAccessToken();
		if (!token) throw new Error("Missing access token");

		isClosedByUser = false;

		const wsUrl = getWsUrl();

		// Browser WS cannot set Authorization header; pass token as query param.
		// Backend will accept it (we’ll handle in server).
		const url = new URL(wsUrl);
		url.searchParams.set("token", token);

		socket = new WebSocket(url.toString());

		socket.onmessage = handleMessage;

		socket.onclose = async () => {
			if (isClosedByUser) return;

			// reject pending RPCs
			for (const [id, r] of pending.entries()) {
				r.reject(new Error("WS closed"));
				pending.delete(id);
			}

			// reconnect with backoff
			let delay = 250;
			while (!isClosedByUser) {
				await wait(delay);
				try {
					await connect();
					// re-subscribe to existing topics
					for (const topic of topicHandlers.keys()) {
						try {
							// eslint-disable-next-line no-await-in-loop
							await rpc("subscribe", {}, { topic });
						} catch {
							// ignore
						}
					}
					return;
				} catch {
					delay = Math.min(5000, Math.floor(delay * 1.8));
				}
			}
		};

		await new Promise<void>((resolve, reject) => {
			if (!socket) return reject(new Error("WS init failed"));
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("WS connection failed"));
		});
	};

	const close = () => {
		isClosedByUser = true;
		if (!socket) return;
		socket.close();
		socket = null;
	};

	const send = (env: WsEnvelope) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			throw new Error("WS not connected");
		}
		socket.send(JSON.stringify(env));
	};

	const rpc = async <T = unknown>(op: string, data: Record<string, unknown>, opts?: { topic?: string }) => {
		await connect();
		const id = makeId();
		const promise = new Promise<T>((resolve, reject) => {
			pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
			try {
				send({ id, type: "rpc", op, topic: opts?.topic, data });
			} catch (e) {
				pending.delete(id);
				reject(e instanceof Error ? e : new Error("WS send failed"));
			}
		});
		return await promise;
	};

	const subscribe = async (topic: string, handler: (env: WsEnvelope) => void) => {
		const set = topicHandlers.get(topic) ?? new Set();
		set.add(handler);
		topicHandlers.set(topic, set);
		await rpc("subscribe", {}, { topic });
		return () => {
			const current = topicHandlers.get(topic);
			if (!current) return;
			current.delete(handler);
			if (current.size === 0) topicHandlers.delete(topic);
			void rpc("unsubscribe", {}, { topic }).catch(() => {});
		};
	};

	const onEvent = (handler: (env: WsEnvelope) => void) => {
		globalHandlers.add(handler);
		return () => globalHandlers.delete(handler);
	};

	return { connect, close, rpc, subscribe, onEvent };
};

