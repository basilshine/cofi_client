import { useAuth } from "@contexts/AuthContext";
import { Download } from "@phosphor-icons/react";
import type { ProfileUpdateRequest } from "@services/api";
import { useEffect, useState } from "react";

export const Profile = () => {
	const { user, logout, updateUser, isLoading, error } = useAuth();
	const [emailNotifications, setEmailNotifications] = useState(true);
	const [darkMode, setDarkMode] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState<ProfileUpdateRequest>({
		email: "",
		name: "",
		country: "",
		language: "",
		timezone: "",
		currency: "",
	});
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [saveSuccess, setSaveSuccess] = useState(false);

	// Initialize form data when user data is available
	useEffect(() => {
		if (user) {
			setFormData({
				email: user.email || "",
				name: user.name || "",
				country: user.country || "",
				language: user.language || "",
				timezone: user.timezone || "",
				currency: user.currency || "",
			});
		}
	}, [user]);

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

	const handleInputChange = (
		field: keyof ProfileUpdateRequest,
		value: string,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear field error when user starts typing
		if (formErrors[field]) {
			setFormErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	const validateForm = (): boolean => {
		const errors: Record<string, string> = {};

		if (!formData.email) {
			errors.email = "Email is required";
		} else if (!/\S+@\S+\.\S+/.test(formData.email)) {
			errors.email = "Email is invalid";
		}

		if (!formData.name) {
			errors.name = "Name is required";
		}

		if (!formData.country) {
			errors.country = "Country is required";
		}

		if (!formData.language) {
			errors.language = "Language is required";
		}

		if (!formData.timezone) {
			errors.timezone = "Timezone is required";
		}

		if (!formData.currency) {
			errors.currency = "Currency is required";
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSave = async () => {
		if (!validateForm()) {
			return;
		}

		try {
			await updateUser(formData);
			setIsEditing(false);
			setSaveSuccess(true);
			// Clear success message after 3 seconds
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (error) {
			// Error is already handled by the updateUser function
			console.error("Profile update failed:", error);
		}
	};

	const handleCancel = () => {
		// Reset form data to original user data
		if (user) {
			setFormData({
				email: user.email || "",
				name: user.name || "",
				country: user.country || "",
				language: user.language || "",
				timezone: user.timezone || "",
				currency: user.currency || "",
			});
		}
		setFormErrors({});
		setIsEditing(false);
	};

	return (
		<div className="space-y-8">
			{/* Success Message */}
			{saveSuccess && (
				<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mx-4">
					Profile updated successfully!
				</div>
			)}

			{/* Error Message */}
			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mx-4">
					{error}
				</div>
			)}

			{/* User Information Section */}
			<section className="space-y-4">
				<div className="flex items-center justify-between px-4 pb-2">
					<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight">
						User Information
					</h2>
					{!isEditing && (
						<button
							type="button"
							onClick={() => setIsEditing(true)}
							className="text-sm font-medium text-[#47c1ea] hover:text-[#3ba3c7] transition-colors"
						>
							Edit Profile
						</button>
					)}
				</div>
				<div className="bg-white rounded-xl shadow-sm mx-4">
					{/* Name Field */}
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="name"
						>
							Name
						</label>
						<div className="mt-1">
							<input
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent ${
									!isEditing ? "cursor-default" : ""
								}`}
								id="name"
								type="text"
								value={formData.name}
								onChange={(e) => handleInputChange("name", e.target.value)}
								readOnly={!isEditing}
							/>
							{formErrors.name && (
								<p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
							)}
						</div>
					</div>

					{/* Email Field */}
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="email"
						>
							Email Address
						</label>
						<div className="mt-1">
							<input
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent ${
									!isEditing ? "cursor-default" : ""
								}`}
								id="email"
								type="email"
								value={formData.email}
								onChange={(e) => handleInputChange("email", e.target.value)}
								readOnly={!isEditing}
							/>
							{formErrors.email && (
								<p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
							)}
						</div>
					</div>

					{/* Country Field */}
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="country"
						>
							Country
						</label>
						<div className="mt-1">
							<select
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none ${
									isEditing
										? "bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
										: "cursor-default"
								} ${!isEditing ? "pointer-events-none" : ""}`}
								id="country"
								value={formData.country}
								onChange={(e) => handleInputChange("country", e.target.value)}
								disabled={!isEditing}
							>
								<option value="">Select Country</option>
								<option value="United States">United States</option>
								<option value="United Kingdom">United Kingdom</option>
								<option value="Canada">Canada</option>
								<option value="Russia">Russia</option>
								<option value="Germany">Germany</option>
								<option value="France">France</option>
								<option value="Spain">Spain</option>
								<option value="Italy">Italy</option>
								<option value="Netherlands">Netherlands</option>
								<option value="Other">Other</option>
							</select>
							{formErrors.country && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.country}
								</p>
							)}
						</div>
					</div>

					{/* Currency Field */}
					<div className="p-4">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="currency"
						>
							Default Currency
						</label>
						<div className="mt-1">
							<select
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none ${
									isEditing
										? "bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
										: "cursor-default"
								} ${!isEditing ? "pointer-events-none" : ""}`}
								id="currency"
								value={formData.currency}
								onChange={(e) => handleInputChange("currency", e.target.value)}
								disabled={!isEditing}
							>
								<option value="">Select Currency</option>
								<option value="USD">USD ($)</option>
								<option value="EUR">EUR (€)</option>
								<option value="GBP">GBP (£)</option>
								<option value="RUB">RUB (₽)</option>
								<option value="CAD">CAD ($)</option>
								<option value="JPY">JPY (¥)</option>
								<option value="CNY">CNY (¥)</option>
								<option value="INR">INR (₹)</option>
							</select>
							{formErrors.currency && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.currency}
								</p>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* App Settings Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					App Settings
				</h2>
				<div className="bg-white rounded-xl shadow-sm mx-4">
					{/* Language Field */}
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="language"
						>
							Language
						</label>
						<div className="mt-1">
							<select
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none ${
									isEditing
										? "bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
										: "cursor-default"
								} ${!isEditing ? "pointer-events-none" : ""}`}
								id="language"
								value={formData.language}
								onChange={(e) => handleInputChange("language", e.target.value)}
								disabled={!isEditing}
							>
								<option value="">Select Language</option>
								<option value="en">English (United States)</option>
								<option value="ru">Русский (Россия)</option>
								<option value="es">Español (España)</option>
								<option value="fr">Français (France)</option>
								<option value="de">Deutsch (Deutschland)</option>
								<option value="it">Italiano (Italia)</option>
								<option value="pt">Português (Brasil)</option>
								<option value="zh">中文 (简体)</option>
								<option value="ja">日本語 (日本)</option>
							</select>
							{formErrors.language && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.language}
								</p>
							)}
						</div>
					</div>

					{/* Timezone Field */}
					<div className="p-4">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="timezone"
						>
							Timezone
						</label>
						<div className="mt-1">
							<select
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none ${
									isEditing
										? "bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
										: "cursor-default"
								} ${!isEditing ? "pointer-events-none" : ""}`}
								id="timezone"
								value={formData.timezone}
								onChange={(e) => handleInputChange("timezone", e.target.value)}
								disabled={!isEditing}
							>
								<option value="">Select Timezone</option>
								<option value="America/Los_Angeles">
									(GMT-08:00) Pacific Time
								</option>
								<option value="America/New_York">
									(GMT-05:00) Eastern Time
								</option>
								<option value="Europe/London">
									(GMT+00:00) Greenwich Mean Time
								</option>
								<option value="Europe/Berlin">
									(GMT+01:00) Central European Time
								</option>
								<option value="Europe/Moscow">(GMT+03:00) Moscow Time</option>
								<option value="Asia/Dubai">(GMT+04:00) Dubai Time</option>
								<option value="Asia/Kolkata">
									(GMT+05:30) India Standard Time
								</option>
								<option value="Asia/Shanghai">
									(GMT+08:00) China Standard Time
								</option>
								<option value="Asia/Tokyo">
									(GMT+09:00) Japan Standard Time
								</option>
								<option value="Australia/Sydney">
									(GMT+10:00) Australian Eastern Time
								</option>
							</select>
							{formErrors.timezone && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.timezone}
								</p>
							)}
						</div>
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

			{/* Save/Cancel Buttons */}
			{isEditing && (
				<section className="px-4">
					<div className="flex space-x-4">
						<button
							type="button"
							onClick={handleSave}
							disabled={isLoading}
							className="flex-1 bg-[#47c1ea] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#3ba3c7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? "Saving..." : "Save Changes"}
						</button>
						<button
							type="button"
							onClick={handleCancel}
							disabled={isLoading}
							className="flex-1 bg-gray-200 text-[#1e3a8a] py-3 px-4 rounded-xl font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Cancel
						</button>
					</div>
				</section>
			)}

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
