-- The Five-Minute Win — D1 schema v1
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS missions (
  id INTEGER PRIMARY KEY,          -- day number (1..7 at launch, grows daily)
  domain TEXT NOT NULL,            -- Words / Money / Time / Work / Home / Paperwork / Fun
  title TEXT NOT NULL,
  skill TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  win_message TEXT NOT NULL,
  note TEXT,                       -- optional banner note (e.g., Day 6 disclaimer)
  publish_date TEXT                -- ISO date; NULL = not yet scheduled
);

CREATE TABLE IF NOT EXISTS mission_content (
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  persona TEXT NOT NULL,           -- shop | parent | office | job | retiree
  story_title TEXT NOT NULL,
  story TEXT NOT NULL,
  prompt TEXT NOT NULL,
  why TEXT NOT NULL,
  PRIMARY KEY (mission_id, persona)
);

CREATE TABLE IF NOT EXISTS challenge_rounds (
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  round INTEGER NOT NULL,          -- 1..4
  task TEXT NOT NULL,
  prompt_a TEXT NOT NULL,
  prompt_b TEXT NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('a','b')),
  verdict TEXT NOT NULL,
  PRIMARY KEY (mission_id, round)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,             -- uuid
  email TEXT UNIQUE NOT NULL,
  persona TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  streak INTEGER NOT NULL DEFAULT 0,
  last_win_date TEXT
);

CREATE TABLE IF NOT EXISTS wins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  reflection TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  position INTEGER
);

CREATE TABLE IF NOT EXISTS gen_usage (            -- daily in-page generation cap
  visitor_key TEXT NOT NULL,       -- hashed IP or user id
  day TEXT NOT NULL,               -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_key, day)
);

CREATE TABLE IF NOT EXISTS events (               -- lightweight analytics
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- visit | mission_view | generate | win | challenge_done | signup | waitlist
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  license_hash TEXT PRIMARY KEY,   -- SHA-256 of license key; raw key never stored
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  activated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
