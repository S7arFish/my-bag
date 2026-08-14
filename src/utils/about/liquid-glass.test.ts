import { describe, expect, it } from "vitest";
import { computeLiquidGlassOrbStyle } from "./liquid-glass";

describe("computeLiquidGlassOrbStyle", () => {
	it("converts device pixels and follows released velocity with bounded deformation", () => {
		const style = computeLiquidGlassOrbStyle(
			{ x: 400, y: 300, radius: 100, vx: 16, vy: -8 },
			{ isDragging: false, velX: 999, velY: 999 },
			2,
		);

		expect(style.x).toBe(200);
		expect(style.y).toBe(150);
		expect(style.radius).toBe(50);
		expect(style.highlightX).toBe(58);
		expect(style.highlightY).toBe(30);
		expect(style.scaleX).toBeGreaterThan(1);
		expect(style.scaleX).toBeLessThanOrEqual(1.06);
		expect(style.scaleY).toBeGreaterThanOrEqual(0.97);
		expect(style.intensity).toBeLessThanOrEqual(1.18);
	});

	it("uses drag velocity and clamps highlight, rotation, and strength", () => {
		const style = computeLiquidGlassOrbStyle(
			{ x: 200, y: 100, radius: 40, vx: 0, vy: 0 },
			{ isDragging: true, velX: 4, velY: -4 },
			1,
		);

		expect(style.highlightX).toBe(58);
		expect(style.highlightY).toBe(30);
		expect(style.rotation).toBe(-12);
		expect(style.intensity).toBe(1.18);
	});

	it("returns an undeformed lens when the portrait is still", () => {
		const style = computeLiquidGlassOrbStyle(
			{ x: 200, y: 100, radius: 40, vx: 0, vy: 0 },
			{ isDragging: false, velX: 8, velY: 8 },
			1,
		);

		expect(style.scaleX).toBe(1);
		expect(style.scaleY).toBe(1);
		expect(style.rotation).toBe(0);
		expect(style.intensity).toBe(1);
	});
});
