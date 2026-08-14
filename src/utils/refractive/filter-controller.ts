import {
	buildDisplacementRaster,
	buildSpecularRaster,
	splitRasterNineSlice,
	type RasterMap,
	type RasterNineSlice,
} from "./raster-maps";
import {
	convexSquircle,
	precomputeRadialDisplacement,
	type SurfaceFunction,
} from "./surface-equations";
import { computeChromaticDisplacementScales } from "../navbar-optics";

export interface RefractiveFilterOptions {
	radius: number | (() => number);
	bezelWidth: number | (() => number);
	blur?: number;
	glassThickness?: number;
	refractiveIndex?: number;
	specularOpacity?: number;
	specularAngle?: number;
	chromaticAberration?: number;
	pixelRatio?: number;
	bezelHeightFn?: SurfaceFunction;
}

export interface RefractiveFilterController {
	setIntensity(value: number): void;
	setSpecularOpacity(value: number): void;
	rebuild(): void;
	destroy(): void;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
let filterSequence = 0;

const noopController: RefractiveFilterController = {
	setIntensity() {},
	setSpecularOpacity() {},
	rebuild() {},
	destroy() {},
};

function resolveOption(value: number | (() => number)): number {
	const resolved = typeof value === "function" ? value() : value;
	return Number.isFinite(resolved) ? Math.max(0, resolved) : 0;
}

function supportsSvgBackdropFilter(): boolean {
	if (typeof window === "undefined" || typeof document === "undefined") {
		return false;
	}
	const css = window.CSS;
	return Boolean(
		css?.supports("backdrop-filter", "url(#refractive-test)") ||
			css?.supports("-webkit-backdrop-filter", "url(#refractive-test)"),
	);
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
	tag: K,
): SVGElementTagNameMap[K] {
	return document.createElementNS(SVG_NAMESPACE, tag);
}

function rasterToDataUrl(map: RasterMap): string {
	const canvas = document.createElement("canvas");
	canvas.width = map.width;
	canvas.height = map.height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D context is required for refraction");
	const imageData = context.createImageData(map.width, map.height);
	imageData.data.set(map.data);
	context.putImageData(imageData, 0, 0);
	return canvas.toDataURL();
}

interface SlicePlacement {
	key: keyof RasterNineSlice;
	x: number;
	y: number;
	width: number;
	height: number;
}

function appendNineSlice(
	filter: SVGFilterElement,
	slices: RasterNineSlice,
	prefix: string,
	width: number,
	height: number,
	radius: number,
): void {
	const right = Math.max(0, width - radius);
	const bottom = Math.max(0, height - radius);
	const placements: SlicePlacement[] = [
		{ key: "center", x: 0, y: 0, width, height },
		{ key: "top", x: 0, y: 0, width, height: radius },
		{ key: "bottom", x: 0, y: bottom, width, height: radius },
		{ key: "left", x: 0, y: 0, width: radius, height },
		{ key: "right", x: right, y: 0, width: radius, height },
		{ key: "topLeft", x: 0, y: 0, width: radius, height: radius },
		{ key: "topRight", x: right, y: 0, width: radius, height: radius },
		{ key: "bottomLeft", x: 0, y: bottom, width: radius, height: radius },
		{
			key: "bottomRight",
			x: right,
			y: bottom,
			width: radius,
			height: radius,
		},
	];
	const merge = createSvgElement("feMerge");
	merge.setAttribute("result", prefix);

	for (const placement of placements) {
		const result = `${prefix}-${placement.key}`;
		const image = createSvgElement("feImage");
		image.setAttribute("href", rasterToDataUrl(slices[placement.key]));
		image.setAttribute("x", String(placement.x));
		image.setAttribute("y", String(placement.y));
		image.setAttribute("width", String(placement.width));
		image.setAttribute("height", String(placement.height));
		image.setAttribute("preserveAspectRatio", "none");
		image.setAttribute("result", result);
		filter.appendChild(image);

		const mergeNode = createSvgElement("feMergeNode");
		mergeNode.setAttribute("in", result);
		merge.appendChild(mergeNode);
	}
	filter.appendChild(merge);
}

export function attachRefractiveFilter(
	element: HTMLElement,
	options: RefractiveFilterOptions,
): RefractiveFilterController {
	if (!supportsSvgBackdropFilter() || !document.body) return noopController;

	const filterId = `refractive-surface-${++filterSequence}`;
	const originalBackdrop = element.style.getPropertyValue("backdrop-filter");
	const originalWebkitBackdrop = element.style.getPropertyValue(
		"-webkit-backdrop-filter",
	);
	const originalRadius = element.style.borderRadius;
	const svg = createSvgElement("svg");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("focusable", "false");
	svg.style.position = "fixed";
	svg.style.width = "0";
	svg.style.height = "0";
	svg.style.overflow = "hidden";
	svg.style.pointerEvents = "none";
	const defs = createSvgElement("defs");
	const filter = createSvgElement("filter");
	filter.id = filterId;
	filter.setAttribute("filterUnits", "userSpaceOnUse");
	filter.setAttribute("primitiveUnits", "userSpaceOnUse");
	filter.setAttribute("color-interpolation-filters", "sRGB");
	defs.appendChild(filter);
	svg.appendChild(defs);
	document.body.appendChild(svg);

	let intensity = 1;
	let specularOpacity = Math.max(0, options.specularOpacity ?? 0.4);
	let displacementMaximum = 0;
	let displacementNodes: {
		red?: SVGFEDisplacementMapElement;
		green: SVGFEDisplacementMapElement;
		blue?: SVGFEDisplacementMapElement;
	} | null = null;
	let specularAlphaNode: SVGFEFuncAElement | null = null;
	let destroyed = false;
	let rebuildFrame: number | null = null;
	let lastWidth = -1;
	let lastHeight = -1;

	function applyLiveValues() {
		const scales = computeChromaticDisplacementScales(
			displacementMaximum,
			intensity,
			options.chromaticAberration ?? 0,
		);
		displacementNodes?.red?.setAttribute("scale", String(scales.red));
		displacementNodes?.green.setAttribute("scale", String(scales.green));
		displacementNodes?.blue?.setAttribute("scale", String(scales.blue));
		specularAlphaNode?.setAttribute("slope", String(specularOpacity));
	}

	function appendDisplacement(
		result: string,
	): SVGFEDisplacementMapElement {
		const node = createSvgElement("feDisplacementMap");
		node.setAttribute("in", "blurred-source");
		node.setAttribute("in2", "displacement-map");
		node.setAttribute("xChannelSelector", "R");
		node.setAttribute("yChannelSelector", "G");
		node.setAttribute("result", result);
		filter.appendChild(node);
		return node;
	}

	function appendChannel(
		input: string,
		result: string,
		matrix: string,
	): void {
		const color = createSvgElement("feColorMatrix");
		color.setAttribute("in", input);
		color.setAttribute("type", "matrix");
		color.setAttribute("values", matrix);
		color.setAttribute("result", result);
		filter.appendChild(color);
	}

	function rebuild() {
		if (destroyed) return;
		const rect = element.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width));
		const height = Math.max(1, Math.round(rect.height));
		const radius = Math.max(
			1,
			Math.min(resolveOption(options.radius), width / 2, height / 2),
		);
		const bezelWidth = Math.max(
			1,
			Math.min(resolveOption(options.bezelWidth), radius),
		);
		const pixelRatio = Math.min(
			3,
			Math.max(1, options.pixelRatio ?? window.devicePixelRatio ?? 1),
		);
		const radial = precomputeRadialDisplacement({
			glassThickness: options.glassThickness ?? 70,
			bezelWidth,
			refractiveIndex: options.refractiveIndex ?? 1.5,
			bezelHeightFn: options.bezelHeightFn ?? convexSquircle,
		});
		const displacementMap = buildDisplacementRaster({
			radius,
			bezelWidth,
			pixelRatio,
			radial,
		});
		const specularMap = buildSpecularRaster({
			radius,
			pixelRatio,
			angle: options.specularAngle ?? -Math.PI / 4,
		});
		const cornerPixels = Math.round(radius * pixelRatio);
		const displacementSlices = splitRasterNineSlice(
			displacementMap,
			cornerPixels,
		);
		const specularSlices = splitRasterNineSlice(specularMap, cornerPixels);

