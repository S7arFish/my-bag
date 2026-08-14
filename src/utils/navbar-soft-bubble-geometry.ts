export interface RoundedRectBoundaryProjection {
	x: number;
	y: number;
	normalX: number;
	normalY: number;
	tangentX: number;
	tangentY: number;
	distance: number;
	perimeterT: number;
}

export interface RoundedRectPerimeterPoint {
	x: number;
	y: number;
	normalX: number;
	normalY: number;
	tangentX: number;
	tangentY: number;
	arcLength: number;
}

export interface NavbarSoftBubblePathInput {
	width: number;
	height: number;
	radius: number;
	inset: number;
	centerT: number;
	depth: number;
	influenceWidth: number;
	shoulder: number;
	sampleCount?: number;
}

export interface NavbarSoftBubbleSample extends RoundedRectPerimeterPoint {
	baseX: number;
	baseY: number;
	displacement: number;
}

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const finiteOr = (value: number, fallback: number) =>
	Number.isFinite(value) ? value : fallback;

function normalizeCapsule(width: number, height: number, radius: number) {
	const safeWidth = Math.max(1, finiteOr(width, 1));
	const safeHeight = Math.max(1, finiteOr(height, 1));
	const safeRadius = clamp(
		finiteOr(radius, 0),
		0,
		Math.min(safeWidth, safeHeight) / 2,
	);
	const horizontal = Math.max(0, safeWidth - 2 * safeRadius);
	const vertical = Math.max(0, safeHeight - 2 * safeRadius);
	const perimeter = 2 * (horizontal + vertical) + TAU * safeRadius;
	return {
		width: safeWidth,
		height: safeHeight,
		radius: safeRadius,
		horizontal,
		vertical,
		perimeter: Math.max(1, perimeter),
	};
}

function wrap01(value: number) {
	const safe = finiteOr(value, 0);
	return ((safe % 1) + 1) % 1;
}

export function pointAtRoundedRectPerimeter(input: {
	width: number;
	height: number;
	radius: number;
	perimeterT: number;
}): RoundedRectPerimeterPoint {
	const shape = normalizeCapsule(input.width, input.height, input.radius);
	const { width, height, radius, horizontal, vertical, perimeter } = shape;
	let distance = wrap01(input.perimeterT) * perimeter;
	const linePoint = (
		x: number,
		y: number,
		normalX: number,
		normalY: number,
	): RoundedRectPerimeterPoint => ({
		x,
		y,
		normalX,
		normalY,
		tangentX: -normalY,
		tangentY: normalX,
		arcLength: wrap01(input.perimeterT) * perimeter,
	});
	const arcLength = (radius * Math.PI) / 2;
	if (distance <= horizontal) return linePoint(radius + distance, 0, 0, -1);
	distance -= horizontal;
	if (radius > 0 && distance <= arcLength) {
		const angle = -Math.PI / 2 + distance / radius;
		return linePoint(
			width - radius + Math.cos(angle) * radius,
			radius + Math.sin(angle) * radius,
			Math.cos(angle),
			Math.sin(angle),
		);
	}
	distance -= arcLength;
	if (distance <= vertical) return linePoint(width, radius + distance, 1, 0);
	distance -= vertical;
	if (radius > 0 && distance <= arcLength) {
		const angle = distance / radius;
		return linePoint(
			width - radius + Math.cos(angle) * radius,
			height - radius + Math.sin(angle) * radius,
			Math.cos(angle),
			Math.sin(angle),
		);
	}
	distance -= arcLength;
	if (distance <= horizontal)
		return linePoint(width - radius - distance, height, 0, 1);
	distance -= horizontal;
	if (radius > 0 && distance <= arcLength) {
		const angle = Math.PI / 2 + distance / radius;
		return linePoint(
			radius + Math.cos(angle) * radius,
			height - radius + Math.sin(angle) * radius,
			Math.cos(angle),
			Math.sin(angle),
		);
	}
	distance -= arcLength;
	if (distance <= vertical)
		return linePoint(0, height - radius - distance, -1, 0);
	distance -= vertical;
	const angle = radius > 0 ? Math.PI + distance / radius : Math.PI;
	return linePoint(
		radius + Math.cos(angle) * radius,
		radius + Math.sin(angle) * radius,
		Math.cos(angle),
		Math.sin(angle),
	);
}

