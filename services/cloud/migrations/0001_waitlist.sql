CREATE TABLE waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  removal_hash TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1))
);
CREATE INDEX waitlist_retention ON waitlist(created_at);
CREATE TABLE daily_budget (day TEXT PRIMARY KEY, submissions INTEGER NOT NULL);