		filter.replaceChildren();
		filter.setAttribute("x", "0");
		filter.setAttribute("y", "0");
		filter.setAttribute("width", String(width));
		filter.setAttribute("height", String(height));

		const blur = createSvgElement("feGaussianBlur");
		blur.setAttribute("in", "SourceGraphic");
		blur.setAttribute("stdDeviation", String(Math.max(0, options.blur ?? 0)));
		blur.setAttribute("result", "blurred-source");
		filter.appendChild(blur);

		appendNineSlice(
			filter,
			displacementSlices,
			"displacement-map",
			width,
			height,
			radius,
		);
		appendNineSlice(
			filter,
			specularSlices,
			"specular-map",
			width,
			height,
			radius,
		);

		const chromaticAberration = Math.min(
			1,
			Math.max(0, options.chromaticAberration ?? 0),
		);
		if (chromaticAberration > 0) {
			const red = appendDisplacement("displaced-red-source");
			const green = appendDisplacement("displaced-green-source");
			const blue = appendDisplacement("displaced-blue-source");
			displacementNodes = { red, green, blue };

			appendChannel(
				"displaced-red-source",
				"red-channel",
				"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
			);
			appendChannel(
				"displaced-green-source",
				"green-channel",
				"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
			);
			appendChannel(
				"displaced-blue-source",
				"blue-channel",
				"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
			);
			const redGreen = createSvgElement("feBlend");
			redGreen.setAttribute("in", "red-channel");
			redGreen.setAttribute("in2", "green-channel");
			redGreen.setAttribute("mode", "screen");
			redGreen.setAttribute("result", "red-green-source");
			filter.appendChild(redGreen);
			const chromatic = createSvgElement("feBlend");
			chromatic.setAttribute("in", "red-green-source");
			chromatic.setAttribute("in2", "blue-channel");
			chromatic.setAttribute("mode", "screen");
			chromatic.setAttribute("result", "displaced-source");
			filter.appendChild(chromatic);
		} else {
			const green = appendDisplacement("displaced-source");
			displacementNodes = { green };
		}

