import { Check, FileText, Image, Loader2, Mic, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type {
	CaptureProgressEvent,
	CaptureProgressInputKind,
	CaptureProgressStage,
} from "../hooks/useNativeChatComposerActions";

type ChatCaptureProgressShelfProps = {
	events: CaptureProgressEvent[];
	spaceId: string | number;
};

const stageLabel: Record<CaptureProgressStage, string> = {
	received: "Received",
	uploading: "Uploading",
	parsing: "Parsing",
	review_ready: "Review ready",
	ready: "Ready",
	failed: "Needs attention",
};

const inputIcon = (kind: CaptureProgressInputKind) => {
	if (kind === "photo") return Image;
	if (kind === "voice") return Mic;
	return FileText;
};

export const ChatCaptureProgressShelf = ({
	events,
	spaceId,
}: ChatCaptureProgressShelfProps) => {
	const visible = events.slice(0, 3);
	if (visible.length === 0) return null;

	return (
		<section
			aria-label="Capture progress"
			aria-live="polite"
			className="mx-auto mb-2 w-full max-w-[min(780px,95%)] rounded-2xl border border-[rgba(64,91,118,0.16)] bg-[rgba(246,251,253,0.94)] px-3 py-2 shadow-[0_-8px_24px_-22px_rgba(44,32,18,0.38)]"
		>
			<div className="mb-1 flex items-center justify-between gap-2">
				<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#34556f]">
					Capture progress
				</p>
				<p className="text-[10px] text-muted-foreground">
					Ceits is preparing review work
				</p>
			</div>
			<div className="max-h-36 space-y-1 overflow-y-auto pr-1">
				{visible.map((event) => {
					const Icon = inputIcon(event.inputKind);
					const reviewHref =
						event.sourceDocumentId != null
							? `/console/review?spaceId=${encodeURIComponent(String(spaceId))}&sourceDocumentId=${encodeURIComponent(String(event.sourceDocumentId))}`
							: null;
					const isBusy =
						event.stage === "uploading" ||
						event.stage === "parsing" ||
						event.stage === "review_ready";
					const isFailed = event.stage === "failed";
					const isReady = event.stage === "ready";
					return (
						<div
							className={[
								"flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs",
								isFailed
									? "border-destructive/25 bg-destructive/10 text-destructive"
									: isReady
										? "border-[rgba(70,110,70,0.22)] bg-[rgba(236,247,236,0.82)] text-[hsl(140_35%_22%)]"
										: "border-[rgba(64,91,118,0.12)] bg-white/72 text-foreground",
							].join(" ")}
							key={event.id}
						>
							<span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/62">
								<Icon className="h-4 w-4" />
							</span>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5">
									<span className="truncate font-semibold">{event.title}</span>
									<span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-bold">
										{stageLabel[event.stage]}
									</span>
								</div>
								<p className="truncate text-[11px] opacity-75">
									{event.detail ??
										(event.candidateCount != null
											? `${event.candidateCount} candidates found`
											: "Working")}
								</p>
							</div>
							{isBusy ? (
								<Loader2 className="h-4 w-4 shrink-0 animate-spin" />
							) : reviewHref ? (
								<Link
									className="shrink-0 rounded-full border border-current/20 bg-white/68 px-2 py-0.5 text-[10px] font-bold transition hover:bg-white"
									to={reviewHref}
								>
									Review capture
								</Link>
							) : isFailed ? (
								<XCircle className="h-4 w-4 shrink-0" />
							) : (
								<Check className="h-4 w-4 shrink-0" />
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
};
