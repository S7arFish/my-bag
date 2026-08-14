import type { SpringState } from "./refractive/spring";
import { springIsSettled, stepSpring } from "./refractive/spring";

export interface NavbarSoftBubbleTarget {
	x: number;
	y: number;
	normalX: number;
	normalY: number;
	strength: number;
}

export interface NavbarSoftBubbleMotionState {
	x: SpringState;
	y: SpringState;
	normalX: SpringState;
	normalY: SpringState;
	depth: SpringState;
	spread: SpringState;
	shoulder: SpringState;
}

export interface NavbarSoftBubbleVisuals {
	depth: number;
	influenceWidth: number;
	shoulder: number;
	presence: number;
	opticalEnergy: number;
}

const CENTER_SPRING = { mass: 1, stiffness: 105, damping: 10 };
const DEPTH_SPRING = { mass: 1, stiffness: 210, damping: 5 };
const SPREAD_SPRING = { mass: 1, stiffness: 150, damping: 5.8 };
const SHOULDER_SPRING = { mass: 1, stiffness: 135, damping: 4.8 };
const MAX_DEPTH = 26;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const finiteOr = (value: number, fallback: number) =>
	Number.isFinite(value) ? value : fallback;

function normalizedTarget(
	target: NavbarSoftBubbleTarget,
	fallback: NavbarSoftBubbleMotionState,
): NavbarSoftBubbleTarget {
	const normalX = finiteOr(target.normalX, fallback.normalX.position);
	const normalY = finiteOr(target.normalY, fallback.normalY.position);
	const length = Math.hypot(normalX, normalY);
	return {
		x: clamp(finiteOr(target.x, fallback.x.position), 0, 1),
		y: clamp(finiteOr(target.y, fallback.y.position), 0, 1),
		normalX: length > 1e-6 ? normalX / length : fallback.normalX.position,
		normalY: length > 1e-6 ? normalY / length : fallback.normalY.position,
		strength: clamp(finiteOr(target.strength, 0), 0, 1),
	};
}

export function createNavbarSoftBubbleMotionState(
	target: NavbarSoftBubbleTarget,
): NavbarSoftBubbleMotionState {
	const x = clamp(finiteOr(target.x, 0.5), 0, 1);
	const y = clamp(finiteOr(target.y, 0.5), 0, 1);
	const inputNormalX = finiteOr(target.normalX, 0);
	const inputNormalY = finiteOr(target.normalY, 1);
	const length = Math.hypot(inputNormalX, inputNormalY);
	const normalX = length > 1e-6 ? inputNormalX / length : 0;
	const normalY = length > 1e-6 ? inputNormalY / length : 1;
	const strength = clamp(finiteOr(target.strength, 0), 0, 1);
	return {
		x: { position: x, velocity: 0 },
		y: { position: y, velocity: 0 },
		normalX: { position: normalX, velocity: 0 },
		normalY: { position: normalY, velocity: 0 },
		depth: { position: MAX_DEPTH * strength, velocity: 0 },
		spread: { position: strength, velocity: 0 },
		shoulder: { position: strength, velocity: 0 },
	};
}

export function stepNavbarSoftBubbleMotion(
	state: NavbarSoftBubbleMotionState,
	target: NavbarSoftBubbleTarget,
	deltaSeconds: number,
): NavbarSoftBubbleMotionState {
	const nextTarget = normalizedTarget(target, state);
	return {
		x: stepSpring(state.x, nextTarget.x, deltaSeconds, CENTER_SPRING),
		y: stepSpring(state.y, nextTarget.y, deltaSeconds, CENTER_SPRING),
		normalX: stepSpring(
			state.normalX,
			nextTarget.normalX,
			deltaSeconds,
			CENTER_SPRING,
		),
		normalY: stepSpring(
			state.normalY,
			nextTarget.normalY,
			deltaSeconds,
			CENTER_SPRING,
		),
		depth: stepSpring(
			state.depth,
			MAX_DEPTH * nextTarget.strength,
			deltaSeconds,
			DEPTH_SPRING,
		),
		spread: stepSpring(
			state.spread,
			nextTarget.strength,
			deltaSeconds,
			SPREAD_SPRING,
		),
		shoulder: stepSpring(
			state.shoulder,
			nextTarget.strength,
			deltaSeconds,
			SHOULDER_SPRING,
		),
	};
}

export function computeNavbarSoftBubbleVisuals(
	state: NavbarSoftBubbleMotionState,
): NavbarSoftBubbleVisuals {
	const rawDepth = finiteOr(state.depth.position, 0);
	const depth = clamp(rawDepth, -18.2, 30);
	const spread = clamp(finiteOr(state.spread.position, 0), -0.5, 1.25);
	const shoulderPosition = clamp(
		finiteOr(state.shoulder.position, 0),
		-1,
		1.35,
	);
	const velocity = finiteOr(state.depth.velocity, 0);
	const presence = clamp(
		Math.max(Math.abs(depth) / MAX_DEPTH, Math.abs(velocity) / 100),
		0,
		1,
	);
	return {
		depth,
		influenceWidth: clamp(304 + spread * 16, 280, 336),
		shoulder: clamp((shoulderPosition - spread) * 0.9, -0.6, 0.6),
		presence,
		opticalEnergy: clamp(
			Math.abs(depth) / MAX_DEPTH + Math.abs(velocity) / 180,
			0,
			1,
		),
	};
}

export function navbarSoftBubbleMotionIsSettled(
	state: NavbarSoftBubbleMotionState,
	target: NavbarSoftBubbleTarget,
): boolean {
	const nextTarget = normalizedTarget(target, state);
	return (
		springIsSettled(state.x, nextTarget.x, 0.0005, 0.003) &&
		springIsSettled(state.y, nextTarget.y, 0.0005, 0.003) &&
		springIsSettled(state.normalX, nextTarget.normalX, 0.0005, 0.003) &&
		springIsSettled(state.normalY, nextTarget.normalY, 0.0005, 0.003) &&
		springIsSettled(state.depth, MAX_DEPTH * nextTarget.strength, 0.3, 3) &&
		springIsSettled(state.spread, nextTarget.strength, 0.018, 0.08) &&
		springIsSettled(state.shoulder, nextTarget.strength, 0.03, 0.15)
	);
}
