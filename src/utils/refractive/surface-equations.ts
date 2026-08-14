/**
 * Framework-neutral refraction math adapted from @hashintel/refractive 0.0.4.
 * Upstream: https://github.com/hashintel/hash/tree/main/libs/%40hashintel/refractive
 * License: MIT OR Apache-2.0.
 */
export type SurfaceFunction = (x: number) => number;

export interface RadialRefractionOptions {
	glassThickness: number;
	bezelWidth: number;
	refractiveIndex: number;
	samples?: number;
	bezelHeightFn?: SurfaceFunction;
}

export interface RadialDisplacement {
	values: Float32Array;
	maximum: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const convexCircle: SurfaceFunction = (x) => {
	const value = clamp01(x);
	return Math.sqrt(Math.max(0, 1 - (1 - value) ** 2));
};

export const convexSquircle: SurfaceFunction = (x) => {
	const value = clamp01(x);
	return Math.max(0, 1 - (1 - value) ** 4) ** 0.25;
};

export const concave: SurfaceFunction = (x) => 1 - convexCircle(x);

export const lip: SurfaceFunction = (x) => {
	const value = clamp01(x);
	const convexValue = Math.max(0, 1 - (1 - value * 2) ** 4) ** 0.25;
	const concaveValue = concave(value) + 0.1;
	const smootherStep =
		6 * value ** 5 - 15 * value ** 4 + 10 * value ** 3;
	return convexValue * (1 - smootherStep) + concaveValue * smootherStep;
};

export function precomputeRadialDisplacement({
	glassThickness,
	bezelWidth,
	refractiveIndex,
	samples = 128,
	bezelHeightFn = convexSquircle,
}: RadialRefractionOptions): RadialDisplacement {
	const count = Math.max(2, Math.round(samples));
	const eta = 1 / Math.max(1.0001, refractiveIndex);
	const thickness = Math.max(0, glassThickness);
	const bezel = Math.max(0, bezelWidth);
	const values = new Float32Array(count);

	for (let index = 0; index < count; index += 1) {
		const x = index / (count - 1);
		const height = bezelHeightFn(x);
		const delta = x < 1 ? 0.0001 : -0.0001;
		const derivative = (bezelHeightFn(x + delta) - height) / delta;
		const normalLength = Math.hypot(derivative, 1);
		const normalX = -derivative / normalLength;
		const normalY = -1 / normalLength;
		const discriminant = 1 - eta * eta * (1 - normalY * normalY);
		if (discriminant < 0) continue;

		const factor = eta * normalY + Math.sqrt(discriminant);
		const refractedX = -factor * normalX;
		const refractedY = eta - factor * normalY;
		if (Math.abs(refractedY) < Number.EPSILON) continue;

		const rayHeight = height * thickness + bezel;
		const displacement = refractedX * (rayHeight / refractedY);
		values[index] = Number.isFinite(displacement) ? displacement : 0;
	}

	let maximum = 0;
	for (const value of values) maximum = Math.max(maximum, Math.abs(value));
	return { values, maximum };
}
