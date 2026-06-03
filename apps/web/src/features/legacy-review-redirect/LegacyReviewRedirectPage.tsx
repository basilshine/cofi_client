import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "../../shared/lib/apiClient";

/**
 * Compatibility URL `/console/chat/thread?spaceId=&expenseId=` now lands on capture Review.
 */
export const LegacyReviewRedirectPage = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	useEffect(() => {
		let cancelled = false;
		const params = new URLSearchParams(
			location.search ||
				(typeof window !== "undefined" ? window.location.search : "") ||
				searchParams.toString(),
		);
		const spaceId = params.get("spaceId");
		const expenseId = params.get("expenseId");
		if (!expenseId) {
			navigate(
				spaceId
					? `/console/review?spaceId=${encodeURIComponent(spaceId)}`
					: "/console/review",
				{ replace: true },
			);
			return;
		}
		if (!spaceId) {
			navigate(`/console/review?expenseId=${encodeURIComponent(expenseId)}`, {
				replace: true,
			});
			return;
		}

		const fallbackHref = `/console/review?spaceId=${encodeURIComponent(spaceId)}&expenseId=${encodeURIComponent(expenseId)}`;

		const run = async () => {
			try {
				const expense = await apiClient.spaces.expenses.get(spaceId, expenseId);
				const sourceDocumentId = expense.source_document_id;
				if (cancelled) return;
				if (sourceDocumentId != null) {
					navigate(
						`/console/review?spaceId=${encodeURIComponent(spaceId)}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`,
						{ replace: true },
					);
					return;
				}
			} catch {
				// Keep compatibility links useful even when older expense rows have no capture provenance.
			}
			if (!cancelled) {
				navigate(fallbackHref, { replace: true });
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [location.search, navigate, searchParams]);

	return (
		<p aria-live="polite" className="p-4 text-sm text-muted-foreground">
			Opening capture review...
		</p>
	);
};
