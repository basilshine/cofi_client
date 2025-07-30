import { useAuth } from "@contexts/AuthContext";
import { Download } from "@phosphor-icons/react";
import { useState } from "react";

export const Profile = () => {
	const { user, logout } = useAuth();
	const [emailNotifications, setEmailNotifications] = useState(true);
	const [darkMode, setDarkMode] = useState(false);

	const handleLogout = () => {
		logout();
	};

	const handleExportData = () => {
		// TODO: Implement data export functionality
		console.log("Export data requested");
	};

	const handleDeleteAccount = () => {
		// TODO: Implement account deletion with confirmation
		if (
			window.confirm(
				"Are you sure you want to delete your account? This action cannot be undone.",
			)
		) {
			console.log("Account deletion requested");
		}
	};

	return (
		<div className="space-y-8">
			{/* User Information Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					User Information
				</h2>
				<div className="bg-white rounded-xl shadow-sm mx-4">
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="email"
						>
							Email Address
						</label>
						<div className="flex items-center mt-1">
							<input
								className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent"
								id="email"
								type="email"
								value={user?.email || ""}
								readOnly
							/>
							<button
								type="button"
								className="text-sm font-medium text-[#47c1ea] ml-4"
							>
								Edit
							</button>
						</div>
					</div>

					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="country"
						>
							Country
						</label>
						<select
							className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
							id="country"
						>
							<option>United States</option>
							<option>United Kingdom</option>
							<option>Canada</option>
							<option>Russia</option>
						</select>
					</div>

					<div className="p-4">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="currency"
						>
							Default Currency
						</label>
						<select
							className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
							id="currency"
						>
							<option>USD ($)</option>
							<option>EUR (€)</option>
							<option>GBP (£)</option>
							<option>RUB (₽)</option>
						</select>
					</div>
				</div>
			</section>

			{/* App Settings Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					App Settings
				</h2>
				<div className="bg-white rounded-xl shadow-sm mx-4">
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="language"
						>
							Language
						</label>
						<select
							className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
							id="language"
						>
							<option>English (United States)</option>
							<option>Русский (Россия)</option>
							<option>Español (España)</option>
							<option>Français (France)</option>
						</select>
					</div>

					<div className="p-4">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="timezone"
						>
							Timezone
						</label>
						<select
							className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
							id="timezone"
						>
							<option>(GMT-08:00) Pacific Time</option>
							<option>(GMT-05:00) Eastern Time</option>
							<option>(GMT+01:00) Central European Time</option>
							<option>(GMT+03:00) Moscow Time</option>
						</select>
					</div>
				</div>
			</section>

			{/* Preferences Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					Preferences
				</h2>
				<div className="bg-white rounded-xl shadow-sm mx-4">
					<div className="flex items-center justify-between p-4 border-b border-gray-200">
						<p className="text-[#1e3a8a] font-medium">Email Notifications</p>
						<label className="relative flex h-8 w-14 cursor-pointer items-center rounded-full bg-[#e0f2f7] p-1 has-[:checked]:bg-[#47c1ea] has-[:checked]:justify-end">
							<div className="h-6 w-6 rounded-full bg-white shadow-md transition-transform" />
							<input
								checked={emailNotifications}
								onChange={(e) => setEmailNotifications(e.target.checked)}
								className="invisible absolute"
								type="checkbox"
							/>
						</label>
					</div>

					<div className="flex items-center justify-between p-4 border-b border-gray-200">
						<p className="text-[#1e3a8a] font-medium">Dark Mode</p>
						<label className="relative flex h-8 w-14 cursor-pointer items-center rounded-full bg-[#e0f2f7] p-1 has-[:checked]:bg-[#47c1ea] has-[:checked]:justify-end">
							<div className="h-6 w-6 rounded-full bg-white shadow-md transition-transform" />
							<input
								checked={darkMode}
								onChange={(e) => setDarkMode(e.target.checked)}
								className="invisible absolute"
								type="checkbox"
							/>
						</label>
					</div>

					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="date-format"
						>
							Date Format
						</label>
						<select
							className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
							id="date-format"
						>
							<option>MM/DD/YYYY</option>
							<option>DD/MM/YYYY</option>
							<option>YYYY-MM-DD</option>
						</select>
					</div>

					<div className="flex items-center justify-between p-4">
						<p className="text-[#1e3a8a] font-medium">Export Data</p>
						<button
							type="button"
							onClick={handleExportData}
							className="text-[#47c1ea]"
						>
							<Download size={24} />
						</button>
					</div>
				</div>
			</section>

			{/* Account Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					Account
				</h2>
				<div className="mx-4 space-y-4">
					<button
						type="button"
						onClick={handleLogout}
						className="w-full text-left p-4 bg-white rounded-xl shadow-sm flex items-center justify-between"
					>
						<span className="font-medium text-[#1e3a8a]">Sign Out</span>
						<svg
							className="text-[#64748b]"
							fill="none"
							height="20"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 24 24"
							width="20"
							aria-label="Navigate to sign out"
						>
							<title>Navigate to sign out</title>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>

					<button
						type="button"
						onClick={handleDeleteAccount}
						className="w-full text-left p-4 bg-[#fee2e2] rounded-xl shadow-sm"
					>
						<span className="font-medium text-[#ef4444]">Delete Account</span>
					</button>
				</div>
			</section>
		</div>
	);
};
