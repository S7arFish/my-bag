import { describe, expect, it, vi } from "vitest";
import { fetchPublicPage, isPublicIpAddress } from "./network.mjs";

describe("friend-link network boundary", () => {
	it("rejects private, loopback, metadata and link-local addresses", () => {
		for (const address of [
			"127.0.0.1",
			"10.0.0.8",
			"172.16.2.4",
			"192.168.1.8",
			"169.254.169.254",
			"::1",
			"fc00::1",
			"fe80::1",
		]) {
			expect(isPublicIpAddress(address), address).toBe(false);
		}
		expect(isPublicIpAddress("93.184.216.34")).toBe(true);
		expect(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
	});

	it("blocks a private DNS result before opening a connection", async () => {
		const request = vi.fn();
		await expect(
			fetchPublicPage("https://internal.example/", {
				lookup: async () => [{ address: "127.0.0.1", family: 4 }],
				request,
			}),
		).rejects.toThrow("非公网地址");
		expect(request).not.toHaveBeenCalled();
	});

	it("revalidates DNS on every redirect", async () => {
		const lookup = vi.fn(async (hostname: string) =>
			hostname === "public.example"
				? [{ address: "93.184.216.34", family: 4 }]
				: [{ address: "169.254.169.254", family: 4 }],
		);
		const request = vi.fn(async () => ({
			statusCode: 302,
			headers: { location: "http://metadata.example/latest" },
			body: "",
		}));

		await expect(
			fetchPublicPage("https://public.example/friends", { lookup, request }),
		).rejects.toThrow("非公网地址");
		expect(request).toHaveBeenCalledTimes(1);
		expect(lookup).toHaveBeenCalledTimes(2);
	});
});
