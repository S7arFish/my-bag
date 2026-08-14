interface OrbMotion {
	x: number;
	y: number;
	radius: number;
	vx: number;
	vy: number;
}

interface OrbDrag {
	isDragging: boolean;
	velX: number;
	velY: number;
}

export interface LiquidGlassOrbStyle {
	x: number;
	y: number;
	radius: number;
	highlightX: number;
	highlightY: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
	intensity: number;
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export function computeLiquidGlassOrbStyle(
	ball: OrbMotion,
	drag: OrbDrag,
	dpr: number,
): LiquidGlassOrbStyle {
	const speedX = drag.isDragging ? drag.velX : ball.vx / 8;
	const speedY = drag.isDragging ? drag.velY : ball.vy / 8;
	const motion = clamp(Math.hypot(speedX, speedY) / 2, 0, 1);

	return {
		x: ball.x / dpr,
		y: ball.y / dpr,
		radius: ball.radius / dpr,
		highlightX: 50 + clamp(speedX * 4, -8, 8),
		highlightY: 36 + clamp(speedY * 6, -6, 6),
		scaleX: 1 + motion * 0.06,
		scaleY: 1 - motion * 0.03,
		rotation: motion === 0
			? 0
			: clamp((Math.atan2(speedY, speedX) * 180) / Math.PI, -12, 12),
		intensity: 1 + motion * 0.18,
	};
}