function perimeterDistanceForPoint(
	x: number,
	y: number,
	shape: ReturnType<typeof normalizeCapsule>,
) {
	const { width, height, radius, horizontal, vertical } = shape;
	const arc = (radius * Math.PI) / 2;
	const epsilon = 1e-4;
	if (
		Math.abs(y) < epsilon &&
		x >= radius - epsilon &&
		x <= width - radius + epsilon
	)
		return clamp(x - radius, 0, horizontal);
	if (x >= width - radius - epsilon && y <= radius + epsilon) {
		const angle = clamp(
			Math.atan2(y - radius, x - (width - radius)),
			-Math.PI / 2,
			0,
		);
		return horizontal + radius * (angle + Math.PI / 2);
	}
	if (
		Math.abs(x - width) < epsilon &&
		y >= radius - epsilon &&
		y <= height - radius + epsilon
	)
		return horizontal + arc + clamp(y - radius, 0, vertical);
	if (x >= width - radius - epsilon && y >= height - radius - epsilon) {
		const angle = clamp(
			Math.atan2(y - (height - radius), x - (width - radius)),
			0,
			Math.PI / 2,
		);
		return horizontal + arc + vertical + radius * angle;
	}
	if (
		Math.abs(y - height) < epsilon &&
		x >= radius - epsilon &&
		x <= width - radius + epsilon
	)
		return (
			horizontal +
			arc +
			vertical +
			arc +
			clamp(width - radius - x, 0, horizontal)
		);
	if (x <= radius + epsilon && y >= height - radius - epsilon) {
		const angle = clamp(
			Math.atan2(y - (height - radius), x - radius),
			Math.PI / 2,
			Math.PI,
		);
		return 2 * horizontal + 2 * arc + vertical + radius * (angle - Math.PI / 2);
	}
	if (
		Math.abs(x) < epsilon &&
		y >= radius - epsilon &&
		y <= height - radius + epsilon
	)
		return (
			2 * horizontal +
			3 * arc +
			vertical +
			clamp(height - radius - y, 0, vertical)
		);
	let angle = Math.atan2(y - radius, x - radius);
	if (angle < Math.PI) angle += TAU;
	return 2 * horizontal + 3 * arc + 2 * vertical + radius * (angle - Math.PI);
}

export function projectPointToRoundedRectBoundary(input: {
	pointX: number;
	pointY: number;
	width: number;
	height: number;
	radius: number;
}): RoundedRectBoundaryProjection {
	const shape = normalizeCapsule(input.width, input.height, input.radius);
	const { width, height, radius, perimeter } = shape;
	const pointX = finiteOr(input.pointX, width / 2);
	const pointY = finiteOr(input.pointY, height / 2);
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const localX = pointX - halfWidth;
	const localY = pointY - halfHeight;
	const innerHalfWidth = Math.max(0, halfWidth - radius);
	const innerHalfHeight = Math.max(0, halfHeight - radius);
	const coreX = clamp(localX, -innerHalfWidth, innerHalfWidth);
	const coreY = clamp(localY, -innerHalfHeight, innerHalfHeight);
	const deltaX = localX - coreX;
	const deltaY = localY - coreY;
	const radialDistance = Math.hypot(deltaX, deltaY);
	let normalX = 0;
	let normalY = -1;
	let boundaryX = localX;
	let boundaryY = -halfHeight;
	let signedDistance = 0;
	if (radialDistance > 1e-7) {
		normalX = deltaX / radialDistance;
		normalY = deltaY / radialDistance;
		boundaryX = coreX + normalX * radius;
		boundaryY = coreY + normalY * radius;
		signedDistance = radialDistance - radius;
	} else {
		const edges = [
			{
				distance: halfHeight + localY,
				normalX: 0,
				normalY: -1,
				x: localX,
				y: -halfHeight,
			},
			{
				distance: halfHeight - localY,
				normalX: 0,
				normalY: 1,
				x: localX,
				y: halfHeight,
			},
			{
				distance: halfWidth + localX,
				normalX: -1,
				normalY: 0,
				x: -halfWidth,
				y: localY,
			},
			{
				distance: halfWidth - localX,
				normalX: 1,
				normalY: 0,
				x: halfWidth,
				y: localY,
			},
		];
		const nearest = edges.reduce((best, edge) =>
			edge.distance < best.distance ? edge : best,
		);
		normalX = nearest.normalX;
		normalY = nearest.normalY;
		boundaryX = nearest.x;
		boundaryY = nearest.y;
		signedDistance = -nearest.distance;
	}
	const x = boundaryX + halfWidth;
	const y = boundaryY + halfHeight;
	const perimeterT = wrap01(perimeterDistanceForPoint(x, y, shape) / perimeter);
	return {
		x,
		y,
		normalX,
		normalY,
		tangentX: -normalY,
		tangentY: normalX,
		distance: signedDistance,
		perimeterT,
	};
}

