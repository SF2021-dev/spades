-- Extra bytes for big message images (GIFs > 1 MB). msg_images.data holds the first chunk; the rest live here (D1 rows max ~2 MB).
-- Apply: wr d1 execute diamondspaders-auth --remote --file db/image_chunks.sql
CREATE TABLE IF NOT EXISTS msg_image_chunks (id TEXT NOT NULL, seq INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (id, seq));
