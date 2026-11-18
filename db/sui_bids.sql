-- SUI PASS 2 "what's my bid?" answers (D1: diamondspaders-auth).
-- Created automatically by /api/sui-bids on first use; this file is the schema reference.
CREATE TABLE IF NOT EXISTS sui_pass2_bids (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  user_id INTEGER,
  answers TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
