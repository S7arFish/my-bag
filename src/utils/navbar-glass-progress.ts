const DEFAULT_START = 32;
const DEFAULT_END = 120;

export function computeNavbarGlassProgress(
	scrollY: number,
	start = DEFAULT_START,
	end = DEFAULT_END,
): number {
	if (!Number.isFinite(scrollY) || end <= start) return 0;
	return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
}
