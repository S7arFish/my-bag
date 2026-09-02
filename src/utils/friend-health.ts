export type FriendHealthEntry = {
	reachable: boolean;
	statusCode: number | null;
	latencyMs: number;
	backlink: boolean;
	checkedAt: string;
};

export type FriendHealthPresentation = {
	kind: "online" | "slow" | "offline" | "missing-backlink" | "unknown";
	label: string;
};

const MAX_STATUS_AGE_MS = 48 * 60 * 60 * 1000;
const SLOW_THRESHOLD_MS = 1_500;

function normalizeKey(value: string): string {
	try {
		const url = new URL(value);
		url.hash = "";
		url.search = "";
		const pathname =
			url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
		return `${url.origin}${pathname}`;
	} catch {
		return value;
	}
}

export class FriendHealthLookup {
	constructor(
		private readonly entries = new Map<string, FriendHealthEntry>(),
	) {}

	get(siteUrl: string): FriendHealthEntry | undefined {
		return this.entries.get(normalizeKey(siteUrl));
	}

	get size(): number {
		return this.entries.size;
	}
}

function parseEntry(value: unknown): FriendHealthEntry | null {
	if (!value || typeof value !== "object") return null;
	const entry = value as Record<string, unknown>;
	if (
		typeof entry.reachable !== "boolean" ||
		typeof entry.backlink !== "boolean" ||
		typeof entry.latencyMs !== "number" ||
		!Number.isFinite(entry.latencyMs) ||
		entry.latencyMs < 0 ||
		(entry.statusCode !== null && !Number.isInteger(entry.statusCode)) ||
		typeof entry.checkedAt !== "string" ||
		!Number.isFinite(Date.parse(entry.checkedAt))
	) {
		return null;
	}
	return {
		reachable: entry.reachable,
		statusCode: entry.statusCode as number | null,
		latencyMs: Math.round(entry.latencyMs),
		backlink: entry.backlink,
		checkedAt: entry.checkedAt,
	};
}

export function parseFriendHealthDocument(
	value: unknown,
	now = new Date(),
): FriendHealthLookup {
	if (!value || typeof value !== "object") return new FriendHealthLookup();
	const document = value as Record<string, unknown>;
	if (typeof document.generatedAt !== "string") return new FriendHealthLookup();
	const generatedAt = Date.parse(document.generatedAt);
	if (
		!Number.isFinite(generatedAt) ||
		now.getTime() - generatedAt > MAX_STATUS_AGE_MS
	) {
		return new FriendHealthLookup();
	}
	if (!document.friends || typeof document.friends !== "object") {
		return new FriendHealthLookup();
	}

	const entries = new Map<string, FriendHealthEntry>();
	for (const [siteUrl, rawEntry] of Object.entries(document.friends)) {
		const entry = parseEntry(rawEntry);
		if (entry) entries.set(normalizeKey(siteUrl), entry);
	}
	return new FriendHealthLookup(entries);
}

export function describeFriendHealth(
	health: FriendHealthEntry | undefined,
): FriendHealthPresentation {
	if (!health) return { kind: "unknown", label: "状态未知" };
	if (!health.reachable) return { kind: "offline", label: "不可达" };
	if (!health.backlink) {
		return { kind: "missing-backlink", label: "缺少反链" };
	}
	if (health.latencyMs >= SLOW_THRESHOLD_MS) {
		return { kind: "slow", label: "较慢" };
	}
	return { kind: "online", label: "在线" };
}
