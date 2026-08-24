export interface NavbarOpticalPreset {
	glassThickness: number;
	refractiveIndex: number;
	specularOpacity: number;
	chromaticAberration: number;
}

export interface ChromaticDisplacementScales {
	red: number;
	green: number;
	blue: number;
}

export const NAVBAR_TENSION_ACTIVATION_DISTANCE = 100;

export const NAVBAR_BASE_OPTICS: NavbarOpticalPreset = {
	glassThickness: 152,
	refractiveIndex: 2.58,
	specularOpacity: 0.98,
	chromaticAberration: 0.09,
};

export const NAVBAR_FLUID_OPTICS: NavbarOpticalPreset = {
	glassThickness: 198,
	refractiveIndex: 3.05,
	specularOpacity: 1.16,
	chromaticAberration: 0.16,
};

export const NAVBAR_CAP_OPTICS: NavbarOpticalPreset = {
	glassThickness: 232,
	refractiveIndex: 3.38,
	specularOpacity: 1.28,
	chromaticAberration: 0.2,
};

export function computeChromaticDisplacementScales(
	maximum: number,
	intensity: number,
	dispersion: number,
): ChromaticDisplacementScales {
	const safeMaximum = Number.isFinite(maximum) ? Math.max(0, maximum) : 0;
	const safeIntensity = Number.isFinite(intensity) ? Math.max(0, intensity) : 0;
	const safeDispersion = Number.isFinite(dispersion)
		? Math.min(1, Math.max(0, dispersion))
		: 0;
	const center = safeMaximum * safeIntensity;
	return {
		red: center * (1 + safeDispersion),
		green: center,
		blue: center * (1 - safeDispersion),
	};
}
