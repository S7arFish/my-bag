export interface SiteVisitStats {
	visitors: number;
	pageviews: number;
}

export function normalizeSiteVisitStats(value: unknown): SiteVisitStats | null {
	if (!value || typeof value !== "object") return null;
	const stats = value as Record<string, unknown>;
	if (
		typeof stats.visitors !== "number" ||
		typeof stats.pageviews !== "number" ||
		!Number.isFinite(stats.visitors) ||
		!Number.isFinite(stats.pageviews) ||
		stats.visitors < 0 ||
		stats.pageviews < 0
	) {
		return null;
	}
	return {
		visitors: Math.floor(stats.visitors),
		pageviews: Math.floor(stats.pageviews),
	};
}
