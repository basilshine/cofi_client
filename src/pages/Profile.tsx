import {
	getCountryName,
	getCurrencyName,
	getLanguageName,
	getTimezoneName,
} from "@/utils/helper";
import { isTelegramWebApp } from "@/utils/isTelegramWebApp";
import { useAuth } from "@contexts/AuthContext";
import { Download } from "@phosphor-icons/react";
import type { ProfileUpdateRequest } from "@services/api";
import { apiService } from "@services/api";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export const Profile = () => {
	const { user, logout, updateUser, deleteAllData, isLoading, error } =
		useAuth();
	const [isEditing, setIsEditing] = useState(false);

	// TanStack Query mutation for test message
	const testMessageMutation = useMutation({
		mutationFn: (data: { chat_id: number; message?: string }) =>
			apiService.notify.testMessage(data),
		onSuccess: (response) => {
			console.log("[Profile] Test message sent successfully:", response.data);
			alert(
				"✅ Test message sent via backend!\n\nCheck your Telegram chat to see if the bot received it.",
			);
		},
		onError: (error) => {
			console.error(
				"[Profile] ❌ Error sending test message via backend:",
				error,
			);
			alert(
				`❌ Error sending test message via backend: ${error instanceof Error ? error.message : String(error)}`,
			);
		},
	});
	const [formData, setFormData] = useState<ProfileUpdateRequest>({
		email: "",
		name: "",
		country: "",
		language: "",
		timezone: "",
		currency: "",
		dateFormat: "",
		emailNotifications: true,
		darkMode: false,
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
				dateFormat: user.dateFormat || "MM/DD/YYYY",
				emailNotifications: user.emailNotifications ?? true,
				darkMode: user.darkMode ?? false,
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

	const handleDeleteAllData = async () => {
		const confirmMessage = `⚠️ WARNING: This will permanently delete ALL your data including:

• All expenses and expense items
• All categories you've created
• All tags and their associations
• All recurring expense schedules
• All goals and reminders
• All notifications

Your account and profile will remain, but all financial data will be lost forever.

Type "DELETE ALL DATA" to confirm:`;

		const userInput = window.prompt(confirmMessage);
		if (userInput === "DELETE ALL DATA") {
			try {
				await deleteAllData();
				alert("✅ All your data has been successfully deleted.");
				// Refresh the page to clear any cached data
				window.location.reload();
			} catch (error) {
				console.error("Data deletion failed:", error);
				alert("❌ Failed to delete data. Please try again.");
			}
		} else if (userInput !== null) {
			alert("❌ Incorrect confirmation text. Data deletion cancelled.");
		}
	};

	const handleTestBotMessage = () => {
		console.log("[Profile] ===== STARTING WEBAPP → BOT TEST =====");
		console.log("[Profile] Testing WebApp → Bot communication via Backend");
		console.log("[Profile] Current environment:", {
			userAgent: navigator.userAgent,
			url: window.location.href,
			protocol: window.location.protocol,
			host: window.location.host,
		});

		// Check if we're in Telegram WebApp
		const isWebApp = isTelegramWebApp();
		console.log("[Profile] isTelegramWebApp() result:", isWebApp);

		if (!isWebApp) {
			console.log("[Profile] Not in Telegram WebApp, showing error");
			alert("❌ This feature is only available in Telegram WebApp");
			return;
		}

		// Since sendData() doesn't work with InlineKeyboardButton-launched WebApps,
		// we'll use the Backend → Bot communication we already have working
		console.log("[Profile] Using Backend → Bot communication method");
		console.log("[Profile] This bypasses the sendData() limitation");

		if (!user?.telegramId) {
			console.log("[Profile] ❌ No Telegram ID found for user");
			alert("❌ No Telegram ID found for user");
			return;
		}

		console.log("[Profile] Sending test message via backend API...");

		// Use the same testMessageMutation we already have
		testMessageMutation.mutate({
			chat_id: user.telegramId,
			message:
				"🧪 Test message from WebApp via Backend!\n\n✅ WebApp → Backend → Bot → User communication test\n\nThis bypasses the sendData() limitation!",
		});

		console.log("[Profile] ===== WEBAPP → BOT TEST COMPLETE =====");
	};

	const handleTestBackendToBot = () => {
		console.log("[Profile] ===== TESTING BACKEND TO BOT MESSAGE =====");

		if (!user?.telegramId) {
			alert("❌ No Telegram ID found for user");
			return;
		}

		console.log("[Profile] Sending test message via backend API...");

		testMessageMutation.mutate({
			chat_id: user.telegramId,
			message:
				"🧪 Test message from Profile page via Backend!\n\n✅ Backend → Bot → User communication test",
		});

		console.log("[Profile] ===== BACKEND TO BOT TEST COMPLETE =====");
	};

	const handleInputChange = (
		field: keyof ProfileUpdateRequest,
		value: string,
	) => {
		// Convert string values to appropriate types
		let processedValue: string | boolean = value;
		if (field === "emailNotifications" || field === "darkMode") {
			processedValue = value === "true";
		}

		setFormData((prev) => ({ ...prev, [field]: processedValue }));
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

		if (!formData.dateFormat) {
			errors.dateFormat = "Date format is required";
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
				dateFormat: user.dateFormat || "MM/DD/YYYY",
				emailNotifications: user.emailNotifications ?? true,
				darkMode: user.darkMode ?? false,
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
							{isEditing ? (
								<select
									className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
									id="country"
									value={formData.country}
									onChange={(e) => handleInputChange("country", e.target.value)}
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
							) : (
								<div className="w-full p-0 text-[#1e3a8a] cursor-default">
									{getCountryName(formData.country)}
								</div>
							)}
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
							{isEditing ? (
								<select
									className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
									id="currency"
									value={formData.currency}
									onChange={(e) =>
										handleInputChange("currency", e.target.value)
									}
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
							) : (
								<div className="w-full p-0 text-[#1e3a8a] cursor-default">
									{getCurrencyName(formData.currency)}
								</div>
							)}
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
							{isEditing ? (
								<select
									className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
									id="language"
									value={formData.language}
									onChange={(e) =>
										handleInputChange("language", e.target.value)
									}
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
							) : (
								<div className="w-full p-0 text-[#1e3a8a] cursor-default">
									{getLanguageName(formData.language)}
								</div>
							)}
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
							{isEditing ? (
								<select
									className="w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
									id="timezone"
									value={formData.timezone}
									onChange={(e) =>
										handleInputChange("timezone", e.target.value)
									}
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
							) : (
								<div className="w-full p-0 text-[#1e3a8a] cursor-default">
									{getTimezoneName(formData.timezone)}
								</div>
							)}
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
					{/* Email Notifications Toggle */}
					<div className="flex items-center justify-between p-4 border-b border-gray-200">
						<p className="text-[#1e3a8a] font-medium">Email Notifications</p>
						<label
							className={`relative flex h-8 w-14 items-center rounded-full bg-[#e0f2f7] p-1 has-[:checked]:bg-[#47c1ea] has-[:checked]:justify-end transition-colors ${
								!isEditing ? "opacity-50 pointer-events-none" : "cursor-pointer"
							}`}
						>
							<div className="h-6 w-6 rounded-full bg-white shadow-md transition-transform" />
							<input
								checked={formData.emailNotifications}
								onChange={(e) =>
									handleInputChange(
										"emailNotifications",
										e.target.checked.toString(),
									)
								}
								className="invisible absolute"
								type="checkbox"
								disabled={!isEditing}
							/>
						</label>
					</div>

					{/* Dark Mode Toggle */}
					<div className="flex items-center justify-between p-4 border-b border-gray-200">
						<p className="text-[#1e3a8a] font-medium">Dark Mode</p>
						<label
							className={`relative flex h-8 w-14 items-center rounded-full bg-[#e0f2f7] p-1 has-[:checked]:bg-[#47c1ea] has-[:checked]:justify-end transition-colors ${
								!isEditing ? "opacity-50 pointer-events-none" : "cursor-pointer"
							}`}
						>
							<div className="h-6 w-6 rounded-full bg-white shadow-md transition-transform" />
							<input
								checked={formData.darkMode}
								onChange={(e) =>
									handleInputChange("darkMode", e.target.checked.toString())
								}
								className="invisible absolute"
								type="checkbox"
								disabled={!isEditing}
							/>
						</label>
					</div>

					{/* Date Format Field */}
					<div className="p-4 border-b border-gray-200">
						<label
							className="text-sm font-medium text-[#64748b]"
							htmlFor="date-format"
						>
							Date Format
						</label>
						<div className="mt-1">
							<select
								className={`w-full border-0 p-0 text-[#1e3a8a] focus:ring-0 bg-transparent appearance-none ${
									isEditing
										? "bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724px%27 height=%2724px%27 fill=%27rgb(30,58,138)%27 viewBox=%270 0 256 256%27%3e%3cpath d=%27M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z%27%3e%3c/path%3e%3c/svg%3e')] bg-right bg-no-repeat pr-10"
										: "cursor-default"
								} ${!isEditing ? "pointer-events-none" : ""}`}
								id="date-format"
								value={formData.dateFormat}
								onChange={(e) =>
									handleInputChange("dateFormat", e.target.value)
								}
								disabled={!isEditing}
							>
								<option value="">Select Date Format</option>
								<option value="MM/DD/YYYY">MM/DD/YYYY</option>
								<option value="DD/MM/YYYY">DD/MM/YYYY</option>
								<option value="YYYY-MM-DD">YYYY-MM-DD</option>
							</select>
							{formErrors.dateFormat && (
								<p className="text-red-500 text-xs mt-1">
									{formErrors.dateFormat}
								</p>
							)}
						</div>
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

			{/* Bot Communication Test Section */}
			{isTelegramWebApp() && (
				<section className="space-y-4">
					<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
						Bot Communication Test
					</h2>
					<div className="mx-4 space-y-4">
						<div className="bg-white rounded-xl shadow-sm p-4">
							<div className="space-y-3">
								<div>
									<h3 className="font-medium text-[#1e3a8a] mb-1">
										Test Bot Message
									</h3>
									<p className="text-sm text-[#64748b]">
										Test different ways to send messages to the bot and verify
										communication is working.
									</p>
								</div>
								<div className="bg-[#ecfdf5] border border-[#10b981] rounded-lg p-3">
									<p className="text-sm text-[#065f46]">
										<strong>ℹ️ This will:</strong>
									</p>
									<ul className="text-xs text-[#065f46] mt-1 space-y-1">
										<li>
											• <strong>WebApp → Bot:</strong> Direct communication from
											Telegram WebApp
										</li>
										<li>
											• <strong>Backend → Bot:</strong> Server-initiated
											messages to users
										</li>
										<li>• Show debug information in console</li>
										<li>• Display confirmation if successful</li>
									</ul>
								</div>
								<div className="space-y-2">
									<button
										type="button"
										onClick={handleTestBotMessage}
										className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-medium py-3 px-4 rounded-xl transition-colors"
									>
										🧪 Test WebApp → Bot (via Backend)
									</button>
									<button
										type="button"
										onClick={handleTestBackendToBot}
										disabled={testMessageMutation.isPending}
										className="w-full bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors"
									>
										{testMessageMutation.isPending
											? "⏳ Sending..."
											: "🔗 Test Backend → Bot"}
									</button>
								</div>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Data Management Section */}
			<section className="space-y-4">
				<h2 className="text-[#1e3a8a] text-lg font-semibold leading-tight px-4 pb-2">
					Data Management
				</h2>
				<div className="mx-4 space-y-4">
					<div className="bg-white rounded-xl shadow-sm p-4">
						<div className="space-y-3">
							<div>
								<h3 className="font-medium text-[#1e3a8a] mb-1">
									Clean Up All Data
								</h3>
								<p className="text-sm text-[#64748b]">
									Permanently delete all your financial data while keeping your
									account.
								</p>
							</div>
							<div className="bg-[#fef3c7] border border-[#f59e0b] rounded-lg p-3">
								<p className="text-sm text-[#92400e]">
									<strong>⚠️ This will delete:</strong>
								</p>
								<ul className="text-xs text-[#92400e] mt-1 space-y-1">
									<li>• All expenses and expense items</li>
									<li>• All categories you've created</li>
									<li>• All tags and their associations</li>
									<li>• All recurring expense schedules</li>
									<li>• All goals and reminders</li>
									<li>• All notifications</li>
								</ul>
							</div>
							<button
								type="button"
								onClick={handleDeleteAllData}
								disabled={isLoading}
								className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#92400e] font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isLoading ? "Deleting..." : "🗑️ Delete All My Data"}
							</button>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
};
