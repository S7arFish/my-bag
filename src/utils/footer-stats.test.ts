import { describe, expect, it } from "vitest";
import { calculateDaysSinceUpdate, calculateRunningDays } from "./footer-stats";

describe("footer stats", () => {
	const now = new Date("2026-08-30T12:00:00+08:00");

	it("starts the site runtime at day one", () => {
		expect(calculateRunningDays("2026-08-30", now, "Asia/Shanghai")).toBe(1);
	});

	it("shows an update from the previous calendar day as one day ago", () => {
		expect(calculateDaysSinceUpdate("2026-08-29", now, "Asia/Shanghai")).toBe(
			1,
		);
	});
});
