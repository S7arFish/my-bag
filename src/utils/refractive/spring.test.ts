import { describe, expect, it } from "vitest";
import { springIsSettled, stepSpring, type SpringState } from "./spring";

const config = { mass: 1, stiffness: 190, damping: 15.5 };

describe("liquid glass spring", () => {
	it("creates one controlled overshoot and settles on the target", () => {
		let state: SpringState = { position: 0, velocity: 0 };
		let maximum = 0;
		for (let frame = 0; frame < 90; frame += 1) {
			state = stepSpring(state, 1, 1 / 60, config);
			maximum = Math.max(maximum, state.position);
		}

		expect(maximum).toBeGreaterThan(1.08);
		expect(maximum).toBeLessThan(1.11);
		expect(state.position).toBeCloseTo(1, 2);
		expect(springIsSettled(state, 1)).toBe(true);
	});

	it("remains finite after an invalid or delayed frame duration", () => {
		const invalid = stepSpring(
			{ position: 0.5, velocity: 1 },
			1,
			Number.NaN,
			config,
		);
		const delayed = stepSpring(invalid, 1, 2, config);

		expect(Number.isFinite(delayed.position)).toBe(true);
		expect(Number.isFinite(delayed.velocity)).toBe(true);
	});
});
