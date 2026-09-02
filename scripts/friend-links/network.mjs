import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import { normalizeSiteUrl } from "./core.mjs";

const DEFAULT_USER_AGENT =
	"Mozilla/5.0 (compatible; MiNiFeiFei-FriendLinkChecker/1.0; +https://lolicon.meme/friends/)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isPrivateIpv4(address) {
	const octets = address.split(".").map(Number);
	if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) {
		return true;
	}
	const [a, b] = octets;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0) ||
		(a === 192 && b === 168) ||
		(a === 198 && (b === 18 || b === 19)) ||
		(a === 198 && b === 51) ||
		(a === 203 && b === 0)
	);
}

function isPrivateIpv6(address) {
	const normalized = address.toLowerCase().split("%")[0];
	if (normalized === "::" || normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) {
		const mapped = normalized.slice("::ffff:".length);
		return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
	}
	return (
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		/^fe[89ab]/.test(normalized) ||
		normalized.startsWith("ff") ||
		normalized.startsWith("2001:db8:")
	);
}

export function isPublicIpAddress(address) {
	const family = isIP(address);
	if (family === 4) return !isPrivateIpv4(address);
	if (family === 6) return !isPrivateIpv6(address);
	return false;
}

async function defaultLookup(hostname) {
	return dnsLookup(hostname, { all: true, verbatim: true });
}

async function resolvePublicAddresses(url, lookup) {
	const addresses = await lookup(url.hostname);
	if (!Array.isArray(addresses) || addresses.length === 0) {
		throw new Error(`无法解析友链主机：${url.hostname}`);
	}
	for (const entry of addresses) {
		if (!entry || !isPublicIpAddress(entry.address)) {
			throw new Error(
				`友链主机解析到了非公网地址：${entry?.address ?? "unknown"}`,
			);
		}
	}
	return addresses;
}

export async function assertPublicUrl(input, dependencies = {}) {
	const url = new URL(normalizeSiteUrl(input));
	await resolvePublicAddresses(url, dependencies.lookup ?? defaultLookup);
	return url.toString();
}

function decodeBody(buffer, contentEncoding, maximumBytes) {
	const encoding = String(contentEncoding ?? "").toLowerCase();
	if (encoding === "gzip") {
		return gunzipSync(buffer, { maxOutputLength: maximumBytes }).toString(
			"utf8",
		);
	}
	if (encoding === "br") {
		return brotliDecompressSync(buffer, {
			maxOutputLength: maximumBytes,
		}).toString("utf8");
	}
	if (encoding === "deflate") {
		return inflateSync(buffer, { maxOutputLength: maximumBytes }).toString(
			"utf8",
		);
	}
	return buffer.toString("utf8");
}

function requestPinnedAddress(url, address, options) {
	const client = url.protocol === "https:" ? https : http;
	return new Promise((resolve, reject) => {
		const request = client.request(
			{
				protocol: url.protocol,
				hostname: address.address,
				family: address.family,
				port: url.port || undefined,
				path: `${url.pathname}${url.search}`,
				method: "GET",
				servername: url.hostname,
				headers: {
					Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
					"Accept-Encoding": "gzip, deflate, br",
					Host: url.host,
					"User-Agent": options.userAgent,
				},
			},
			(response) => {
				const chunks = [];
				let received = 0;
				response.on("data", (chunk) => {
					received += chunk.length;
					if (received > options.maximumBytes) {
						response.destroy(new Error("友链页面超过允许的响应大小"));
						return;
					}
					chunks.push(chunk);
				});
				response.on("end", () => {
					try {
						const body = decodeBody(
							Buffer.concat(chunks),
							response.headers["content-encoding"],
							options.maximumBytes,
						);
						resolve({
							statusCode: response.statusCode ?? 0,
							headers: response.headers,
							body,
						});
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		request.setTimeout(options.timeoutMs, () => {
			request.destroy(new Error("友链页面请求超时"));
		});
		request.on("error", reject);
		request.end();
	});
}

async function defaultRequest(url, addresses, options) {
	let lastError;
	for (const address of addresses) {
		try {
			return await requestPinnedAddress(url, address, options);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error("友链页面无法连接");
}

export async function fetchPublicPage(input, dependencies = {}) {
	const lookup = dependencies.lookup ?? defaultLookup;
	const request = dependencies.request ?? defaultRequest;
	const maximumRedirects = dependencies.maximumRedirects ?? 5;
	const options = {
		timeoutMs: dependencies.timeoutMs ?? 12_000,
		maximumBytes: dependencies.maximumBytes ?? 2 * 1024 * 1024,
		userAgent: dependencies.userAgent ?? DEFAULT_USER_AGENT,
	};
	let currentUrl = new URL(normalizeSiteUrl(input));

	for (
		let redirectCount = 0;
		redirectCount <= maximumRedirects;
		redirectCount += 1
	) {
		const addresses = await resolvePublicAddresses(currentUrl, lookup);
		const response = await request(currentUrl, addresses, options);
		const location = Array.isArray(response.headers?.location)
			? response.headers.location[0]
			: response.headers?.location;
		if (REDIRECT_STATUSES.has(response.statusCode) && location) {
			if (redirectCount === maximumRedirects) {
				throw new Error("友链页面重定向次数过多");
			}
			currentUrl = new URL(
				normalizeSiteUrl(new URL(location, currentUrl).toString()),
			);
			continue;
		}
		return {
			...response,
			url: currentUrl.toString(),
		};
	}
	throw new Error("友链页面重定向次数过多");
}
