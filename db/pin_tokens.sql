-- Message box "remember me" tokens (D1: diamondspaders-auth). Apply: wr d1 execute diamondspaders-auth --remote --file db/pin_tokens.sql
-- A verified PIN entry with "remember me" checked issues a random token, sent back only as an HttpOnly cookie (ds_pin_token,
-- 30 days). Only SHA-256("ds-pin-token:" + token) is stored here, never the token or the PIN. Deleting a name's msg_pins row
-- (PIN reset) also invalidates its tokens (lookups join msg_pins). Forget everyone: DELETE FROM msg_pin_tokens;
CREATE TABLE IF NOT EXISTS msg_pin_tokens (
  token_hash TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  expires INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_pin_tokens_name ON msg_pin_tokens(name);
