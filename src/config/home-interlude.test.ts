import { describe, expect, it } from "vitest";
import { homeConfig } from "./homeConfig";

describe("home portfolio interlude", () => {
	it("provides distinct left and right foreground characters", () => {
		const foregrounds = homeConfig.portfolioShutter.interlude.foregrounds;

		expect(foregrounds).toEqual({
			left: "/assets/images/home-truncated/rimuru.webp",
			right: "/assets/images/home-truncated/milim.webp",
		});
		expect(foregrounds.left).not.toBe(foregrounds.right);
	});
});
