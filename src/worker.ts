const VISITOR_COOKIE = "mini_blog_visitor";
const VISITOR_COOKIE_MAX_AGE = 63_072_000;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATS_QUERY = `
	SELECT
		legacy_visitors + (SELECT COUNT(*) FROM visitors) AS visitors,
		pageviews
	FROM site_counters
	WHERE id = 1
`;

const STATIC_SECURITY_HEADERS = {
	"Content-Security-Policy-Report-Only": [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'self'",
		"form-action 'self' https:",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data: https:",
		"style-src 'self' 'unsafe-inline' https:",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
		"connect-src 'self' https: wss:",
		"media-src 'self' blob: https:",
		"frame-src https:",
		"worker-src 'self' blob:",
	].join("; "),
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "SAMEORIGIN",
} satisfies Record<string, string>;

type BlogStats = {
	visitors: number;
	pageviews: number;
};

export interface BlogWorkerEnv {
	ASSETS: Fetcher;
	BLOG_DB: D1Database;
}

function json(body: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set("Cache-Control", "no-store");
	headers.set("X-Content-Type-Options", "nosniff");
	return Response.json(body, { ...init, headers });
}

function methodNotAllowed(allow: string): Response {
	return json(
		{ error: "Method Not Allowed" },
		{ status: 405, headers: { Allow: allow } },
	);
}

function normalizeStats(value: unknown): BlogStats {
	if (!value || typeof value !== "object") {
		throw new Error("Statistics row is missing");
	}
	const row = value as Record<string, unknown>;
	const visitors = Number(row.visitors);
	const pageviews = Number(row.pageviews);
	if (
		!Number.isSafeInteger(visitors) ||
		!Number.isSafeInteger(pageviews) ||
		visitors < 0 ||
		pageviews < 0
	) {
		throw new Error("Statistics row is invalid");
	}
	return { visitors, pageviews };
}

function getCookie(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get("Cookie");
	if (!cookieHeader) return null;
	for (const segment of cookieHeader.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0) continue;
		if (segment.slice(0, separator).trim() === name) {
			return segment.slice(separator + 1).trim();
		}
	}
	return null;
}

async function readStats(database: D1Database): Promise<BlogStats> {
	const row = await database.prepare(STATS_QUERY).first();
	return normalizeStats(row);
}

async function recordVisit(
	request: Request,
	database: D1Database,
): Promise<Response> {
	const currentVisitor = getCookie(request, VISITOR_COOKIE);
	const visitorId =
		currentVisitor && UUID_PATTERN.test(currentVisitor)
			? currentVisitor
			: crypto.randomUUID();
	const shouldSetCookie = visitorId !== currentVisitor;
	const now = new Date().toISOString();

	const results = await database.batch([
		database
			.prepare(
				"INSERT OR IGNORE INTO visitors (visitor_id, first_seen) VALUES (?, ?)",
			)
			.bind(visitorId, now),
		database.prepare(
			"UPDATE site_counters SET pageviews = pageviews + 1 WHERE id = 1",
		),
		database.prepare(STATS_QUERY),
	]);
	const stats = normalizeStats(results.at(-1)?.results?.[0]);
	const headers = new Headers();
	if (shouldSetCookie) {
		headers.set(
			"Set-Cookie",
			`${VISITOR_COOKIE}=${visitorId}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
		);
	}
	return json(stats, { headers });
}

async function handleApi(
	request: Request,
	env: BlogWorkerEnv,
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	try {
		if (pathname === "/api/stats") {
			if (request.method !== "GET") return methodNotAllowed("GET");
			return json(await readStats(env.BLOG_DB));
		}
		if (pathname === "/api/visit") {
			if (request.method !== "POST") return methodNotAllowed("POST");
			return recordVisit(request, env.BLOG_DB);
		}
		return json({ error: "Not Found" }, { status: 404 });
	} catch (error) {
		console.error("Blog statistics API failed", error);
		return json({ error: "Statistics service unavailable" }, { status: 503 });
	}
}

function withStaticSecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
		headers.set(name, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export default {
	async fetch(request, env): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (pathname.startsWith("/api/")) {
			return handleApi(request, env);
		}
		return withStaticSecurityHeaders(await env.ASSETS.fetch(request));
	},
} satisfies ExportedHandler<BlogWorkerEnv>;
