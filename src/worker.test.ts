import { describe, expect, it, vi } from "vitest";
import worker from "./worker";

type StatsState = {
	legacyVisitors: number;
	pageviews: number;
	visitors: Set<string>;
};

class FakeStatement {
	private values: unknown[] = [];

	constructor(
		private readonly sql: string,
		private readonly state: StatsState,
	) {}

	bind(...values: unknown[]) {
		this.values = values;
		return this;
	}

	async first<T>() {
		if (!this.sql.includes("legacy_visitors")) return null;
		return {
			visitors: this.state.legacyVisitors + this.state.visitors.size,
			pageviews: this.state.pageviews,
		} as T;
	}

	apply() {
		if (this.sql.includes("INSERT OR IGNORE INTO visitors")) {
			this.state.visitors.add(String(this.values[0]));
			return { success: true, results: [] };
		}
		if (this.sql.includes("SET pageviews = pageviews + 1")) {
			this.state.pageviews += 1;
			return { success: true, results: [] };
		}
		if (this.sql.includes("legacy_visitors")) {
			return {
				success: true,
				results: [
					{
						visitors: this.state.legacyVisitors + this.state.visitors.size,
						pageviews: this.state.pageviews,
					},
				],
			};
		}
		throw new Error(`Unexpected SQL: ${this.sql}`);
	}
}

function createEnv(initial?: Partial<Omit<StatsState, "visitors">>) {
	const state: StatsState = {
		legacyVisitors: initial?.legacyVisitors ?? 7,
		pageviews: initial?.pageviews ?? 46,
		visitors: new Set(),
	};
	const database = {
		prepare(sql: string) {
			return new FakeStatement(sql, state);
		},
		async batch(statements: FakeStatement[]) {
			return statements.map((statement) => statement.apply());
		},
	};
	const assets = {
		fetch: async () => new Response("asset", { status: 200 }),
	};
	return { env: { BLOG_DB: database, ASSETS: assets }, state };
}

async function dispatch(request: Request, env: unknown): Promise<Response> {
	return (worker.fetch as Function)(request, env, {});
}

describe("blog Worker public HTTP API", () => {
	it("returns the migrated visitor and pageview totals", async () => {
		const { env } = createEnv();
		const response = await dispatch(
			new Request("https://lolicon.meme/api/stats"),
			env,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({ visitors: 7, pageviews: 46 });
	});

	it("counts every visit while deduplicating visitors by secure cookie", async () => {
		const { env } = createEnv();
		const first = await dispatch(
			new Request("https://lolicon.meme/api/visit", { method: "POST" }),
			env,
		);
		const cookie = first.headers.get("set-cookie");

		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ visitors: 8, pageviews: 47 });
		expect(cookie).toMatch(
			/^mini_blog_visitor=[0-9a-f-]{36}; Max-Age=63072000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
		);

		const second = await dispatch(
			new Request("https://lolicon.meme/api/visit", {
				method: "POST",
				headers: { Cookie: cookie?.split(";")[0] ?? "" },
			}),
			env,
		);

		expect(second.headers.has("set-cookie")).toBe(false);
		expect(await second.json()).toEqual({ visitors: 8, pageviews: 48 });
	});

	it("rejects unsupported API methods and falls back to static assets", async () => {
		const { env } = createEnv();
		const methodResponse = await dispatch(
			new Request("https://lolicon.meme/api/visit", { method: "GET" }),
			env,
		);
		const assetResponse = await dispatch(
			new Request("https://lolicon.meme/about/"),
			env,
		);

		expect(methodResponse.status).toBe(405);
		expect(methodResponse.headers.get("allow")).toBe("POST");
		expect(await assetResponse.text()).toBe("asset");
	});

	it("keeps database failures private while leaving assets available", async () => {
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const { env } = createEnv();
		const brokenEnv = {
			...env,
			BLOG_DB: {
				prepare() {
					throw new Error("secret database detail");
				},
			},
		};
		const apiResponse = await dispatch(
			new Request("https://lolicon.meme/api/stats"),
			brokenEnv,
		);
		const assetResponse = await dispatch(
			new Request("https://lolicon.meme/about/"),
			brokenEnv,
		);

		expect(apiResponse.status).toBe(503);
		expect(await apiResponse.text()).toBe(
			'{"error":"Statistics service unavailable"}',
		);
		expect(await assetResponse.text()).toBe("asset");
		errorLog.mockRestore();
	});
});
