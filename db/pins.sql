-- Message box PINs (D1: diamondspaders-auth). Apply: wr d1 execute diamondspaders-auth --remote --file db/pins.sql
-- One 3-digit PIN per message-box name (case-insensitive). pin_hash = pbkdf2$iter$salt$hash (never plaintext).
CREATE TABLE IF NOT EXISTS msg_pins (
  name TEXT PRIMARY KEY COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
-- Address given on first use (anti-fake-name speed bump). Only a SHA-256 of the normalized address is kept
-- (lowercase, punctuation/extra spaces removed), so names sharing an address can be spotted without storing the text.
ALTER TABLE msg_pins ADD COLUMN addr_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_msg_pins_addr ON msg_pins(addr_hash);
-- 2026-10-09: email replaces street address. SHA-256 of "ds-email:" + lowercased/trimmed email; addr_hash is no longer written.
ALTER TABLE msg_pins ADD COLUMN email_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_msg_pins_email ON msg_pins(email_hash);