export function createNavbarSoftBubbleSamples(
	input: NavbarSoftBubblePathInput,
): NavbarSoftBubbleSample[] {
	const shape = normalizeCapsule(input.width, input.height, input.radius);
	const inset = Math.max(0, finiteOr(input.inset, 0));
	const centerT = wrap01(input.centerT);
	const depth = clamp(
		finiteOr(input.depth, 0),
		-shape.radius * 0.7,
		Math.max(0, inset),
	);
	const halfInfluence = Math.max(1, finiteOr(input.influenceWidth, 320) / 2);
	const shoulder = clamp(finiteOr(input.shoulder, 0), -0.65, 0.65);
	const sampleCount = Math.round(
		clamp(finiteOr(input.sampleCount ?? 192, 192), 48, 384),
	);
	return Array.from({ length: sampleCount }, (_, index) => {
		const perimeterT = index / sampleCount;
		const point = pointAtRoundedRectPerimeter({ ...shape, perimeterT });
		const cyclicT = Math.abs(perimeterT - centerT);
		const arcDistance = Math.min(cyclicT, 1 - cyclicT) * shape.perimeter;
		const q = clamp(arcDistance / halfInfluence, 0, 1);
		const baseBell = q >= 1 ? 0 : (1 - q * q) ** 2;
		const shoulderWave = 4 * q * q * (1 - q) * (1 - q);
		const displacement = depth * baseBell * (1 + shoulder * shoulderWave);
		const baseX = point.x + inset;
		const baseY = point.y + inset;
		return {
			...point,
			x: baseX + point.normalX * displacement,
			y: baseY + point.normalY * displacement,
			baseX,
			baseY,
			displacement,
		};
	});
}

const format = (value: number) => finiteOr(value, 0).toFixed(3);

export function createNavbarSoftBubblePath(
	input: NavbarSoftBubblePathInput,
): string {
	const points = createNavbarSoftBubbleSamples(input);
	if (points.length < 3) return "M0 0Z";
	let path = `M${format(points[0].x)} ${format(points[0].y)}`;
	for (let index = 0; index < points.length; index += 1) {
		const previous = points[(index - 1 + points.length) % points.length];
		const current = points[index];
		const next = points[(index + 1) % points.length];
		const afterNext = points[(index + 2) % points.length];
		const control1X = current.x + (next.x - previous.x) / 6;
		const control1Y = current.y + (next.y - previous.y) / 6;
		const control2X = next.x - (afterNext.x - current.x) / 6;
		const control2Y = next.y - (afterNext.y - current.y) / 6;
		path += `C${format(control1X)} ${format(control1Y)} ${format(control2X)} ${format(control2Y)} ${format(next.x)} ${format(next.y)}`;
	}
	return `${path}Z`;
}
