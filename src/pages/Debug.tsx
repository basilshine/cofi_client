import { Button } from "@components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { expensesService } from "@services/api/expenses";
import { useAuthStore } from "@store/useStore";
import LogRocket from "logrocket";
import { useState } from "react";

interface TestResults {
	environment?: {
		VITE_API_URL: string;
		NODE_ENV: string;
		MODE: string;
	};
	auth?: {
		user: unknown;
		token: string | null;
		isAuthenticated: boolean;
	};
	healthCheck?: {
		status?: number;
		ok?: boolean;
		url?: string;
		error?: string;
	};
	expensesAPI?: {
		success: boolean;
		count?: number;
		data?: unknown;
		error?: string;
	};
	summaryAPI?: {
		success: boolean;
		data?: unknown;
		error?: string;
	};
}

export const Debug = () => {
	const [testResults, setTestResults] = useState<TestResults>({});
	const [isLoading, setIsLoading] = useState(false);
	const user = useAuthStore((state) => state.user);
	const token = useAuthStore((state) => state.token);

	const runTests = async () => {
		setIsLoading(true);
		setTestResults({});
		const results: TestResults = {};

		LogRocket.log("[Debug] Starting API tests");

		// Test 1: Environment variables
		results.environment = {
			VITE_API_URL: import.meta.env.VITE_API_URL,
			NODE_ENV: import.meta.env.NODE_ENV,
			MODE: import.meta.env.MODE,
		};

		// Test 2: Authentication state
		results.auth = {
			user: user,
			token: token ? `${token.substring(0, 10)}...` : null,
			isAuthenticated: !!user && !!token,
		};

		// Test 3: API base URL check
		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL}/health`, {
				method: "GET",
			});
			results.healthCheck = {
				status: response.status,
				ok: response.ok,
				url: `${import.meta.env.VITE_API_URL}/health`,
			};
		} catch (error) {
			results.healthCheck = {
				error: error instanceof Error ? error.message : "Unknown error",
				url: `${import.meta.env.VITE_API_URL}/health`,
			};
		}

		// Test 4: Expenses API
		if (user && token) {
			try {
				const expenses = await expensesService.getExpenses();
				results.expensesAPI = {
					success: true,
					count: expenses.length,
					data: expenses.slice(0, 2), // Show first 2 items
				};
			} catch (error) {
				results.expensesAPI = {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}

			// Test 5: Summary API
			try {
				const summary = await expensesService.getSummary();
				results.summaryAPI = {
					success: true,
					data: summary,
				};
			} catch (error) {
				results.summaryAPI = {
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		LogRocket.log("[Debug] Test results:", results);
		setTestResults(results);
		setIsLoading(false);
	};

	return (
		<div className="container mx-auto py-8 max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Debug Information</h1>
				<p className="mt-2 text-muted-foreground">
					API connection and authentication debugging
				</p>
			</div>

			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Run API Tests</CardTitle>
					</CardHeader>
					<CardContent>
						<Button onClick={runTests} disabled={isLoading}>
							{isLoading ? "Running Tests..." : "Test API Connection"}
						</Button>
					</CardContent>
				</Card>

				{Object.keys(testResults).length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Test Results</CardTitle>
						</CardHeader>
						<CardContent>
							<pre className="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-96">
								{JSON.stringify(testResults, null, 2)}
							</pre>
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<CardTitle>Quick Info</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<strong>API URL:</strong>{" "}
							{import.meta.env.VITE_API_URL || "Not set"}
						</div>
						<div>
							<strong>Environment:</strong> {import.meta.env.NODE_ENV}
						</div>
						<div>
							<strong>User Authenticated:</strong> {user ? "Yes" : "No"}
						</div>
						<div>
							<strong>Token Present:</strong> {token ? "Yes" : "No"}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
