-- Diamond Spaders message box (D1: diamondspaders-auth). Apply: wr d1 execute diamondspaders-auth --remote --file db/messages.sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_t ON messages(t);
