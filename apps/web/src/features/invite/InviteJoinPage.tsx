import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";
import { staggerContainer, staggerItem } from "../../shared/lib/appMotion";
import { marketingUrl } from "../../shared/lib/ceitsMarketingUrl";
import {
	clearPendingInviteToken,
	persistInviteFromSearchParams,
	writePendingInviteToken,
} from "../../shared/lib/pendingInviteToken";
import {
	type InvitePreviewResponse,
	fetchInvitePreview,
} from "./invitePreviewApi";

const formatRole = (role: string | undefined): string => {
	if (!role) return "Member";
	const r = role.toLowerCase();
	const map: Record<string, string> = {
		owner: "Owner",
		admin: "Admin",
		editor: "Editor",
		member: "Member",
		viewer: "Viewer",
	};
	return map[r] ?? role;
};

const formatExpiry = (iso: string | undefined): string | null => {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

export const InviteJoinPage = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [acceptError, setAcceptError] = useState<string | null>(null);
	const [accepting, setAccepting] = useState(false);
	const [acceptedSpaceName, setAcceptedSpaceName] = useState<string | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	const token = useMemo(() => {
		const t =
			searchParams.get("token")?.trim() ?? searchParams.get("invite")?.trim();
		return t && t.length > 0 ? t : "";
	}, [searchParams]);

	const inviteQuery = token
		? `?invite=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(`/join?token=${token}`)}`
		: "";

	useEffect(() => {
		persistInviteFromSearchParams(searchParams);
	}, [searchParams]);

	useEffect(() => {
		if (!token) {
			setLoading(false);
			setPreview(null);
			return;
		}
		writePendingInviteToken(token);
		let cancelled = false;
		setLoading(true);
		setLoadError(null);
		void fetchInvitePreview(token)
			.then((data) => {
				if (!cancelled) setPreview(data);
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setLoadError(
						e instanceof Error ? e.message : "Could not load invite",
					);
					setPreview(null);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [token]);

	useEffect(() => {
		if (!token || authLoading || !isAuthenticated || loading) return;
		if (preview?.status !== "ready" && preview?.status !== "used") return;
		let cancelled = false;
		setAccepting(true);
		setAcceptError(null);
		void apiClient.spaces
			.acceptInvite(token)
			.then((outcome) => {
				if (cancelled) return;
				clearPendingInviteToken();
				if (outcome.kind === "space") {
					setAcceptedSpaceName(outcome.space.name ?? "space");
					window.setTimeout(() => {
						if (!cancelled) {
							navigate(
								`/console/chat?spaceId=${encodeURIComponent(String(outcome.space.id))}`,
								{ replace: true },
							);
						}
					}, 650);
					return;
				}
				window.setTimeout(() => {
					if (!cancelled) navigate("/console", { replace: true });
				}, 650);
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setAcceptError(
						e instanceof Error ? e.message : "Could not accept invite",
					);
				}
			})
			.finally(() => {
				if (!cancelled) setAccepting(false);
			});
		return () => {
			cancelled = true;
		};
	}, [authLoading, isAuthenticated, loading, navigate, preview?.status, token]);

	const headline = useMemo(() => {
		if (!preview || preview.status !== "ready") return null;
		if (preview.invite_kind === "space" && preview.space_name) {
			return (
				<>
					Join{" "}
					<span className="font-semibold text-[hsl(var(--text-primary))]">
						{preview.space_name}
					</span>
				</>
			);
		}
		return (
			<>
				Join workspace{" "}
				<span className="font-semibold text-[hsl(var(--text-primary))]">
					{preview.tenant_name ?? "Ceits"}
				</span>
			</>
		);
	}, [preview]);

	if (!token) {
		return (
			<div className="min-h-screen bg-[hsl(var(--bg))] px-4 py-16">
				<div className="mx-auto max-w-md rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-8 text-center">
					<h1 className="font-serif text-2xl text-[hsl(var(--text-primary))]">
						Missing invite
					</h1>
					<p className="mt-3 text-sm text-[hsl(var(--text-secondary))]">
						This page needs a link with a token. Ask the person who invited you
						to resend the invite.
					</p>
					<Link
						className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[hsl(var(--accent))] px-5 text-sm font-semibold text-[hsl(var(--accent-contrast))]"
						to="/auth"
					>
						Open Ceits
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[hsl(var(--bg))] px-4 py-12 md:py-20">
			<motion.div
				animate="visible"
				className="mx-auto w-full max-w-lg"
				initial="hidden"
				variants={staggerContainer}
			>
				<motion.div variants={staggerItem}>
					<a
						className="text-sm font-medium text-[hsl(var(--text-secondary))] underline-offset-4 hover:text-[hsl(var(--text-primary))] hover:underline"
						href={marketingUrl("/")}
					>
						← Ceits home
					</a>
				</motion.div>

				<motion.div
					className="mt-8 rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 shadow-sm md:p-8"
					variants={staggerItem}
				>
					{loading || authLoading ? (
						<p className="text-sm text-[hsl(var(--text-secondary))]">
							Loading invite…
						</p>
					) : loadError ? (
						<p className="text-sm text-destructive" role="alert">
							{loadError}
						</p>
					) : preview?.status === "not_found" ? (
						<div className="space-y-3 text-center">
							<h1 className="font-serif text-2xl text-[hsl(var(--text-primary))]">
								Invite not found
							</h1>
							<p className="text-sm text-[hsl(var(--text-secondary))]">
								This link may be wrong or out of date. Request a new invite from
								your host.
							</p>
						</div>
					) : preview?.status === "used" ? (
						<div className="space-y-3 text-center">
							<h1 className="font-serif text-2xl text-[hsl(var(--text-primary))]">
								Already joined
							</h1>
							<p className="text-sm text-[hsl(var(--text-secondary))]">
								This invite was already accepted. Open Ceits to continue.
							</p>
						</div>
					) : preview?.status === "expired" ? (
						<div className="space-y-3 text-center">
							<h1 className="font-serif text-2xl text-[hsl(var(--text-primary))]">
								Invite expired
							</h1>
							<p className="text-sm text-[hsl(var(--text-secondary))]">
								Ask your host to send a fresh invite.
							</p>
						</div>
					) : preview?.status === "ready" ? (
						<div className="space-y-6">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-secondary))]">
									You&apos;re invited
								</p>
								<h1 className="mt-2 font-serif text-3xl tracking-tight text-[hsl(var(--text-primary))] md:text-4xl">
									{headline}
								</h1>
								<p className="mt-3 text-sm leading-relaxed text-[hsl(var(--text-secondary))]">
									<span className="font-medium text-[hsl(var(--text-primary))]">
										{preview.inviter_name ?? "Someone"}
									</span>{" "}
									invited you
									{preview.invite_kind === "space"
										? " to collaborate in this space."
										: " to this workspace."}
								</p>
							</div>

							<dl className="grid gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] p-4 text-sm">
								{preview.invite_kind === "space" ? (
									<div className="flex flex-col gap-0.5">
										<dt className="text-xs font-medium text-[hsl(var(--text-secondary))]">
											Space
										</dt>
										<dd className="text-[hsl(var(--text-primary))]">
											{preview.space_name ?? "Shared space"}
										</dd>
									</div>
								) : null}
								<div className="flex flex-col gap-0.5">
									<dt className="text-xs font-medium text-[hsl(var(--text-secondary))]">
										Workspace
									</dt>
									<dd className="text-[hsl(var(--text-primary))]">
										{preview.tenant_name ?? "Ceits workspace"}
									</dd>
								</div>
								<div className="flex flex-col gap-0.5">
									<dt className="text-xs font-medium text-[hsl(var(--text-secondary))]">
										{preview.invite_kind === "tenant_only"
											? "Workspace role"
											: "Space role"}
									</dt>
									<dd className="text-[hsl(var(--text-primary))]">
										{preview.invite_kind === "tenant_only"
											? formatRole(preview.invited_tenant_role ?? undefined)
											: formatRole(preview.invited_space_role)}
									</dd>
								</div>
								{preview.invitee_email ? (
									<div className="flex flex-col gap-0.5">
										<dt className="text-xs font-medium text-[hsl(var(--text-secondary))]">
											Sent to
										</dt>
										<dd className="break-all text-[hsl(var(--text-primary))]">
											{preview.invitee_email}
										</dd>
									</div>
								) : null}
								{formatExpiry(preview.expires_at) ? (
									<div className="flex flex-col gap-0.5">
										<dt className="text-xs font-medium text-[hsl(var(--text-secondary))]">
											Expires
										</dt>
										<dd className="text-[hsl(var(--text-primary))]">
											{formatExpiry(preview.expires_at)}
										</dd>
									</div>
								) : null}
							</dl>

							{isAuthenticated ? (
								<div className="space-y-3">
									<p className="text-sm text-[hsl(var(--text-secondary))]">
										{accepting
											? "Accepting this invite..."
											: acceptedSpaceName
												? `Joined ${acceptedSpaceName}. Opening the space...`
												: "You're signed in. Ceits will accept this invite here and open the space."}
									</p>
									{acceptError ? (
										<p
											className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
											role="alert"
										>
											{acceptError}
										</p>
									) : null}
									<button
										className="flex h-11 w-full items-center justify-center rounded-lg bg-[hsl(var(--accent))] text-sm font-semibold text-[hsl(var(--accent-contrast))] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
										onClick={() =>
											void apiClient.spaces
												.acceptInvite(token)
												.then((outcome) => {
													clearPendingInviteToken();
													if (outcome.kind === "space") {
														navigate(
															`/console/chat?spaceId=${encodeURIComponent(String(outcome.space.id))}`,
															{ replace: true },
														);
													} else {
														navigate("/console", { replace: true });
													}
												})
												.catch((e: unknown) =>
													setAcceptError(
														e instanceof Error
															? e.message
															: "Could not accept invite",
													),
												)
										}
										disabled={accepting}
										type="button"
									>
										{accepting ? "Accepting..." : "Accept invite"}
									</button>
								</div>
							) : (
								<div className="flex flex-col gap-3">
									<Link
										className="flex h-11 w-full items-center justify-center rounded-lg bg-[hsl(var(--accent))] text-sm font-semibold text-[hsl(var(--accent-contrast))] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
										to={`/register${inviteQuery}`}
									>
										Create account
									</Link>
									<Link
										className="flex h-11 w-full items-center justify-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] text-sm font-semibold text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
										to={`/login${inviteQuery}`}
									>
										Log in
									</Link>
									<Link
										className="text-center text-xs text-[hsl(var(--text-secondary))] underline-offset-4 hover:underline"
										to={`/auth${inviteQuery}`}
									>
										Other sign-in options
									</Link>
								</div>
							)}
						</div>
					) : (
						<p className="text-sm text-[hsl(var(--text-secondary))]">
							Unexpected response.
						</p>
					)}
				</motion.div>
			</motion.div>
		</div>
	);
};
