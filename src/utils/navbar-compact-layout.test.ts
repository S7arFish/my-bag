import { describe, expect, it } from "vitest";
import {
	computeNavbarCompactAnchors,
	computeNavbarCompactShellWidth,
	interpolateNavbarShellWidth,
} from "./navbar-compact-layout";

describe("computeNavbarCompactAnchors", () => {
	it("keeps compact controls inset from both ends of a wide shell", () => {
		expect(computeNavbarCompactAnchors(1600, 36, 40)).toEqual({
		left: 76,
		right: 1524,
	});
	});

	it("clamps the inset so controls do not cross on narrow shells", () => {
		expect(computeNavbarCompactAnchors(120, 36, 80)).toEqual({
			left: 60,
			right: 60,
		});
	});

	it("targets 82 percent of the viewport on a wide desktop", () => {
		expect(computeNavbarCompactShellWidth(1840, 1920, 980)).toBeCloseTo(
			1574.4,
		);
	});

	it("keeps enough room for the center menu on a narrow desktop", () => {
		expect(computeNavbarCompactShellWidth(1000, 1100, 940)).toBe(940);
	});

	it("never expands beyond the available shell", () => {
		expect(computeNavbarCompactShellWidth(800, 1920, 700)).toBe(800);
	});

	it("bounds the elastic width overshoot around the two shell states", () => {
		expect(interpolateNavbarShellWidth(1840, 1574.4, 0)).toBe(1840);
		expect(interpolateNavbarShellWidth(1840, 1574.4, 1)).toBe(1574.4);
		expect(interpolateNavbarShellWidth(1840, 1574.4, 2)).toBeCloseTo(
			1547.84,
		);
		expect(interpolateNavbarShellWidth(1840, 1574.4, -1)).toBeCloseTo(
			1861.248,
		);
	});
});
