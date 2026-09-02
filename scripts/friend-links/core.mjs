const DEFAULT_TAG = "Blog";
const FRIENDS_CONFIG_PATTERN =
	/^export const friendsConfig: FriendLink\[\] = (\[[\s\S]*?\]);[ \t]*\r?$/m;

const FIELD_LIMITS = {
	name: 80,
	description: 240,
	tag: 32,
	url: 2048,
};

function cleanIssueValue(value) {
	const trimmed = String(value ?? "").trim();
	return trimmed === "_No response_" ? "" : trimmed;
}

function assertLength(label, value, maximum, required = true) {
	const normalized = cleanIssueValue(value);
	if (required && !normalized) throw new Error(`${label}不能为空`);
	if (normalized.length > maximum) {
		throw new Error(`${label}不能超过 ${maximum} 个字符`);
	}
	return normalized;
}

export function normalizeFriendKey(value) {
	const url = new URL(normalizeSiteUrl(value));
	url.hash = "";
	url.search = "";
	const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
	return `${url.origin}${path}`;
}

function canonicalHostname(value) {
	return value
		.toLowerCase()
		.replace(/\.$/, "")
		.replace(/^www\./, "");
}

export function normalizeSiteUrl(value) {
	const input = assertLength("URL", value, FIELD_LIMITS.url);
	let url;
	try {
		url = new URL(input);
	} catch {
		throw new Error("URL 格式无效");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("URL 只允许 HTTP 或 HTTPS 协议");
	}
	if (url.username || url.password) {
		throw new Error("URL 不能包含用户名或密码");
	}
	if (!url.hostname) throw new Error("URL 缺少主机名");
	url.hash = "";
	return url.toString();
}

export function parseIssueBody(body) {
	const fields = new Map();
	const lines = String(body ?? "").split(/\r?\n/);
	let heading = "";
	for (const rawLine of lines) {
		const line = rawLine.trim();
		const match = line.match(/^###\s+(.+)$/);
		if (match) {
			heading = match[1].trim();
			continue;
		}
		if (!heading || !line) continue;
		fields.set(heading, cleanIssueValue(line));
		heading = "";
	}

	return validateSubmission({
		name: fields.get("网站名称"),
		siteUrl: fields.get("网站链接"),
		avatarUrl: fields.get("头像链接"),
		description: fields.get("网站描述"),
		friendPageUrl: fields.get("友链页面 URL"),
		tag: fields.get("网站标签") || DEFAULT_TAG,
	});
}

export function validateSubmission(value) {
	const name = assertLength("网站名称", value?.name, FIELD_LIMITS.name);
	const siteUrl = normalizeSiteUrl(value?.siteUrl);
	const avatarUrl = normalizeSiteUrl(value?.avatarUrl);
	const description = assertLength(
		"网站描述",
		value?.description,
		FIELD_LIMITS.description,
	);
	const friendPageUrl = normalizeSiteUrl(value?.friendPageUrl);
	const tag = assertLength(
		"网站标签",
		value?.tag || DEFAULT_TAG,
		FIELD_LIMITS.tag,
	);
	if (
		canonicalHostname(new URL(friendPageUrl).hostname) !==
		canonicalHostname(new URL(siteUrl).hostname)
	) {
		throw new Error("友链页面 URL 必须与网站链接使用同一主机名");
	}

	return {
		name,
		siteUrl,
		avatarUrl,
		description,
		friendPageUrl,
		tag: tag || DEFAULT_TAG,
	};
}

export function hasBacklink(html, pageUrl, targetUrl) {
	const targetHost = canonicalHostname(
		new URL(normalizeSiteUrl(targetUrl)).hostname,
	);
	const anchorPattern =
		/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
	for (const match of String(html ?? "").matchAll(anchorPattern)) {
		const href = match[1] ?? match[2] ?? match[3] ?? "";
		try {
			const resolved = new URL(href, pageUrl);
			if (
				(resolved.protocol === "http:" || resolved.protocol === "https:") &&
				canonicalHostname(resolved.hostname) === targetHost
			) {
				return true;
			}
		} catch {
			// Ignore malformed links and continue checking the remaining anchors.
		}
	}
	return false;
}

export function extractFriendsConfig(content) {
	const match = String(content).match(FRIENDS_CONFIG_PATTERN);
	if (!match) throw new Error("未找到可自动维护的 friendsConfig 数组");
	let parsed;
	try {
		parsed = JSON.parse(match[1]);
	} catch {
		throw new Error("friendsConfig 自动维护区必须使用 JSON 兼容格式");
	}
	if (!Array.isArray(parsed)) throw new Error("friendsConfig 必须是数组");
	return parsed;
}

export function updateFriendsConfigContent(content, untrustedSubmission) {
	const submission = validateSubmission(untrustedSubmission);
	const friends = extractFriendsConfig(content);
	const nextFriend = {
		title: submission.name,
		imgurl: submission.avatarUrl,
		desc: submission.description,
		siteurl: submission.siteUrl,
		friendPageUrl: submission.friendPageUrl,
		tags: [submission.tag],
		weight: 5,
		enabled: true,
	};
	const existingIndex = friends.findIndex(
		(friend) =>
			normalizeFriendKey(friend.siteurl) ===
			normalizeFriendKey(submission.siteUrl),
	);
	if (existingIndex >= 0) friends[existingIndex] = nextFriend;
	else friends.push(nextFriend);

	const rendered = JSON.stringify(friends, null, "\t");
	const updatedContent = String(content).replace(
		FRIENDS_CONFIG_PATTERN,
		`export const friendsConfig: FriendLink[] = ${rendered};`,
	);
	return {
		changed: updatedContent !== content,
		content: updatedContent,
		friend: nextFriend,
	};
}
