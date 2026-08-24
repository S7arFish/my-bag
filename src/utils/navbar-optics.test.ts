import { describe, expect, it } from "vitest";
import {
	NAVBAR_BASE_OPTICS,
	NAVBAR_CAP_OPTICS,
	NAVBAR_FLUID_OPTICS,
	NAVBAR_TENSION_ACTIVATION_DISTANCE,
	computeChromaticDisplacementScales,
} from "./navbar-optics";

describe("navbar optical configuration", () => {
	it("uses the confirmed 100px magnetic activation range", () => {
		expect(NAVBAR_TENSION_ACTIVATION_DISTANCE).toBe(100);
	});

	it("makes deformation stronger than the base and caps strongest", () => {
		expect(NAVBAR_FLUID_OPTICS.glassThickness).toBeGreaterThan(
			NAVBAR_BASE_OPTICS.glassThickness,
		);
		expect(NAVBAR_FLUID_OPTICS.refractiveIndex).toBeGreaterThan(
			NAVBAR_BASE_OPTICS.refractiveIndex,
		);
		expect(NAVBAR_CAP_OPTICS.glassThickness).toBeGreaterThan(
			NAVBAR_FLUID_OPTICS.glassThickness,
		);
		expect(NAVBAR_CAP_OPTICS.refractiveIndex).toBeGreaterThan(
			NAVBAR_FLUID_OPTICS.refractiveIndex,
		);
	});
});

describe("computeChromaticDisplacementScales", () => {
	it("keeps all channels aligned when dispersion is disabled", () => {
		expect(computeChromaticDisplacementScales(20, 1.5, 0)).toEqual({
			red: 30,
			green: 30,
			blue: 30,
		});
	});

	it("splits red and blue symmetrically around the green channel", () => {
		expect(computeChromaticDisplacementScales(20, 1.5, 0.1)).toEqual({
			red: 33,
			green: 30,
			blue: 27,
		});
	});

	it("clamps invalid and excessive inputs to finite nonnegative values", () => {
		const scales = computeChromaticDisplacementScales(
			Number.NaN,
			Number.POSITIVE_INFINITY,
			3,
		);
		expect(scales).toEqual({ red: 0, green: 0, blue: 0 });
	});
});
