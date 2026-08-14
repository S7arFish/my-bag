export interface SpringState {
	position: number;
	velocity: number;
}

export interface SpringConfig {
	mass: number;
	stiffness: number;
	damping: number;
}

export function stepSpring(
	state: SpringState,
	target: number,
	deltaSeconds: number,
	config: SpringConfig,
): SpringState {
	const dt = Number.isFinite(deltaSeconds)
		? Math.min(1 / 30, Math.max(1 / 120, deltaSeconds))
		: 1 / 60;
	const mass = Math.max(Number.EPSILON, config.mass);
	const stiffness = Math.max(0, config.stiffness);
	const damping = Math.max(0, config.damping);
	const position = Number.isFinite(state.position) ? state.position : target;
	const previousVelocity = Number.isFinite(state.velocity) ? state.velocity : 0;
	const acceleration =
		(-stiffness * (position - target) - damping * previousVelocity) / mass;
	const velocity = previousVelocity + acceleration * dt;
	return { position: position + velocity * dt, velocity };
}

export function springIsSettled(
	state: SpringState,
	target: number,
	positionTolerance = 0.001,
	velocityTolerance = 0.01,
): boolean {
	return (
		Math.abs(state.position - target) < positionTolerance &&
		Math.abs(state.velocity) < velocityTolerance
	);
}
