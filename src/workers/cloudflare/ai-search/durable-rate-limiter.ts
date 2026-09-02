import { DurableObject } from "cloudflare:workers";
import { aiSearchConfig } from "@/config/aiSearchConfig";
import type {
	RateLimiter as RateLimiterContract,
	RateLimitResult,
} from "@/server/ai-search/contracts";

interface RateLimitRow {
	[key: string]: SqlStorageValue;
	count: number;
	reset_at: number;
}

export class RateLimiter extends DurableObject<Record<string, never>> {
	constructor(ctx: DurableObjectState, env: Record<string, never>) {
		super(ctx, env);
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS rate_limit (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				count INTEGER NOT NULL,
				reset_at INTEGER NOT NULL
			)
		`);
	}

	check(max: number, windowSeconds: number, now = Date.now()): RateLimitResult {
		if (
			!Number.isInteger(max) ||
			max < 1 ||
			!Number.isInteger(windowSeconds) ||
			windowSeconds < 1
		) {
			throw new Error("Invalid rate limit configuration");
		}

		const row = this.ctx.storage.sql
			.exec<RateLimitRow>("SELECT count, reset_at FROM rate_limit WHERE id = 1")
			.toArray()[0];
		const nextReset = now + windowSeconds * 1000;

		if (!row || row.reset_at <= now) {
			this.ctx.storage.sql.exec(
				`INSERT INTO rate_limit (id, count, reset_at) VALUES (1, 1, ?)
				 ON CONFLICT(id) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
				nextReset,
			);
			return { allowed: true, remaining: max - 1, retryAfter: 0 };
		}

		const retryAfter = Math.max(1, Math.ceil((row.reset_at - now) / 1000));
		if (row.count >= max) {
			return { allowed: false, remaining: 0, retryAfter };
		}

		const nextCount = row.count + 1;
		this.ctx.storage.sql.exec(
			"UPDATE rate_limit SET count = ? WHERE id = 1",
			nextCount,
		);
		return {
			allowed: true,
			remaining: Math.max(0, max - nextCount),
			retryAfter: 0,
		};
	}
}

function getClientIp(request: Request): string {
	return request.headers.get("CF-Connecting-IP") || "development";
}

async function hashRateLimitKey(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	const bytes = new Uint8Array(digest);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export class DurableRateLimiter implements RateLimiterContract {
	constructor(
		private readonly namespace: DurableObjectNamespace<RateLimiter>,
	) {}

	async check(request: Request): Promise<RateLimitResult> {
		const key = await hashRateLimitKey(`ai-chat:${getClientIp(request)}`);
		return this.namespace
			.getByName(key)
			.check(
				aiSearchConfig.rateLimit.maxRequests,
				aiSearchConfig.rateLimit.windowSeconds,
			);
	}
}
