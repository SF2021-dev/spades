// Shared helpers for /api/videos* (metadata in D1 "DB"; file bytes in R2 "VIDEOS" when bound).
import { currentUser, HttpError, randomToken } from "./auth.js";
import { known } from "./chatnames.js";

export const OWNER_NAME = "ochwiay";
export const MAX_BYTES = 100 * 1024 * 1024;
export const TITLE_MAX = 200;
export const ALLOWED_EXT = ["mp4", "webm", "mov", "m4v"];
export const ALLOWED_MIME = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/m4v": "m4v",
};

export function isOwnerName(name) {
  return String(name || "").toLowerCase() === OWNER_NAME;
}

export async function posterName(env, request) {
  const u = await currentUser(request, env);
  if (!u || !u.username) throw new HttpError(401, "Please sign in.");
  const n = (await known(env, u.username)) || u.username;
  return { user: u, name: n, owner: isOwnerName(u.username) };
}

let ready = false;
export async function init(env) {
  if (ready) return;
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL, title TEXT, kind TEXT NOT NULL, src TEXT NOT NULL, mime TEXT, bytes INTEGER, created_at INTEGER NOT NULL)"
  ).run();
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS videos_created ON videos (created_at DESC)").run(); } catch {}
  ready = true;
}

export function uploadsEnabled(env) {
  return !!(env.VIDEOS && typeof env.VIDEOS.put === "function");
}

export function cleanTitle(s) {
  s = String(s || "").replace(/\s+/g, " ").trim();
  if (s.length > TITLE_MAX) throw new HttpError(400, "Title is too long (max 200 characters).");
  return s;
}

export async function checkRate(env, userId) {
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM videos WHERE user_id = ? AND created_at > ?"
  ).bind(userId, Date.now() - 3600e3).first();
  if (recent && recent.n >= 10) throw new HttpError(429, "Please wait a bit before sharing more videos.");
}

export function parseShareUrl(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new HttpError(400, "Paste a YouTube, Vimeo, or direct video link.");
  if (text.length > 500) throw new HttpError(400, "That link is too long.");
  let u;
  try { u = new URL(text); } catch { throw new HttpError(400, "That doesn't look like a valid link."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new HttpError(400, "Use an https:// or http:// link.");
  if (u.username || u.password) throw new HttpError(400, "That link isn't allowed.");
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  let id;
  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if (u.searchParams.get("v")) id = u.searchParams.get("v");
    else {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") id = parts[1] || "";
    }
    id = String(id || "").split("?")[0].split("&")[0];
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new HttpError(400, "Couldn't find a YouTube video in that link.");
    return { kind: "youtube", src: id };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "video") id = parts[1];
    else if (["channels", "groups", "album", "showcase"].includes(parts[0])) id = parts[2];
    else id = parts[0];
    if (!id || !/^\d{6,12}$/.test(id)) throw new HttpError(400, "Couldn't find a Vimeo video in that link.");
    return { kind: "vimeo", src: id };
  }

  const ext = (u.pathname.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
  if (!ALLOWED_EXT.includes(ext)) throw new HttpError(400, "Paste a YouTube, Vimeo, or direct video link (mp4, webm, or mov).");
  return { kind: "url", src: u.href };
}

export function looksLikeVideo(buf, ext) {
  if (!buf || buf.length < 12) return false;
  if (ext === "webm") return buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3;
  // mp4 / mov / m4v: "ftyp" at offset 4
  return buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
}

export function mimeForExt(ext, given) {
  const g = String(given || "").toLowerCase();
  if (ALLOWED_MIME[g]) return g;
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
}

export async function avatarFor(env, name) {
  const fallback = "/" + encodeURIComponent(name) + "-ava.png";
  try {
    const r = await env.ASSETS.fetch(new Request("https://asset.local/live/config.json"));
    if (!r.ok) return fallback;
    const cfg = await r.json();
    const lc = String(name).toLowerCase();
    if (cfg.avatar_overrides) {
      for (const [k, v] of Object.entries(cfg.avatar_overrides)) {
        if (String(k).toLowerCase() === lc && v) return String(v);
      }
    }
    if (cfg.avatars && cfg.avatars[lc]) return String(cfg.avatars[lc]);
  } catch {}
  return fallback;
}

export async function publicRow(env, row, me, owner) {
  const canDelete = !!(owner || (me && String(row.username).toLowerCase() === String(me).toLowerCase()));
  return {
    id: row.id,
    username: row.username,
    title: row.title || "",
    kind: row.kind,
    src: row.src,
    mime: row.mime || "",
    bytes: row.bytes || 0,
    created_at: row.created_at,
    ava: await avatarFor(env, row.username),
    canDelete,
    file: row.kind === "file" ? "/api/videos/file/" + row.id : "",
  };
}

export { randomToken, HttpError };
