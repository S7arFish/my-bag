import { spawnSync } from "node:child_process";

function readInteger(flag) {
	const index = process.argv.indexOf(flag);
	const raw = index >= 0 ? process.argv[index + 1] : undefined;
	if (!raw || !/^\d+$/.test(raw)) {
		throw new Error(`${flag} 必须是非负整数`);
	}
	const value = Number(raw);
	if (!Number.isSafeInteger(value)) throw new Error(`${flag} 超出安全整数范围`);
	return value;
}

function main() {
	const remote = process.argv.includes("--remote");
	const local = process.argv.includes("--local");
	if (remote === local) {
		throw new Error("必须且只能指定 --local 或 --remote");
	}
	const visitors = readInteger("--visitors");
	const pageviews = readInteger("--pageviews");
	const sql =
		`UPDATE site_counters SET legacy_visitors = ${visitors}, ` +
		`pageviews = ${pageviews} WHERE id = 1;`;
	const result = spawnSync(
		"pnpm",
		[
			"exec",
			"wrangler",
			"d1",
			"execute",
			"BLOG_DB",
			remote ? "--remote" : "--local",
			"--command",
			sql,
		],
		{ stdio: "inherit", shell: false },
	);
	if (result.status !== 0) process.exitCode = result.status ?? 1;
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	console.error(
		"用法：pnpm d1:seed -- --local|--remote --visitors <UV> --pageviews <PV>",
	);
	process.exitCode = 1;
}
