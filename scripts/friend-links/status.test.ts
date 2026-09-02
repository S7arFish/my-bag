import { describe, expect, it } from "vitest";
import { createStatusDocument } from "./status.mjs";

const friend = {
	title: "Example",
	siteurl: "https://example.com/",
	friendPageUrl: "https://example.com/friends/",
	enabled: true,
};

describe("daily friend health status output", () => {
	it("writes stable status entries keyed by normalized site URL", () => {
		const result = createStatusDocument({
			friends: [friend],
			checks: [
				{
					reachable: true,
					statusCode: 200,
					latencyMs: 320,
					backlink: true,
				},
			],
			previous: null,
			now: "2026-09-02T00:00:00.000Z",
		});

		expect(result.document.friends["https://example.com"]).toMatchObject({
			reachable: true,
			statusCode: 200,
			latencyMs: 320,
			backlink: true,
			checkedAt: "2026-09-02T00:00:00.000Z",
			consecutiveFailures: 0,
		});
		expect(result.events).toEqual([]);
	});

	it("alerts only on the third consecutive failure and reports recovery", () => {
		const failedCheck = {
			reachable: false,
			statusCode: null,
			latencyMs: 12_000,
			backlink: false,
		};
		const previous = {
			generatedAt: "2026-09-01T00:00:00.000Z",
			friends: {
				"https://example.com": {
					...failedCheck,
					checkedAt: "2026-09-01T00:00:00.000Z",
					consecutiveFailures: 2,
				},
			},
		};
		const third = createStatusDocument({
			friends: [friend],
			checks: [failedCheck],
			previous,
			now: "2026-09-02T00:00:00.000Z",
		});
		expect(third.events).toEqual([
			{ type: "alert", title: "Example", siteUrl: "https://example.com/" },
		]);

		const recovered = createStatusDocument({
			friends: [friend],
			checks: [
				{ reachable: true, statusCode: 200, latencyMs: 100, backlink: true },
			],
			previous: third.document,
			now: "2026-09-03T00:00:00.000Z",
		});
		expect(recovered.events).toEqual([
			{ type: "recovered", title: "Example", siteUrl: "https://example.com/" },
		]);
	});
});
