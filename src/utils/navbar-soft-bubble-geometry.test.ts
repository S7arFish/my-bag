import { describe, expect, it } from "vitest";
import {
	createNavbarSoftBubblePath,
	createNavbarSoftBubbleSamples,
	pointAtRoundedRectPerimeter,
	projectPointToRoundedRectBoundary,
} from "./navbar-soft-bubble-geometry";

const capsule = { width: 800, height: 80, radius: 40 };

describe("projectPointToRoundedRectBoundary", () => {
	it.each([
		[
			{ pointX: 400, pointY: -40 },
			{ normalX: 0, normalY: -1 },
		],
		[
			{ pointX: 400, pointY: 120 },
			{ normalX: 0, normalY: 1 },
		],
		[
			{ pointX: -30, pointY: 18 },
			{ normalX: -1, normalY: undefined },
		],
		[
			{ pointX: 830, pointY: 62 },
			{ normalX: 1, normalY: undefined },
		],
	])("projects %o onto the continuous capsule boundary", (point, expected) => {
		const result = projectPointToRoundedRectBoundary({ ...point, ...capsule });
		expect(result.perimeterT).toBeGreaterThanOrEqual(0);
		expect(result.perimeterT).toBeLessThan(1);
		if (expected.normalX !== undefined) {
			expect(result.normalX).toBeCloseTo(expected.normalX, 1);
		}
		if (expected.normalY !== undefined) {
			expect(result.normalY).toBeCloseTo(expected.normalY, 1);
		}
		expect(Math.hypot(result.normalX, result.normalY)).toBeCloseTo(1, 4);
	});

	it("returns finite geometry for invalid input", () => {
		const result = projectPointToRoundedRectBoundary({
			pointX: Number.NaN,
			pointY: Number.POSITIVE_INFINITY,
			width: 0,
			height: -1,
			radius: Number.NaN,
		});
		for (const value of Object.values(result)) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});
});

describe("pointAtRoundedRectPerimeter", () => {
	it("is continuous across the cyclic seam", () => {
		const before = pointAtRoundedRectPerimeter({
			...capsule,
			perimeterT: 0.99999,
		});
		const after = pointAtRoundedRectPerimeter({
			...capsule,
			perimeterT: 0.00001,
		});
		expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
			0.2,
		);
		expect(after.normalX).toBeCloseTo(before.normalX, 2);
		expect(after.normalY).toBeCloseTo(before.normalY, 2);
	});
});

describe("createNavbarSoftBubblePath", () => {
	it("moves the center outward by 26px and fades to zero at 160px", () => {
		const base = createNavbarSoftBubbleSamples({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: 0,
			influenceWidth: 320,
			shoulder: 0,
			sampleCount: 192,
		});
		const bulged = createNavbarSoftBubbleSamples({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: 26,
			influenceWidth: 320,
			shoulder: 0,
			sampleCount: 192,
		});
		const centerIndex = Math.round(0.5 * 192) % 192;
		expect(
			Math.hypot(
				bulged[centerIndex].x - base[centerIndex].x,
				bulged[centerIndex].y - base[centerIndex].y,
			),
		).toBeCloseTo(26, 1);
		const perimeter =
			2 * (capsule.width - 2 * capsule.radius) + 2 * Math.PI * capsule.radius;
		const edgeIndex = Math.round((0.5 + 160 / perimeter) * 192) % 192;
		expect(
			Math.hypot(
				bulged[edgeIndex].x - base[edgeIndex].x,
				bulged[edgeIndex].y - base[edgeIndex].y,
			),
		).toBeLessThan(0.15);
	});

	it("keeps negative rebound signed", () => {
		const outward = createNavbarSoftBubbleSamples({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: 8,
			influenceWidth: 320,
			shoulder: 0,
			sampleCount: 192,
		});
		const inward = createNavbarSoftBubbleSamples({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: -8,
			influenceWidth: 320,
			shoulder: 0,
			sampleCount: 192,
		});
		const base = createNavbarSoftBubbleSamples({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: 0,
			influenceWidth: 320,
			shoulder: 0,
			sampleCount: 192,
		});
		const index = 96;
		expect(
			(outward[index].y - base[index].y) * (inward[index].y - base[index].y),
		).toBeLessThan(0);
	});

	it("creates a finite closed cubic path", () => {
		const path = createNavbarSoftBubblePath({
			...capsule,
			inset: 26,
			centerT: 0.5,
			depth: 26,
			influenceWidth: 320,
			shoulder: 0.2,
		});
		expect(path).toMatch(/^M/);
		expect(path).toContain("C");
		expect(path.endsWith("Z")).toBe(true);
		expect(path).not.toMatch(/NaN|Infinity/);
	});
});
