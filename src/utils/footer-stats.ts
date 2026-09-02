const DAY_MS = 86_400_000;

function parseDateOnly(value: string): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return Date.UTC(year, month - 1, day);
}

function dateOnlyInTimeZone(now: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	return `${values.year}-${values.month}-${values.day}`;
}

function calendarDifference(date: string, now: Date, timeZone: string): number {
	const start = parseDateOnly(date);
	const today = parseDateOnly(dateOnlyInTimeZone(now, timeZone));
	if (start === null || today === null) return 0;
	return Math.max(0, Math.floor((today - start) / DAY_MS));
}

export function calculateRunningDays(
	startDate: string,
	now = new Date(),
	timeZone = "Asia/Shanghai",
): number {
	return calendarDifference(startDate, now, timeZone) + 1;
}

export function calculateDaysSinceUpdate(
	lastUpdateDate: string,
	now = new Date(),
	timeZone = "Asia/Shanghai",
): number {
	return calendarDifference(lastUpdateDate, now, timeZone);
}
