export function createRectCache(element: Element) {
	const ownerWindow = element.ownerDocument.defaultView ?? window;
	let current = element.getBoundingClientRect();
	let frame = 0;

	const refresh = () => {
		frame = 0;
		current = element.getBoundingClientRect();
	};
	const scheduleRefresh = () => {
		if (frame === 0) {
			frame = ownerWindow.requestAnimationFrame(refresh);
		}
	};

	ownerWindow.addEventListener("resize", scheduleRefresh, { passive: true });
	ownerWindow.addEventListener("scroll", scheduleRefresh, {
		capture: true,
		passive: true,
	});

	return {
		get current() {
			return current;
		},
		destroy() {
			ownerWindow.removeEventListener("resize", scheduleRefresh);
			ownerWindow.removeEventListener("scroll", scheduleRefresh, true);
			if (frame !== 0) ownerWindow.cancelAnimationFrame(frame);
		},
	};
}
