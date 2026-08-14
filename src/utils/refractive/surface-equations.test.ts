import { describe, expect, it } from "vitest";
import {
	convexSquircle,
	precomputeRadialDisplacement,
} from "./surface-equations";

describe("refractive surface equations", () => {
	it("keeps the convex squircle finite, monotonic, and normalized", () => {
		expect(convexSquircle(0)).toBe(0);
		expect(convexSquircle(1)).toBe(1);

		const samples = Array.from({ length: 101 }, (_, index) =>
			convexSquircle(index / 100),
		);
		expect(samples.every(Number.isFinite)).toBe(true);
		expect(
			samples.every(
				(value, index) => index === 0 || value >= samples[index - 1]!,
			),
		).toBe(true);
	});

	it("produces finite glass displacement with a nonzero maximum", () => {
		const result = precomputeRadialDisplacement({
			glassThickness: 70,
			bezelWidth: 18,
			refractiveIndex: 1.5,
			samples: 128,
			bezelHeightFn: convexSquircle,
		});

		expect(result.values).toHaveLength(128);
		expect([...result.values].every(Number.isFinite)).toBe(true);
		expect(result.maximum).toBeGreaterThan(0);
	});
});
