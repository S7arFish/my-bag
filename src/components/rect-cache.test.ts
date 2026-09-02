import { describe, expect, it, vi } from "vitest";
import { createRectCache } from "./rect-cache";

describe("createRectCache", () => {
	it("refreshes a cached rectangle after layout events and detaches on destroy", () => {
		const firstRect = { left: 10, top: 20 } as DOMRect;
		const secondRect = { left: 30, top: 40 } as DOMRect;
		const getBoundingClientRect = vi
			.fn<() => DOMRect>()
			.mockReturnValueOnce(firstRect)
			.mockReturnValue(secondRect);
		const listeners = new Map<string, EventListener>();
		let frameCallback: FrameRequestCallback | undefined;
		const ownerWindow = {
			addEventListener: vi.fn((type: string, listener: EventListener) => {
				listeners.set(type, listener);
			}),
			removeEventListener: vi.fn((type: string) => {
				listeners.delete(type);
			}),
			requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
				frameCallback = callback;
				return 1;
			}),
			cancelAnimationFrame: vi.fn(),
		} as unknown as Window;
		const element = {
			getBoundingClientRect,
			ownerDocument: { defaultView: ownerWindow },
		} as unknown as Element;

		const cache = createRectCache(element);
		expect(cache.current).toBe(firstRect);
		expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

		listeners.get("scroll")?.(new Event("scroll"));
		expect(cache.current).toBe(firstRect);
		frameCallback?.(0);
		expect(cache.current).toBe(secondRect);

		cache.destroy();
		expect(listeners.size).toBe(0);
	});
});
