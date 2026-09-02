/// <reference types="@cloudflare/workers-types" />

declare global {
	interface Env {
		ASSETS: Fetcher;
		BLOG_DB: D1Database;
	}
}

export {};
