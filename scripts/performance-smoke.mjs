import { chromium } from "playwright";

const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:10000";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const limits = {
	entry: Number(process.env.PERF_ENTRY_LIMIT_MS || 2000),
	interaction: Number(process.env.PERF_INTERACTION_LIMIT_MS || 2250),
	navigation: Number(process.env.PERF_NAV_LIMIT_MS || 2500),
	firstPlay: Number(process.env.PERF_PLAY_LIMIT_MS || 2500),
};

const browser = await chromium.launch({
	headless: true,
	...(process.platform === "darwin" ? { executablePath: chromePath } : {}),
});

try {
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();
	const client = await context.newCDPSession(page);

	await client.send("Network.enable");
	await client.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: 100,
		downloadThroughput: 500 * 1024,
		uploadThroughput: 250 * 1024,
		connectionType: "cellular4g",
	});

	if (!process.env.PERF_REAL_MUSIC) {
		// Keep the default check deterministic while still exercising the real
		// MusicManager initialization and the local byte-range audio response.
		await page.route("**/meting/**", async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify([
					{
						title: "Bones",
						author: "Low Roar/Jofridur Akadottir",
						url: "https://music.163.com/song/media/outer/url?id=572328440.mp3",
						pic: "",
						lrc: "",
					},
				]),
			});
		});
	}

	const startedAt = Date.now();
	// The user-facing entry boundary is when the blocking loader is gone, not
	// when every deferred module has finished and DOMContentLoaded fires.
	await page.goto(`${baseUrl}/`, { waitUntil: "commit", timeout: 45_000 });
	const criticalStatePromise = process.env.PERF_TRACE_RESOURCES
		? page.waitForTimeout(800).then(() =>
			page.evaluate(() => ({
				fonts: document.fonts?.status,
				pendingImages: Array.from(document.images)
					.filter((image) => image.loading !== "lazy" && !image.complete)
					.map((image) => image.currentSrc || image.src),
			})),
		)
		: Promise.resolve(undefined);
	await page.waitForFunction(
		() => {
			const loader = document.querySelector("#page-loader");
			return loader && (loader.hidden || getComputedStyle(loader).visibility === "hidden");
		},
		null,
		{ timeout: 45_000 },
	);
	const entryMs = Date.now() - startedAt;
	const criticalStateAt800Ms = await criticalStatePromise;

	const drawerOpened = async () =>
		page.evaluate(() => {
			const drawer = document.querySelector("#dock-drawer-music");
			return Boolean(drawer && !drawer.classList.contains("dock-drawer-closed"));
		});
	const interactionDeadline = Date.now() + 20_000;
	while (!(await drawerOpened()) && Date.now() < interactionDeadline) {
		await page
			.getByRole("button", { name: "音乐", exact: true })
			.click({ timeout: 1_500 })
			.catch(() => undefined);
		if (!(await drawerOpened())) await page.waitForTimeout(250);
	}
	if (!(await drawerOpened())) throw new Error("Music drawer did not become interactive");
	const interactionMs = Date.now() - startedAt;
	const eagerBelowFoldMedia = await page.evaluate(() =>
		performance
			.getEntriesByType("resource")
			.map((entry) => entry.name)
			.filter((name) =>
				/\/assets\/images\/(?:home-truncated\/(?:[1-5]|td|utl-back[12]|utl-1)|home\/home-data-[1-4])\.(?:webp|webm)/.test(
					name,
				),
			),
	);
	const loaderImageSource = await page
		.locator("#page-loader img")
		.getAttribute("src");
	const heroImageSource = await page
		.locator(".home-hero__video")
		.evaluate((image) => new URL(image.currentSrc).pathname);
	const initialResources = process.env.PERF_TRACE_RESOURCES
		? await page.evaluate(() =>
			performance
				.getEntriesByType("resource")
				.map((entry) => ({
					name: new URL(entry.name).pathname,
					durationMs: Math.round(entry.duration),
					transferBytes: entry.transferSize,
				}))
				.sort((left, right) => right.durationMs - left.durationMs)
				.slice(0, 25),
		)
		: undefined;

	const audio = page.locator("#firefly-music-audio");
	await audio.waitFor({ state: "attached", timeout: 8_000 });
	await page.getByRole("button", { name: "播放", exact: true }).waitFor({
		state: "visible",
		timeout: 12_000,
	});
	const firstPlayStartedAt = Date.now();
	const playOutcome = await page.evaluate(async () => {
		const element = document.querySelector("#firefly-music-audio");
		const button = Array.from(document.querySelectorAll("button")).find(
			(candidate) => candidate.getAttribute("aria-label") === "播放",
		);
		if (!(element instanceof HTMLAudioElement) || !(button instanceof HTMLButtonElement)) {
			return "missing";
		}
		const outcome = new Promise((resolve) => {
			if (!element.paused && element.readyState >= 3) return resolve("playing");
			element.addEventListener("playing", () => resolve("playing"), { once: true });
			element.addEventListener("error", () => resolve("error"), { once: true });
			setTimeout(() => resolve("timeout"), 12_000);
		});
		button.click();
		return outcome;
	});
	const firstPlayMs = Date.now() - firstPlayStartedAt;

	const navigationStartedAt = Date.now();
	await page.getByRole("link", { name: "工具导航", exact: true }).click();
	await page.waitForURL("**/collections/", { timeout: 20_000 });
	const navigationMs = Date.now() - navigationStartedAt;

	// Confirm the deferred showcase still starts loading when the user reaches it.
	await page.goto(`${baseUrl}/`, { waitUntil: "commit", timeout: 45_000 });
	await page.locator("#home-display-layer").scrollIntoViewIfNeeded({ timeout: 20_000 });
	const lazyDisplayActivated = await page
		.waitForFunction(
			() =>
				Boolean(
					document
						.querySelector("[data-shutter-final-video]")
						?.getAttribute("src"),
				),
			null,
			{ timeout: 5_000 },
		)
		.then(() => true)
		.catch(() => false);

	const metrics = {
		network: "4Mbps/100ms",
		entryMs,
		interactionMs,
		eagerBelowFoldMedia,
		loaderImageSource,
		heroImageSource,
		...(initialResources ? { initialResources } : {}),
		...(criticalStateAt800Ms ? { criticalStateAt800Ms } : {}),
		firstPlayMs,
		playOutcome,
		navigationMs,
		lazyDisplayActivated,
		limits,
	};
	const failures = [
		entryMs > limits.entry && `entry ${entryMs}ms > ${limits.entry}ms`,
		interactionMs > limits.interaction &&
			`interaction ${interactionMs}ms > ${limits.interaction}ms`,
		eagerBelowFoldMedia.length > 0 &&
			`below-fold media loaded eagerly: ${eagerBelowFoldMedia.join(", ")}`,
		loaderImageSource?.endsWith("/feibi-loading.webp") &&
			"full animated loader is still on the critical path",
		heroImageSource.endsWith("/home.webp") &&
			"full-resolution hero image is still served to a 1280px viewport",
		(firstPlayMs > limits.firstPlay || playOutcome !== "playing") &&
			`first play ${firstPlayMs}ms (${playOutcome}) > ${limits.firstPlay}ms`,
		navigationMs > limits.navigation &&
			`navigation ${navigationMs}ms > ${limits.navigation}ms`,
		!lazyDisplayActivated && "deferred display media did not activate near its section",
	].filter(Boolean);

	console.log(JSON.stringify({ ...metrics, verdict: failures.length ? "FAIL" : "PASS", failures }, null, 2));
	if (failures.length) process.exitCode = 1;
} finally {
	await browser.close();
}
