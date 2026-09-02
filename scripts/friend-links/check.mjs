import fs from "node:fs/promises";
import path from "node:path";
import { extractFriendsConfig, hasBacklink } from "./core.mjs";
import { fetchPublicPage } from "./network.mjs";
import { createStatusDocument } from "./status.mjs";

const CONFIG_PATH = "src/config/friendsConfig.ts";
const STATUS_PATH = "public/friend-status.json";
const SITE_URL = "https://lolicon.meme";
const CONCURRENCY = 3;

async function readJson(filePath, fallback) {
	try {
		return JSON.parse(await fs.readFile(filePath, "utf8"));
	} catch {
		return fallback;
	}
}

async function fetchWithRetries(url) {
	let lastError;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			return await fetchPublicPage(url);
		} catch (error) {
			lastError = error;
			if (attempt === 0)
				await new Promise((resolve) => setTimeout(resolve, 750));
		}
	}
	throw lastError;
}

async function checkFriend(friend) {
	const startedAt = Date.now();
	let homepage;
	try {
		homepage = await fetchWithRetries(friend.siteurl);
	} catch {
		return {
			reachable: false,
			statusCode: null,
			latencyMs: Date.now() - startedAt,
			backlink: false,
		};
	}
	const reachable = homepage.statusCode >= 200 && homepage.statusCode < 400;
	let backlink = false;
	if (friend.friendPageUrl) {
		try {
			const friendPage = await fetchWithRetries(friend.friendPageUrl);
			backlink =
				friendPage.statusCode >= 200 &&
				friendPage.statusCode < 400 &&
				hasBacklink(friendPage.body, friendPage.url, SITE_URL);
		} catch {
			backlink = false;
		}
	}
	return {
		reachable,
		statusCode: homepage.statusCode,
		latencyMs: Date.now() - startedAt,
		backlink,
	};
}

async function mapWithConcurrency(items, limit, mapper) {
	const results = new Array(items.length);
	let cursor = 0;
	async function worker() {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await mapper(items[index]);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => worker()),
	);
	return results;
}

async function main() {
	const repoRoot = process.cwd();
	const configContent = await fs.readFile(
		path.join(repoRoot, CONFIG_PATH),
		"utf8",
	);
	const friends = extractFriendsConfig(configContent).filter(
		(friend) => friend.enabled !== false,
	);
	const previous = await readJson(path.join(repoRoot, STATUS_PATH), null);
	const checks = await mapWithConcurrency(friends, CONCURRENCY, checkFriend);
	const now = new Date().toISOString();
	const result = createStatusDocument({ friends, checks, previous, now });

	await fs.writeFile(
		path.join(repoRoot, STATUS_PATH),
		`${JSON.stringify(result.document, null, 2)}\n`,
		"utf8",
	);
	const alertsPath = process.env.FRIEND_ALERTS_PATH;
	if (alertsPath) {
		await fs.writeFile(
			alertsPath,
			`${JSON.stringify(result.events, null, 2)}\n`,
			"utf8",
		);
	}
	console.log(
		`Checked ${friends.length} friend link(s); ${result.events.length} state event(s).`,
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
