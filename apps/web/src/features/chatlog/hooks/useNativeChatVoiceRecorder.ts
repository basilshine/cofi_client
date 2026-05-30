import { useCallback, useRef, useState } from "react";

type StopRecordingResult = {
	blob: Blob;
	forMessage: boolean;
};

type UseNativeChatVoiceRecorderArgs = {
	onError: (message: string | null) => void;
};

export const useNativeChatVoiceRecorder = ({
	onError,
}: UseNativeChatVoiceRecorderArgs) => {
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaChunksRef = useRef<BlobPart[]>([]);
	const recordingForMessageRef = useRef(false);
	const isCancelingRef = useRef(false);

	const cancelRecording = useCallback(() => {
		const rec = mediaRecorderRef.current;
		isCancelingRef.current = true;
		if (rec && rec.state === "recording") {
			rec.stop();
		}
		mediaRecorderRef.current = null;
		mediaChunksRef.current = [];
		setIsRecording(false);
		recordingForMessageRef.current = false;
	}, []);

	const beginRecording = useCallback(
		async (forMessage: boolean) => {
			if (isRecording) return;
			recordingForMessageRef.current = forMessage;
			onError(null);
			try {
				isCancelingRef.current = false;
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				const rec = new MediaRecorder(stream);
				mediaRecorderRef.current = rec;
				mediaChunksRef.current = [];
				rec.addEventListener("dataavailable", (e) => {
					if (isCancelingRef.current) return;
					if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
				});
				rec.addEventListener("stop", () => {
					for (const t of stream.getTracks()) {
						t.stop();
					}
				});
				rec.start();
				setIsRecording(true);
			} catch (e) {
				setIsRecording(false);
				recordingForMessageRef.current = false;
				onError(
					e instanceof Error ? e.message : "Microphone permission denied",
				);
			}
		},
		[isRecording, onError],
	);

	const stopRecording =
		useCallback(async (): Promise<StopRecordingResult | null> => {
			const rec = mediaRecorderRef.current;
			if (!rec) return null;
			if (rec.state !== "recording") return null;

			const forMessage = recordingForMessageRef.current;
			recordingForMessageRef.current = false;
			isCancelingRef.current = false;
			setIsRecording(false);

			const stopPromise = new Promise<void>((resolve) => {
				rec.addEventListener("stop", () => resolve(), { once: true });
			});
			rec.stop();
			await stopPromise;

			const blob = new Blob(mediaChunksRef.current, {
				type: rec.mimeType || "audio/webm",
			});
			mediaRecorderRef.current = null;
			mediaChunksRef.current = [];
			return { blob, forMessage };
		}, []);

	return {
		beginRecording,
		cancelRecording,
		isRecording,
		stopRecording,
	};
};
