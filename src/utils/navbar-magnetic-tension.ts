import { projectPointToRoundedRectBoundary } from "./navbar-soft-bubble-geometry";

export interface RectLike {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface NavbarTensionInput {
	pointerX: number;
	pointerY: number;
	rect: RectLike;
	radius: number;
	activationDistance: number;
	maxExtension: number;
	enabled: boolean;
}

export interface NavbarTensionTarget {
	active: boolean;
	strength: number;
	hotspotX: number;
	hotspotY: number;
	normalX: number;
	normalY: number;
	perimeterT: number;
	extensionX: number;
	extensionY: number;
}

export interface NavbarTensionLayerAnchorInput {
	hotspotX: number;
	hotspotY: number;
	normalX: number;
	normalY: number;
	shellWidth: number;
	shellHeight: number;
	layerWidth: number;
	layerHeight: number;
}

export interface NavbarTensionLayerAnchor {
	left: number;
	top: number;
}

const INACTIVE_TARGET: NavbarTensionTarget = {
	active: false,
	strength: 0,
	hotspotX: 0.5,
	hotspotY: 0.5,
	normalX: 0,
	normalY: 0,
	perimeterT: 0,
	extensionX: 0,
	extensionY: 0,
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const smoothstep = (value: number) => value * value * (3 - 2 * value);

export function computeNavbarTensionVisualStrength(
	position: number,
	target: number,
): number {
	if (!Number.isFinite(position) || !Number.isFinite(target)) return 0;
	const visiblePosition = target <= 0 ? Math.abs(position) : position;
	return clamp(visiblePosition, 0, 1);
}

export function computeNavbarTensionLayerAnchor(
	input: NavbarTensionLayerAnchorInput,
): NavbarTensionLayerAnchor {
	const values = Object.values(input);
	if (
		values.some((value) => !Number.isFinite(value)) ||
		input.shellWidth <= 0 ||
		input.shellHeight <= 0 ||
		input.layerWidth < 0 ||
		input.layerHeight < 0
	) {
		return { left: 0.5, top: 0.5 };
	}

	const boundaryX = clamp(input.hotspotX, 0, 1) * input.shellWidth;
	const boundaryY = clamp(input.hotspotY, 0, 1) * input.shellHeight;
	const anchorX = boundaryX - input.normalX * (input.layerWidth / 2);
	const anchorY = boundaryY - input.normalY * (input.layerHeight / 2);

	return {
		left: clamp(anchorX / input.shellWidth, 0, 1),
		top: clamp(anchorY / input.shellHeight, 0, 1),
	};
}

export function computeNavbarTensionTarget(
	input: NavbarTensionInput,
): NavbarTensionTarget {
	const values = [
		input.pointerX,
		input.pointerY,
		input.rect.left,
		input.rect.top,
		input.rect.width,
		input.rect.height,
		input.radius,
		input.activationDistance,
		input.maxExtension,
	];
	if (
		!input.enabled ||
		values.some((value) => !Number.isFinite(value)) ||
		input.rect.width <= 0 ||
		input.rect.height <= 0 ||
		input.activationDistance < 0 ||
		input.maxExtension < 0
	) {
		return { ...INACTIVE_TARGET };
	}

	const projection = projectPointToRoundedRectBoundary({
		pointX: input.pointerX - input.rect.left,
		pointY: input.pointerY - input.rect.top,
		width: input.rect.width,
		height: input.rect.height,
		radius: input.radius,
	});
	const {
		x: boundaryX,
		y: boundaryY,
		normalX,
		normalY,
		distance: signedDistance,
		perimeterT,
	} = projection;

	const outsideDistance = Math.max(0, signedDistance);
	if (outsideDistance > input.activationDistance) {
		return { ...INACTIVE_TARGET };
	}
	const linearStrength =
		signedDistance <= 0
			? 1
			: input.activationDistance === 0
				? 0
				: 1 - clamp(outsideDistance / input.activationDistance, 0, 1);
	const strength = smoothstep(linearStrength);
	if (strength <= 0) return { ...INACTIVE_TARGET };

	return {
		active: true,
		strength,
		hotspotX: clamp(boundaryX / input.rect.width, 0, 1),
		hotspotY: clamp(boundaryY / input.rect.height, 0, 1),
		normalX,
		normalY,
		perimeterT,
		extensionX: normalX * input.maxExtension * strength,
		extensionY: normalY * input.maxExtension * strength,
	};
}
