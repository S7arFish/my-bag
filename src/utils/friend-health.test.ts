import { describe, expect, it } from "vitest";
import {
	describeFriendHealth,
	parseFriendHealthDocument,
} from "./friend-health";

describe("friend health UI boundary", () => {
	it("maps normalized URLs to online, slow, backlink and offline states", () => {
		const health = parseFriendHealthDocument(
			{
				generatedAt: "2026-09-02T08:00:00.000Z",
				friends: {
					"https://one.example": {
						reachable: true,
						statusCode: 200,
						latencyMs: 120,
						backlink: true,
						checkedAt: "2026-09-02T08:00:00.000Z",
					},
					"https://slow.example": {
						reachable: true,
						statusCode: 200,
						latencyMs: 2200,
						backlink: true,
						checkedAt: "2026-09-02T08:00:00.000Z",
					},
				},
			},
			new Date("2026-09-02T09:00:00.000Z"),
		);

		expect(describeFriendHealth(health.get("https://one.example"))).toEqual({
			kind: "online",
			label: "在线",
		});
		expect(describeFriendHealth(health.get("https://slow.example/"))).toEqual({
			kind: "slow",
			label: "较慢",
		});
	});

	it("degrades stale, missing and malformed status to unknown", () => {
		const stale = parseFriendHealthDocument(
			{ generatedAt: "2026-08-20T00:00:00.000Z", friends: {} },
			new Date("2026-09-02T00:00:00.000Z"),
		);
		expect(stale.size).toBe(0);
		expect(describeFriendHealth(undefined)).toEqual({
			kind: "unknown",
			label: "状态未知",
		});
		expect(
			parseFriendHealthDocument({ generatedAt: null, friends: [] }).size,
		).toBe(0);
	});
});
