import { describe, expect, it } from "vitest";
import {
	computeNavbarSoftBubbleVisuals,
	createNavbarSoftBubbleMotionState,
	navbarSoftBubbleMotionIsSettled,
	stepNavbarSoftBubbleMotion,
} from "./navbar-soft-bubble-motion";

const active = { x: 0.2, y: 1, normalX: 0, normalY: 1, strength: 1 };

describe("navbar soft bubble motion", () => {
	it("lags behind a pointer moving along the edge", () => {
		let state = createNavbarSoftBubbleMotionState(active);
		state = stepNavbarSoftBubbleMotion(state, { ...active, x: 0.8 }, 1 / 60);
		expect(state.x.position).toBeGreaterThan(0.2);
		expect(state.x.position).toBeLessThan(0.8);
	});

	it("reaches a soft bounded attraction overshoot", () => {
		let state = createNavbarSoftBubbleMotionState({ ...active, strength: 0 });
		let maxDepth = 0;
		for (let frame = 0; frame < 90; frame += 1) {
			state = stepNavbarSoftBubbleMotion(state, active, 1 / 60);
			maxDepth = Math.max(
				maxDepth,
				computeNavbarSoftBubbleVisuals(state).depth,
			);
		}
		expect(maxDepth).toBeGreaterThan(26);
		expect(maxDepth).toBeLessThanOrEqual(30);
	});

	it("crosses zero at least three times and settles after release", () => {
		let state = createNavbarSoftBubbleMotionState(active);
		const release = { ...active, strength: 0 };
		let previous = computeNavbarSoftBubbleVisuals(state).depth;
		let crossings = 0;
		let peak = Math.abs(previous);
		const peaks: number[] = [];
		let previousDirection = 0;
		let settledFrame = -1;
		for (let frame = 0; frame < 120; frame += 1) {
			state = stepNavbarSoftBubbleMotion(state, release, 1 / 60);
			const next = computeNavbarSoftBubbleVisuals(state).depth;
			if (Math.sign(next) !== Math.sign(previous) && Math.abs(next) > 0.03) {
				crossings += 1;
			}
			const direction = Math.sign(next - previous);
			peak = Math.max(peak, Math.abs(next));
			if (previousDirection !== 0 && direction !== previousDirection) {
				peaks.push(peak);
				peak = Math.abs(next);
			}
			previousDirection = direction;
			previous = next;
			if (navbarSoftBubbleMotionIsSettled(state, release)) {
				settledFrame = frame;
				break;
			}
		}
		expect(crossings).toBeGreaterThanOrEqual(3);
		expect(
			peaks.slice(1).every((value, index) => value <= peaks[index] + 0.01),
		).toBe(true);
		expect(settledFrame).toBeGreaterThanOrEqual(77);
		expect(settledFrame).toBeLessThanOrEqual(102);
		expect(Math.abs(computeNavbarSoftBubbleVisuals(state).depth)).toBeLessThan(
			0.35,
		);
	});

	it("keeps output finite for invalid timing and target values", () => {
		const state = stepNavbarSoftBubbleMotion(
			createNavbarSoftBubbleMotionState(active),
			{
				x: Number.NaN,
				y: Number.POSITIVE_INFINITY,
				normalX: Number.NaN,
				normalY: 0,
				strength: Number.NaN,
			},
			Number.NaN,
		);
		for (const channel of Object.values(state)) {
			expect(Number.isFinite(channel.position)).toBe(true);
			expect(Number.isFinite(channel.velocity)).toBe(true);
		}
		for (const value of Object.values(computeNavbarSoftBubbleVisuals(state))) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});
});
