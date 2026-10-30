-- D1: diamondspaders-auth. Apply: wr d1 execute diamondspaders-auth --remote --file db/chat.sql
-- Private chat (/chat): permission requests + messages (text, tts, audio clips, live mic segments)
CREATE TABLE IF NOT EXISTS chat_perms (from_name TEXT NOT NULL COLLATE NOCASE, to_name TEXT NOT NULL COLLATE NOCASE, status TEXT NOT NULL DEFAULT 'pending', t INTEGER NOT NULL, PRIMARY KEY (from_name, to_name));
CREATE TABLE IF NOT EXISTS chat_msgs (id TEXT PRIMARY KEY, from_name TEXT NOT NULL COLLATE NOCASE, to_name TEXT NOT NULL COLLATE NOCASE, kind TEXT NOT NULL, body TEXT, mime TEXT, audio BLOB, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_msgs_pair ON chat_msgs (to_name, from_name, t);
-- Group chat (/group-chat): group messages use chat_msgs with to_name = 'g:<gid>'
CREATE TABLE IF NOT EXISTS chat_groups (gid TEXT PRIMARY KEY, owner TEXT NOT NULL COLLATE NOCASE, t INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chat_group_members (gid TEXT NOT NULL, name TEXT NOT NULL COLLATE NOCASE, status TEXT NOT NULL DEFAULT 'pending', t INTEGER NOT NULL, PRIMARY KEY (gid, name));
-- Buzz (/chat): short-lived attention pings, deleted when delivered or after 60s
CREATE TABLE IF NOT EXISTS chat_buzz (from_name TEXT NOT NULL COLLATE NOCASE, to_name TEXT NOT NULL COLLATE NOCASE, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS chat_buzz_to ON chat_buzz (to_name, t);
