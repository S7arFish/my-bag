import { describe, expect, it } from "vitest";
import { computeNavbarGlassProgress } from "./navbar-glass-progress";

describe("computeNavbarGlassProgress", () => {
	it("stays hidden through 32px and is complete at 120px", () => {
		expect(computeNavbarGlassProgress(0)).toBe(0);
		expect(computeNavbarGlassProgress(32)).toBe(0);
		expect(computeNavbarGlassProgress(120)).toBe(1);
		expect(computeNavbarGlassProgress(240)).toBe(1);
	});

	it("interpolates continuously and clamps invalid input", () => {
		expect(computeNavbarGlassProgress(76)).toBeCloseTo(0.5);
		expect(computeNavbarGlassProgress(-20)).toBe(0);
		expect(computeNavbarGlassProgress(Number.NaN)).toBe(0);
	});
});
