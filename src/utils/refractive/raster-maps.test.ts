import { describe, expect, it } from "vitest";
import { buildDisplacementRaster, buildSpecularRaster } from "./raster-maps";
import { precomputeRadialDisplacement } from "./surface-equations";

describe("refractive raster maps", () => {
	it("keeps the center neutral and bends opposite edges symmetrically", () => {
		const radial = precomputeRadialDisplacement({
			glassThickness: 70,
			bezelWidth: 18,
			refractiveIndex: 1.5,
		});
		const map = buildDisplacementRaster({
			radius: 38,
			bezelWidth: 18,
			pixelRatio: 1,
			radial,
		});

		const centerX = Math.floor(map.width / 2);
		const centerY = Math.floor(map.height / 2);
		const center = (centerY * map.width + centerX) * 4;
		expect([...map.data.slice(center, center + 4)]).toEqual([
			128, 128, 0, 255,
		]);

		const left = (centerY * map.width + 2) * 4;
		const right = (centerY * map.width + map.width - 3) * 4;
		expect(Math.abs(map.data[left]! - 128)).toBeGreaterThan(0);
		expect(map.data[left]! - 128).toBeCloseTo(
			-(map.data[right]! - 128),
			0,
		);
		expect(map.data[left + 1]).toBeCloseTo(map.data[right + 1]!, 0);
	});

	it("builds a bounded directional alpha highlight", () => {
		const map = buildSpecularRaster({
			radius: 38,
			pixelRatio: 1,
			angle: -Math.PI / 4,
		});
		const alpha = map.data.filter((_, index) => index % 4 === 3);

		expect(alpha.every((value) => value >= 0 && value <= 255)).toBe(true);
		expect(Math.max(...alpha)).toBeGreaterThan(0);
		expect(Math.min(...alpha)).toBe(0);
	});
});
