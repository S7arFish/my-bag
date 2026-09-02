import { normalizeFriendKey } from "./core.mjs";

const ALERT_THRESHOLD = 3;

function isFailure(check) {
	return check.reachable !== true || check.backlink !== true;
}

export function createStatusDocument({ friends, checks, previous, now }) {
	if (friends.length !== checks.length) {
		throw new Error("友链列表与巡检结果数量不一致");
	}
	const entries = {};
	const events = [];

	for (let index = 0; index < friends.length; index += 1) {
		const friend = friends[index];
		const check = checks[index];
		const key = normalizeFriendKey(friend.siteurl);
		const previousEntry = previous?.friends?.[key];
		const previousFailures = Number(previousEntry?.consecutiveFailures) || 0;
		const failure = isFailure(check);
		const consecutiveFailures = failure ? previousFailures + 1 : 0;

		entries[key] = {
			reachable: check.reachable === true,
			statusCode: Number.isInteger(check.statusCode) ? check.statusCode : null,
			latencyMs: Math.max(0, Math.round(Number(check.latencyMs) || 0)),
			backlink: check.backlink === true,
			checkedAt: now,
			consecutiveFailures,
		};

		if (consecutiveFailures === ALERT_THRESHOLD) {
			events.push({
				type: "alert",
				title: friend.title,
				siteUrl: friend.siteurl,
			});
		} else if (!failure && previousFailures >= ALERT_THRESHOLD) {
			events.push({
				type: "recovered",
				title: friend.title,
				siteUrl: friend.siteurl,
			});
		}
	}

	return {
		document: { generatedAt: now, friends: entries },
		events,
	};
}
