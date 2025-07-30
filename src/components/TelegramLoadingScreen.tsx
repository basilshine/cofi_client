import { useEffect, useState } from "react";

interface TelegramLoadingScreenProps {
	error?: string | null;
}

export const TelegramLoadingScreen = ({
	error,
}: TelegramLoadingScreenProps) => {
	const [dots, setDots] = useState("");
	const [currentStep, setCurrentStep] = useState(0);

	const steps = [
		"Connecting to Telegram...",
		"Verifying your identity...",
		"Setting up your account...",
		"Loading your dashboard...",
	];

	useEffect(() => {
		const dotsInterval = setInterval(() => {
			setDots((prev) => {
				if (prev === "...") return "";
				return `${prev}.`;
			});
		}, 500);

		const stepInterval = setInterval(() => {
			setCurrentStep((prev) => (prev + 1) % steps.length);
		}, 2000);

		return () => {
			clearInterval(dotsInterval);
			clearInterval(stepInterval);
		};
	}, []);

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
			<div className="text-center max-w-md mx-auto px-6">
				{/* Animated Telegram Logo */}
				<div className="relative mb-8">
					<div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#47c1ea] to-[#2196f3] rounded-full flex items-center justify-center shadow-lg animate-pulse">
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="white"
							className="animate-bounce"
							aria-label="Telegram logo"
						>
							<title>Telegram</title>
							<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-.38.24-1.07.7-.96.66-1.97 1.35-1.97 1.35s-.27.19-.78.2c-.28.01-.83-.09-1.33-.27-.63-.23-1.13-.36-1.08-.76.02-.2.27-.4.74-.61.02-.01 3.05-1.35 3.05-1.35s.28-.13.64-.19c.2-.04.41-.06.59-.06.26 0 .49.07.67.18.13.08.23.19.29.32.04.08.06.17.07.26z" />
						</svg>
					</div>

					{/* Ripple Effect */}
					<div className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-2 border-[#47c1ea] opacity-30 animate-ping" />
					<div
						className="absolute inset-0 w-20 h-20 mx-auto rounded-full border-2 border-[#47c1ea] opacity-20 animate-ping"
						style={{ animationDelay: "0.5s" }}
					/>
				</div>

				{/* Loading Text */}
				<div className="mb-6">
					<h2 className="text-2xl font-bold text-[#1e3a8a] mb-2">
						Welcome to Cofilance
					</h2>
					<p className="text-[#64748b] text-lg min-h-[28px] transition-all duration-500">
						{steps[currentStep]}
						{dots}
					</p>
				</div>

				{/* Progress Bar */}
				<div className="w-full bg-[#e0f2f7] rounded-full h-2 mb-6 overflow-hidden">
					<div
						className="bg-gradient-to-r from-[#47c1ea] to-[#2196f3] h-2 rounded-full animate-pulse"
						style={{
							width: "70%",
							animation: "loading-progress 2s ease-in-out infinite",
						}}
					/>
				</div>

				{/* Status Messages */}
				<div className="space-y-3 text-sm text-[#64748b]">
					{steps.map((step, index) => (
						<div
							key={step}
							className="flex items-center justify-center space-x-3 transition-all duration-300"
						>
							<div
								className={`w-3 h-3 rounded-full transition-all duration-300 ${
									index <= currentStep
										? "bg-[#47c1ea] animate-pulse"
										: index === currentStep + 1
											? "bg-[#93c5fd] animate-pulse"
											: "bg-[#e0f2f7]"
								}`}
							/>
							<span
								className={`transition-all duration-300 ${
									index === currentStep ? "font-medium text-[#1e3a8a]" : ""
								}`}
							>
								{step.replace("...", "")}
							</span>
							{index <= currentStep && (
								<svg
									className="w-4 h-4 text-[#47c1ea]"
									fill="currentColor"
									viewBox="0 0 20 20"
									aria-label="Completed step"
								>
									<title>Completed</title>
									<path
										fillRule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clipRule="evenodd"
									/>
								</svg>
							)}
						</div>
					))}
				</div>

				{/* Error Message */}
				{error && (
					<div className="mt-6 p-4 bg-[#fee2e2] border border-[#fecaca] rounded-lg">
						<div className="flex items-center space-x-2">
							<svg
								className="w-5 h-5 text-[#ef4444]"
								fill="currentColor"
								viewBox="0 0 20 20"
								aria-label="Error icon"
							>
								<title>Error</title>
								<path
									fillRule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
									clipRule="evenodd"
								/>
							</svg>
							<p className="text-[#ef4444] text-sm font-medium">{error}</p>
						</div>
					</div>
				)}

				{/* Cofilance Branding */}
				<div className="mt-8 text-xs text-[#94a3b8]">
					<p>Powered by Cofilance</p>
					<p>Your personal finance assistant</p>
				</div>
			</div>

			<style>{`
				@keyframes loading-progress {
					0% { width: 30%; }
					50% { width: 80%; }
					100% { width: 30%; }
				}
			`}</style>
		</div>
	);
};
