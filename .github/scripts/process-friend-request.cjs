const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

const FRIENDS_CONFIG_PATH = "src/config/friendsConfig.ts";
const SITE_INFO = {
	name: "MiNi飞飞",
	url: "https://lolicon.meme",
	avatar: "https://lolicon.meme/favicon/android-chrome-512x512.png",
	description: "MiNi飞飞的博客",
};

function run(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: "inherit",
		shell: false,
	});
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed (${result.status})`);
	}
}

function hasLabel(issue, label) {
	return (issue.labels ?? []).some((item) =>
		typeof item === "string" ? item === label : item?.name === label,
	);
}

function safeLabel(value) {
	return String(value).replace(/[\r\n`@]/g, " ").trim();
}

async function comment(github, context, body) {
	await github.rest.issues.createComment({
		...context.repo,
		issue_number: context.payload.issue.number,
		body,
	});
}

async function fetchWithRetry(fetchPublicPage, url) {
	let lastError;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			return await fetchPublicPage(url);
		} catch (error) {
			lastError = error;
			if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
		}
	}
	throw lastError;
}

module.exports = async function processFriendRequest({ github, context, core }) {
	const issue = context.payload.issue;
	if (!issue || !hasLabel(issue, "friend-link")) {
		core.info("事件不是带 friend-link 标签的 Issue，跳过。");
		return;
	}
	if (issue.state !== "open") {
		core.info("Issue 已关闭，跳过重复验证。");
		return;
	}
	if (
		context.eventName === "issue_comment" &&
		context.payload.comment?.user?.login !== issue.user?.login
	) {
		core.info("回复者不是申请人，跳过自动重试。");
		return;
	}

	const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
	const coreModuleUrl = pathToFileURL(
		path.join(repoRoot, "scripts/friend-links/core.mjs"),
	).href;
	const networkModuleUrl = pathToFileURL(
		path.join(repoRoot, "scripts/friend-links/network.mjs"),
	).href;
	const [
		{ hasBacklink, parseIssueBody, updateFriendsConfigContent },
		{ assertPublicUrl, fetchPublicPage },
	] = await Promise.all([import(coreModuleUrl), import(networkModuleUrl)]);

	let submission;
	try {
		submission = parseIssueBody(issue.body || "");
	} catch (error) {
		await comment(
			github,
			context,
			`❌ 友链信息校验失败：${safeLabel(error.message)}\n\n请修改 Issue 后再试。`,
		);
		return;
	}

	try {
		await assertPublicUrl(submission.avatarUrl);
		const [siteResponse, friendPageResponse] = await Promise.all([
			fetchWithRetry(fetchPublicPage, submission.siteUrl),
			fetchWithRetry(fetchPublicPage, submission.friendPageUrl),
		]);
		if (siteResponse.statusCode < 200 || siteResponse.statusCode >= 400) {
			throw new Error(`网站首页返回 HTTP ${siteResponse.statusCode}`);
		}
		if (friendPageResponse.statusCode < 200 || friendPageResponse.statusCode >= 400) {
			throw new Error(`友链页返回 HTTP ${friendPageResponse.statusCode}`);
		}
		if (
			!hasBacklink(
				friendPageResponse.body,
				friendPageResponse.url,
				SITE_INFO.url,
			)
		) {
			await comment(
				github,
				context,
				`❌ 没有在提交的友链页面中找到指向 <${SITE_INFO.url}> 的真实链接。\n\n添加后回复本 Issue 即可重试。`,
			);
			return;
		}
	} catch (error) {
		await comment(
			github,
			context,
			`❌ 暂时无法通过友链验证：${safeLabel(error.message)}\n\n请检查地址和访问状态，修正后回复本 Issue 重试。`,
		);
		return;
	}

	run("git", ["pull", "--ff-only", "origin", context.payload.repository.default_branch], repoRoot);
	const configPath = path.join(repoRoot, FRIENDS_CONFIG_PATH);
	const currentContent = fs.readFileSync(configPath, "utf8");
	const update = updateFriendsConfigContent(currentContent, submission);
	if (update.changed) {
		fs.writeFileSync(configPath, update.content, "utf8");
		run("pnpm", ["exec", "biome", "format", "--write", FRIENDS_CONFIG_PATH], repoRoot);
		run("pnpm", ["vitest", "run", "scripts/friend-links/core.test.ts"], repoRoot);
		run("git", ["add", "--", FRIENDS_CONFIG_PATH], repoRoot);
		run(
			"git",
			["commit", "-m", `friend-links: add ${safeLabel(submission.name)}`],
			repoRoot,
		);
		run(
			"git",
			["push", "origin", `HEAD:${context.payload.repository.default_branch}`],
			repoRoot,
		);
	}

	await comment(
		github,
		context,
		update.changed
			? `✅ 已验证并添加友链：**${safeLabel(submission.name)}**。`
			: `✅ **${safeLabel(submission.name)}** 的友链信息已经是最新状态。`,
	);
	await github.rest.issues.update({
		...context.repo,
		issue_number: issue.number,
		state: "closed",
		state_reason: "completed",
	});
};
