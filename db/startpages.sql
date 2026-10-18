-- Start-page owners (start2 = Judy, start3 = Christina). Applied with: wr d1 execute diamondspaders-auth --remote --file db/startpages.sql
CREATE TABLE IF NOT EXISTS start_layouts (page TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS start_owners (page TEXT PRIMARY KEY, owner TEXT NOT NULL, pw_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS start_sessions (id_hash TEXT PRIMARY KEY, page TEXT NOT NULL, expires INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS start_login_fails (ip TEXT NOT NULL, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS start_login_fails_ip ON start_login_fails (ip, t);
