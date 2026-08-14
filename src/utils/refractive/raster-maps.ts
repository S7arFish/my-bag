import type { RadialDisplacement } from "./surface-equations";

export interface RasterMap {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

export interface DisplacementRasterOptions {
	radius: number;
	bezelWidth: number;
	pixelRatio: number;
	radial: RadialDisplacement;
}

export interface SpecularRasterOptions {
	radius: number;
	pixelRatio: number;
	angle: number;
}

export interface RasterNineSlice {
	topLeft: RasterMap;
	top: RasterMap;
	topRight: RasterMap;
	left: RasterMap;
	center: RasterMap;
	right: RasterMap;
	bottomLeft: RasterMap;
	bottom: RasterMap;
	bottomRight: RasterMap;
}

const clampByte = (value: number) =>
	Math.round(Math.min(255, Math.max(0, value)));

function createRaster(width: number, height: number, neutral: boolean): RasterMap {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < data.length; index += 4) {
		data[index] = neutral ? 128 : 255;
		data[index + 1] = neutral ? 128 : 255;
		data[index + 2] = neutral ? 0 : 255;
		data[index + 3] = neutral ? 255 : 0;
	}
	return { width, height, data };
}

export function buildDisplacementRaster({
	radius,
	bezelWidth,
	pixelRatio,
	radial,
}: DisplacementRasterOptions): RasterMap {
	const ratio = Math.max(1, pixelRatio);
	const radiusPixels = Math.max(1, Math.round(radius * ratio));
	const bezelPixels = Math.max(
		1,
		Math.min(radiusPixels, Math.round(bezelWidth * ratio)),
	);
	const size = radiusPixels * 2 + 1;
	const map = createRaster(size, size, true);
	const sampleMaximum = Math.max(radial.maximum, Number.EPSILON);

	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const dx = x - radiusPixels;
			const dy = y - radiusPixels;
			const distance = Math.hypot(dx, dy);
			const distanceFromBorder = radiusPixels - distance;
			if (distanceFromBorder < 0 || distanceFromBorder > bezelPixels) continue;

			const ratioFromBorder = distanceFromBorder / bezelPixels;
			const sampleIndex = Math.min(
				radial.values.length - 1,
				Math.max(0, Math.round(ratioFromBorder * (radial.values.length - 1))),
			);
			const magnitude = radial.values[sampleIndex]! / sampleMaximum;
			const angle = Math.atan2(dy, dx);
			const displacementX = -Math.cos(angle) * magnitude;
			const displacementY = -Math.sin(angle) * magnitude;
			const offset = (y * size + x) * 4;
			map.data[offset] = clampByte(128 + displacementX * 127);
			map.data[offset + 1] = clampByte(128 + displacementY * 127);
		}
	}

	return map;
}

export function buildSpecularRaster({
	radius,
	pixelRatio,
	angle,
}: SpecularRasterOptions): RasterMap {
	const ratio = Math.max(1, pixelRatio);
	const radiusPixels = Math.max(1, Math.round(radius * ratio));
	const size = radiusPixels * 2 + 1;
	const map = createRaster(size, size, false);
	const bezelPixels = Math.min(radiusPixels, Math.max(2, Math.round(20 * ratio)));
	const lightX = Math.cos(angle);
	const lightY = Math.sin(angle);

	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const dx = x - radiusPixels;
			const dy = y - radiusPixels;
			const distance = Math.hypot(dx, dy);
			if (distance === 0) continue;
			const distanceFromBorder = radiusPixels - distance;
			if (distanceFromBorder < 0 || distanceFromBorder > bezelPixels) continue;

			const normalX = dx / distance;
			const normalY = -dy / distance;
			const directional = Math.abs(normalX * lightX + normalY * lightY);
			const rim = 1 - distanceFromBorder / bezelPixels;
			const alpha = 255 * directional * rim * rim;
			map.data[(y * size + x) * 4 + 3] = clampByte(alpha);
		}
	}

	return map;
}

function extractRaster(
	map: RasterMap,
	x: number,
	y: number,
	width: number,
	height: number,
): RasterMap {
	const result = new Uint8ClampedArray(width * height * 4);
	for (let row = 0; row < height; row += 1) {
		const sourceStart = ((y + row) * map.width + x) * 4;
		const sourceEnd = sourceStart + width * 4;
		result.set(map.data.subarray(sourceStart, sourceEnd), row * width * 4);
	}
	return { width, height, data: result };
}

export function splitRasterNineSlice(
	map: RasterMap,
	cornerPixels: number,
): RasterNineSlice {
	const corner = Math.max(1, Math.round(cornerPixels));
	if (map.width !== corner * 2 + 1 || map.height !== corner * 2 + 1) {
		throw new Error("Raster dimensions must equal cornerPixels * 2 + 1");
	}
	const far = corner + 1;
	return {
		topLeft: extractRaster(map, 0, 0, corner, corner),
		top: extractRaster(map, corner, 0, 1, corner),
		topRight: extractRaster(map, far, 0, corner, corner),
		left: extractRaster(map, 0, corner, corner, 1),
		center: extractRaster(map, corner, corner, 1, 1),
		right: extractRaster(map, far, corner, corner, 1),
		bottomLeft: extractRaster(map, 0, far, corner, corner),
		bottom: extractRaster(map, corner, far, 1, corner),
		bottomRight: extractRaster(map, far, far, corner, corner),
	};
}
