import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aiSearchConfig } from "./aiSearchConfig";
import { commentConfig } from "./commentConfig";
import { friendsPageConfig } from "./friendsConfig";
import { siteConfig } from "./siteConfig";
import { sponsorConfig } from "./sponsorConfig";

describe("external service cleanup", () => {
	it("disconnects the original Umami service", () => {
		const umami = siteConfig.analytics!.umamiAnalytics!;

		expect(umami.websiteId).toBe("");
		expect(umami.shareId).toBe("");
		expect(umami.scriptUrl).toBe("");
		expect(umami.pageviews!.enabled).toBe(false);
		expect(umami.trackOutboundLinks).toBe(false);
		expect(umami.relpays!.enabled).toBe(false);
	});

	it("turns off comments and removes the original comment identities", () => {
		expect(commentConfig.type).toBe("none");
		expect(siteConfig.pages.guestbook).toBe(false);
		expect(commentConfig.waline?.serverURL).toBe("");
		expect(commentConfig.twikoo?.envId).toBe("");
		expect(commentConfig.twikoo?.visitorCount).toBe(false);
		expect(commentConfig.giscus?.repo).toBe("");
		expect(commentConfig.giscus?.repoId).toBe("");
		expect(commentConfig.giscus?.categoryId).toBe("");
	});

	it("turns off sponsorship and clears the old sponsor records", () => {
		expect(siteConfig.pages.sponsor).toBe(false);
		expect(sponsorConfig.showSponsorsList).toBe(false);
		expect(sponsorConfig.methods).toEqual([]);
		expect(sponsorConfig.sponsors).toEqual([]);
	});

	it("keeps AI search disabled and enables repository-owned friend-link automation", () => {
		expect(aiSearchConfig.enabled).toBe(false);
		expect(friendsPageConfig.applyLink).toBe(
			"https://github.com/S7arFish/my-bag/issues/new?template=friend-link.yml",
		);

		const workflow = readFileSync(
			new URL(
				"../../.github/workflows/friend-link-checker.yml",
				import.meta.url,
			),
			"utf8",
		);
		const automation = readFileSync(
			new URL(
				"../../.github/scripts/process-friend-request.cjs",
				import.meta.url,
			),
			"utf8",
		);

		expect(workflow).toMatch(/issues:\s*\n\s+types:/);
		expect(workflow).toContain("issue_comment:");
		expect(automation).not.toContain("MmzMing");
		expect(automation).not.toContain("tblog.mmzhiku.xyz");
		expect(automation).toContain("https://lolicon.meme");
	});
});