		const specularTransfer = createSvgElement("feComponentTransfer");
		specularTransfer.setAttribute("in", "specular-map");
		specularTransfer.setAttribute("result", "specular-opacity");
		specularAlphaNode = createSvgElement("feFuncA");
		specularAlphaNode.setAttribute("type", "linear");
		specularTransfer.appendChild(specularAlphaNode);
		filter.appendChild(specularTransfer);

		const white = createSvgElement("feFlood");
		white.setAttribute("flood-color", "white");
		white.setAttribute("result", "white-layer");
		filter.appendChild(white);
		const maskedSpecular = createSvgElement("feComposite");
		maskedSpecular.setAttribute("in", "white-layer");
		maskedSpecular.setAttribute("in2", "specular-opacity");
		maskedSpecular.setAttribute("operator", "in");
		maskedSpecular.setAttribute("result", "masked-specular");
		filter.appendChild(maskedSpecular);
		const output = createSvgElement("feComposite");
		output.setAttribute("in", "masked-specular");
		output.setAttribute("in2", "displaced-source");
		output.setAttribute("operator", "over");
		filter.appendChild(output);

		displacementMaximum = radial.maximum;
		applyLiveValues();
		element.style.borderRadius = `${radius}px`;
		element.style.setProperty("backdrop-filter", `url(#${filterId})`);
		element.style.setProperty("-webkit-backdrop-filter", `url(#${filterId})`);
		element.dataset.refractiveActive = "true";
		lastWidth = width;
		lastHeight = height;
	}

	function scheduleRebuild() {
		if (destroyed || rebuildFrame !== null) return;
		rebuildFrame = requestAnimationFrame(() => {
			rebuildFrame = null;
			const rect = element.getBoundingClientRect();
			if (
				Math.round(rect.width) !== lastWidth ||
				Math.round(rect.height) !== lastHeight
			) {
				rebuild();
			}
		});
	}

	const resizeObserver =
		typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(scheduleRebuild);
	resizeObserver?.observe(element);
	rebuild();

	return {
		setIntensity(value) {
			intensity = Number.isFinite(value) ? Math.max(0, value) : 0;
			applyLiveValues();
		},
		setSpecularOpacity(value) {
			specularOpacity = Number.isFinite(value) ? Math.max(0, value) : 0;
			applyLiveValues();
		},
		rebuild,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			resizeObserver?.disconnect();
			if (rebuildFrame !== null) cancelAnimationFrame(rebuildFrame);
			svg.remove();
			element.style.setProperty("backdrop-filter", originalBackdrop);
			element.style.setProperty(
				"-webkit-backdrop-filter",
				originalWebkitBackdrop,
			);
			element.style.borderRadius = originalRadius;
			delete element.dataset.refractiveActive;
		},
	};
}
