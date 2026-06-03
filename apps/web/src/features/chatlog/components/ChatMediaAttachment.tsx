import { FileImage, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { httpClient } from "../../../shared/lib/httpClient";

type ChatMediaAttachmentProps = {
	contentType?: string;
	filename?: string;
	mediaId: string | number;
	mediaKind?: string;
};

export const ChatMediaAttachment = ({
	contentType,
	filename,
	mediaId,
	mediaKind,
}: ChatMediaAttachmentProps) => {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		let localUrl: string | null = null;
		setObjectUrl(null);
		setError(null);
		void (async () => {
			try {
				const res = await httpClient.get<Blob>(`/api/v1/media/${mediaId}`, {
					responseType: "blob",
				});
				if (cancelled) return;
				localUrl = URL.createObjectURL(res.data);
				setObjectUrl(localUrl);
			} catch {
				if (!cancelled) setError("Image unavailable");
			}
		})();
		return () => {
			cancelled = true;
			if (localUrl) URL.revokeObjectURL(localUrl);
		};
	}, [mediaId]);

	if (mediaKind !== "image" && !contentType?.startsWith("image/")) return null;

	return (
		<div className="overflow-hidden rounded-xl border border-[rgba(64,91,118,0.16)] bg-[rgba(246,251,253,0.86)] shadow-sm">
			<div className="relative aspect-[16/9] max-h-64 w-full bg-[rgba(236,244,249,0.72)]">
				{objectUrl ? (
					<img
						alt={filename ? `Attached receipt ${filename}` : "Attached receipt"}
						className="h-full w-full object-contain"
						src={objectUrl}
					/>
				) : (
					<div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
						{error ? (
							<>
								<FileImage className="h-4 w-4" />
								{error}
							</>
						) : (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading image
							</>
						)}
					</div>
				)}
			</div>
			<div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
				<FileImage className="h-3.5 w-3.5 text-[#34556f]" />
				<span className="truncate">
					{filename?.trim() || "Receipt image"} · protected capture media
				</span>
			</div>
		</div>
	);
};
