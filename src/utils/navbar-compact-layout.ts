export interface NavbarCompactAnchors {
	left: number;
	right: number;
}

export interface NavbarScrollTransform {
	shellScaleX: number;
	shellInset: number;
	sideOffset: number;
}

export function computeNavbarCompactShellWidth(
	shellWidth: number,
	viewportWidth: number,
	minimumWidth: number,
	targetViewportRatio = 0.82,
): number {
	const safeShellWidth = Math.max(0, shellWidth);
	const safeViewportWidth = Math.max(0, viewportWidth);
	const safeMinimumWidth = Math.max(0, Math.min(minimumWidth, safeShellWidth));
	const safeRatio = Math.max(0, Math.min(targetViewportRatio, 1));
	return Math.min(
		safeShellWidth,
		Math.max(safeMinimumWidth, safeViewportWidth * safeRatio),
	);
}

export function interpolateNavbarShellWidth(
	expandedWidth: number,
	compactWidth: number,
	progress: number,
): number {
	const safeExpandedWidth = Math.max(0, expandedWidth);
	const safeCompactWidth = Math.max(
		0,
		Math.min(compactWidth, safeExpandedWidth),
	);
	const safeProgress = Number.isFinite(progress)
		? Math.max(-0.08, Math.min(progress, 1.1))
		: 0;
	return (
		safeExpandedWidth + (safeCompactWidth - safeExpandedWidth) * safeProgress
	);
}

export function computeNavbarScrollTransform(
	expandedWidth: number,
	compactWidth: number,
	progress: number,
	compactInset: number,
): NavbarScrollTransform {
	const safeExpandedWidth = Math.max(0, expandedWidth);
	const safeProgress = Number.isFinite(progress)
		? Math.max(-0.08, Math.min(progress, 1.1))
		: 0;
	const visualWidth = interpolateNavbarShellWidth(
		safeExpandedWidth,
		compactWidth,
		safeProgress,
	);
	const shellInset = (safeExpandedWidth - visualWidth) / 2;
	const sideOffset = shellInset + Math.max(0, compactInset) * safeProgress;
	const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

	return {
		shellScaleX:
			safeExpandedWidth > 0 ? round(visualWidth / safeExpandedWidth) : 1,
		shellInset: round(shellInset),
		sideOffset: round(sideOffset),
	};
}

export function computeNavbarCompactAnchors(
	shellWidth: number,
	compactWidth: number,
	inset: number,
): NavbarCompactAnchors {
	const safeShellWidth = Math.max(0, shellWidth);
	const safeCompactWidth = Math.max(
		0,
		Math.min(compactWidth, safeShellWidth / 2),
	);
	const maxInset = Math.max(0, (safeShellWidth - safeCompactWidth * 2) / 2);
	const safeInset = Math.max(0, Math.min(inset, maxInset));
	return {
		left: safeInset + safeCompactWidth,
		right: safeShellWidth - safeInset - safeCompactWidth,
	};
}
