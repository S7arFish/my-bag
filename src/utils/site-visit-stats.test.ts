import { describe, expect, it } from "vitest";
import { normalizeSiteVisitStats } from "./site-visit-stats";

describe("normalizeSiteVisitStats", () => {
	it("accepts non-negative visitor and pageview counts", () => {
		expect(normalizeSiteVisitStats({ visitors: 3, pageviews: 7 })).toEqual({
			visitors: 3,
			pageviews: 7,
		});
	});

	it("rejects malformed stats responses", () => {
		expect(normalizeSiteVisitStats({ visitors: -1, pageviews: 7 })).toBeNull();
		expect(normalizeSiteVisitStats({ visitors: "3", pageviews: 7 })).toBeNull();
	});
});
