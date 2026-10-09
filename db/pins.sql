-- Message box PINs (D1: diamondspaders-auth). Apply: wr d1 execute diamondspaders-auth --remote --file db/pins.sql
-- One 3-digit PIN per message-box name (case-insensitive). pin_hash = pbkdf2$iter$salt$hash (never plaintext).
CREATE TABLE IF NOT EXISTS msg_pins (
  name TEXT PRIMARY KEY COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
