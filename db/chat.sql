-- D1: diamondspaders-auth. Apply: wr d1 execute diamondspaders-auth --remote --file db/chat.sql
-- Private chat (/chat): permission requests + messages (text, tts, audio clips, live mic segments)
CREATE TABLE IF NOT EXISTS chat_perms (from_name TEXT NOT NULL COLLATE NOCASE, to_name TEXT NOT NULL COLLATE NOCASE, status TEXT NOT NULL DEFAULT 'pending', t INTEGER NOT NULL, PRIMARY KEY (from_name, to_name));
CREATE TABLE IF NOT EXISTS chat_msgs (id TEXT PRIMARY KEY, from_name TEXT NOT NULL COLLATE NOCASE, to_name TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, body TEXT, mime TEXT, audio BLOB, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_msgs_pair ON chat_msgs (to_name, from_name, t);
