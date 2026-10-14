-- Message-box images (D1: diamondspaders-auth). Apply: wr d1 execute diamondspaders-auth --remote --file db/images.sql
-- R2 isn't enabled on this account, so images live in D1 as BLOBs, capped at 400 KB each (client sends ~<300 KB).
CREATE TABLE IF NOT EXISTS msg_images (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_images_name_t ON msg_images(name, t);
CREATE INDEX IF NOT EXISTS idx_msg_images_t ON msg_images(t);
