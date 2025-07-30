export const LoadingScreen = () => {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
			<div className="text-center max-w-md mx-auto px-6">
				{/* Animated Logo */}
				<div className="relative mb-8">
					<div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#47c1ea] to-[#2196f3] rounded-full flex items-center justify-center shadow-lg">
						<svg
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="white"
							className="animate-spin"
							aria-label="Loading spinner"
						>
							<title>Loading</title>
							<path
								d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								fill="none"
							/>
						</svg>
					</div>

					{/* Ripple Effect */}
					<div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-[#47c1ea] opacity-30 animate-ping" />
				</div>

				{/* Loading Text */}
				<div className="mb-6">
					<h2 className="text-xl font-bold text-[#1e3a8a] mb-2">Cofilance</h2>
					<p className="text-[#64748b]">Loading your financial dashboard...</p>
				</div>

				{/* Progress Indicator */}
				<div className="flex justify-center space-x-1">
					<div className="w-2 h-2 bg-[#47c1ea] rounded-full animate-bounce" />
					<div
						className="w-2 h-2 bg-[#47c1ea] rounded-full animate-bounce"
						style={{ animationDelay: "0.1s" }}
					/>
					<div
						className="w-2 h-2 bg-[#47c1ea] rounded-full animate-bounce"
						style={{ animationDelay: "0.2s" }}
					/>
				</div>
			</div>
		</div>
	);
};
