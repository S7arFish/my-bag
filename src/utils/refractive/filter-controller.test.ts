import { describe, expect, it } from "vitest";
import { attachRefractiveFilter } from "./filter-controller";

describe("attachRefractiveFilter", () => {
	it("returns a safe no-op controller when browser filter APIs are absent", () => {
		const element = { style: {} } as HTMLElement;
		const controller = attachRefractiveFilter(element, {
			radius: 24,
			bezelWidth: 12,
		});

		expect(() => {
			controller.setIntensity(1.1);
			controller.setSpecularOpacity(0.5);
			controller.rebuild();
			controller.destroy();
		}).not.toThrow();
	});
});
