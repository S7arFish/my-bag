CREATE TABLE IF NOT EXISTS visitors (
	visitor_id TEXT PRIMARY KEY,
	first_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_counters (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	legacy_visitors INTEGER NOT NULL DEFAULT 0 CHECK (legacy_visitors >= 0),
	pageviews INTEGER NOT NULL DEFAULT 0 CHECK (pageviews >= 0)
);

INSERT OR IGNORE INTO site_counters (id, legacy_visitors, pageviews)
VALUES (1, 0, 0);
