import { describe, expect, it } from "vitest";
import {
	computeNavbarTensionLayerAnchor,
	computeNavbarTensionTarget,
	computeNavbarTensionVisualStrength,
} from "./navbar-magnetic-tension";

const rect = { left: 100, top: 100, width: 800, height: 80 };
const base = {
	rect,
	radius: 40,
	activationDistance: 140,
	maxExtension: 12,
	enabled: true,
};

describe("computeNavbarTensionTarget", () => {
	it("pulls the top edge toward a nearby pointer", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: 500,
			pointerY: 60,
		});
		expect(target.active).toBe(true);
		expect(target.normalX).toBeCloseTo(0, 3);
		expect(target.normalY).toBeCloseTo(-1, 3);
		expect(target.hotspotX).toBeCloseTo(0.5, 3);
		expect(target.hotspotY).toBeCloseTo(0, 3);
		expect(target.perimeterT).toBeGreaterThanOrEqual(0);
		expect(target.perimeterT).toBeLessThan(1);
		expect(target.strength).toBeGreaterThan(0.65);
		expect(target.extensionY).toBeLessThan(0);
	});

	it("moves continuously from the top edge around the right cap", () => {
		const pointers = [
			{ pointerX: 820, pointerY: 60 },
			{ pointerX: 865, pointerY: 75 },
			{ pointerX: 925, pointerY: 115 },
			{ pointerX: 940, pointerY: 150 },
		];
		const positions = pointers.map(
			(pointer) =>
				computeNavbarTensionTarget({ ...base, ...pointer }).perimeterT,
		);
		for (let index = 1; index < positions.length; index += 1) {
			const direct = Math.abs(positions[index] - positions[index - 1]);
			const cyclic = Math.min(direct, 1 - direct);
			expect(cyclic).toBeLessThan(0.08);
		}
	});

	it("follows the rounded left cap normal", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: 70,
			pointerY: 115,
		});
		expect(target.active).toBe(true);
		expect(target.normalX).toBeLessThan(-0.7);
		expect(target.normalY).toBeLessThan(0);
		expect(target.hotspotX).toBeLessThan(0.04);
	});

	it("uses the nearest edge while the pointer is inside", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: 500,
			pointerY: 170,
		});
		expect(target.active).toBe(true);
		expect(target.strength).toBe(1);
		expect(target.normalY).toBe(1);
		expect(target.hotspotY).toBe(1);
	});

	it("deactivates beyond the 140px range", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: 500,
			pointerY: -60,
		});
		expect(target.active).toBe(false);
		expect(target.strength).toBe(0);
	});

	it("returns finite clamped values for invalid geometry", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: Number.NaN,
			pointerY: Number.POSITIVE_INFINITY,
			rect: { left: 0, top: 0, width: 0, height: 0 },
		});
		for (const value of Object.values(target)) {
			if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
		}
		expect(target.active).toBe(false);
		expect(target.strength).toBe(0);
	});

	it("deactivates when desktop pointer interaction is disabled", () => {
		const target = computeNavbarTensionTarget({
			...base,
			pointerX: 500,
			pointerY: 60,
			enabled: false,
		});
		expect(target.active).toBe(false);
		expect(target.strength).toBe(0);
	});
});

describe("computeNavbarTensionLayerAnchor", () => {
	it("keeps a bottom-edge layer inside the shell before the 12px extension", () => {
		const anchor = computeNavbarTensionLayerAnchor({
			hotspotX: 0.35,
			hotspotY: 1,
			normalX: 0,
			normalY: 1,
			shellWidth: 1568,
			shellHeight: 76,
			layerWidth: 220,
			layerHeight: 100,
		});
		expect(anchor.left).toBeCloseTo(0.35, 4);
		expect(anchor.top).toBeCloseTo(26 / 76, 4);
	});

	it("moves a left-cap layer inward by half its width", () => {
		const anchor = computeNavbarTensionLayerAnchor({
			hotspotX: 0,
			hotspotY: 0.5,
			normalX: -1,
			normalY: 0,
			shellWidth: 1568,
			shellHeight: 76,
			layerWidth: 220,
			layerHeight: 100,
		});
		expect(anchor.left).toBeCloseTo(110 / 1568, 4);
		expect(anchor.top).toBeCloseTo(0.5, 4);
	});
});

describe("computeNavbarTensionVisualStrength", () => {
	it("turns the release undershoot into a smaller visible rebound", () => {
		expect(computeNavbarTensionVisualStrength(-0.12, 0)).toBeCloseTo(0.12);
	});

	it("clamps attraction overshoot to a stable visible maximum", () => {
		expect(computeNavbarTensionVisualStrength(1.08, 1)).toBe(1);
	});
});
