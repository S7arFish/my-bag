import { describe, expect, it } from "vitest";
import {
	extractFriendsConfig,
	hasBacklink,
	normalizeSiteUrl,
	parseIssueBody,
	updateFriendsConfigContent,
} from "./core.mjs";

const EMPTY_CONFIG = `import type { FriendLink } from "../../src/types/config";

export const friendsConfig: FriendLink[] = [];
`;

describe("friend-link automation public inputs and outputs", () => {
	it("parses the approved GitHub Issue Form fields", () => {
		const issue = parseIssueBody(`
### 网站名称
Example Blog

### 网站链接
https://example.com/

### 头像链接
https://example.com/avatar.png

### 网站描述
A small personal blog

### 友链页面 URL
https://example.com/friends/
`);

		expect(issue).toEqual({
			name: "Example Blog",
			siteUrl: "https://example.com/",
			avatarUrl: "https://example.com/avatar.png",
			description: "A small personal blog",
			friendPageUrl: "https://example.com/friends/",
			tag: "Blog",
		});
	});

	it("accepts only real anchors to the canonical blog host", () => {
		expect(
			hasBacklink(
				'<a class="friend" href="https://lolicon.meme/about/">MiNi飞飞</a>',
				"https://example.com/friends/",
				"https://lolicon.meme",
			),
		).toBe(true);
		expect(
			hasBacklink(
				"本站友链：https://lolicon.meme",
				"https://example.com/friends/",
				"https://lolicon.meme",
			),
		).toBe(false);
		expect(
			hasBacklink(
				'<a href="https://lolicon.meme.attacker.example">fake</a>',
				"https://example.com/friends/",
				"https://lolicon.meme",
			),
		).toBe(false);
	});

	it("normalizes public URLs and rejects executable protocols", () => {
		expect(normalizeSiteUrl("https://EXAMPLE.com/path/")).toBe(
			"https://example.com/path/",
		);
		expect(() => normalizeSiteUrl("javascript:alert(1)")).toThrow(
			"HTTP 或 HTTPS",
		);
		expect(() => normalizeSiteUrl("https://user:pass@example.com")).toThrow(
			"用户名或密码",
		);
	});

	it("serializes untrusted fields as data rather than TypeScript source", () => {
		const updated = updateFriendsConfigContent(EMPTY_CONFIG, {
			name: '\"; globalThis.pwned = true; //',
			siteUrl: "https://example.com/",
			avatarUrl: "https://example.com/avatar.png",
			description: "safe\ntext",
			friendPageUrl: "https://example.com/friends/",
			tag: "Blog",
		});
		const friends = extractFriendsConfig(updated.content);

		expect(friends).toHaveLength(1);
		expect(friends[0]?.title).toBe('\"; globalThis.pwned = true; //');
		expect(updated.content).toContain('\\"; globalThis.pwned = true; //');
	});

	it("round-trips literal assignment terminators and supports later updates", () => {
		const first = updateFriendsConfigContent(EMPTY_CONFIG, {
			name: "Name ]; marker",
			siteUrl: "https://example.com/",
			avatarUrl: "https://example.com/avatar.png",
			description: "Description ]; marker",
			friendPageUrl: "https://example.com/friends/",
			tag: "Tag ]; marker",
		});
		expect(extractFriendsConfig(first.content)[0]).toMatchObject({
			title: "Name ]; marker",
			desc: "Description ]; marker",
			tags: ["Tag ]; marker"],
		});

		const second = updateFriendsConfigContent(first.content, {
			name: "Updated Name",
			siteUrl: "https://example.com/",
			avatarUrl: "https://example.com/avatar-2.png",
			description: "Updated description",
			friendPageUrl: "https://example.com/friends/",
			tag: "Updated",
		});
		expect(extractFriendsConfig(second.content)).toHaveLength(1);
		expect(extractFriendsConfig(second.content)[0]?.title).toBe("Updated Name");
	});

	it("requires the friend page to use the submitted site's canonical host", () => {
		expect(
			updateFriendsConfigContent(EMPTY_CONFIG, {
				name: "Example Blog",
				siteUrl: "https://example.com/",
				avatarUrl: "https://example.com/avatar.png",
				description: "A small personal blog",
				friendPageUrl: "https://example.com/friends/",
				tag: "Blog",
			}),
		).toMatchObject({ changed: true });

		expect(() =>
			updateFriendsConfigContent(EMPTY_CONFIG, {
				name: "Example Blog",
				siteUrl: "https://example.com/",
				avatarUrl: "https://example.com/avatar.png",
				description: "A small personal blog",
				friendPageUrl: "https://other.example/friends/",
				tag: "Blog",
			}),
		).toThrow("同一主机名");

		expect(
			updateFriendsConfigContent(EMPTY_CONFIG, {
				name: "Example Blog",
				siteUrl: "https://example.com/",
				avatarUrl: "https://example.com/avatar.png",
				description: "A small personal blog",
				friendPageUrl: "https://www.example.com/friends/",
				tag: "Blog",
			}),
		).toMatchObject({ changed: true });
	});
});
