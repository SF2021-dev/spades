// /api/sui-bids — save and review SUI PASS 2 "what's my bid?" answers.
// Players may read/write only their own submission. The site owner (Ochwiay) can list and delete all.
import { wrap, json, currentUser, publicUser, readJson, HttpError } from "../_shared/auth.js";

const OWNER = "ochwiay";
const BIDS = new Set(["Nil", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"]);

function isOwner(u) {
  return !!(u && String(u.username || "").toLowerCase() === OWNER);
}

async function requireUser(request, env) {
  const u = await currentUser(request, env);
  if (!u) throw new HttpError(401, "Registration required");
  return u;
}

async function init(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS sui_pass2_bids (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      user_id INTEGER,
      answers TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ).run();
}

function parseRow(row) {
  let answers = [];
  try { answers = JSON.parse(row.answers); } catch (e) { answers = []; }
  return {
    username: row.username,
    answers,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validCard(s) {
  return typeof s === "string" && /^([AKQJ]|10|[2-9])[♠♥♦♣]$/.test(s);
}

function validateAnswers(raw) {
  if (!Array.isArray(raw) || raw.length !== 10) throw new HttpError(400, "Please complete all ten examples.");
  return raw.map((a, i) => {
    const bid = a && a.bid != null ? String(a.bid) : "";
    if (!BIDS.has(bid)) throw new HttpError(400, "Each example needs a bid (1–13) or Nil.");
    const pass = a && Array.isArray(a.pass) ? a.pass.map(String) : [];
    const passIdx = a && Array.isArray(a.passIdx) ? a.passIdx.map((n) => Number(n)) : [];
    if (pass.length !== 2 || passIdx.length !== 2) throw new HttpError(400, "Each example needs exactly two pass cards.");
    if (passIdx[0] === passIdx[1] || passIdx.some((n) => !Number.isInteger(n) || n < 0 || n > 12)) {
      throw new HttpError(400, "Pass cards must be two different cards in the hand.");
    }
    if (!pass.every(validCard)) throw new HttpError(400, "Pass cards were not recognized.");
    return { hand: i + 1, bid, pass, passIdx };
  });
}

function wantReview(url) {
  const q = url.searchParams;
  return q.get("review") === "1" || q.get("all") === "1";
}

export const onRequestGet = wrap(async ({ request, env }) => {
  const u = await requireUser(request, env);
  await init(env.DB);
  const url = new URL(request.url);
  if (wantReview(url)) {
    if (!isOwner(u)) throw new HttpError(403, "Owner only");
    const rows = (await env.DB.prepare(
      "SELECT username, answers, created_at, updated_at FROM sui_pass2_bids ORDER BY updated_at DESC"
    ).all()).results || [];
    return json({ ok: true, review: true, user: publicUser(u), submissions: rows.map(parseRow) });
  }
  const row = await env.DB.prepare(
    "SELECT username, answers, created_at, updated_at FROM sui_pass2_bids WHERE username = ? COLLATE NOCASE"
  ).bind(u.username).first();
  return json({ ok: true, user: publicUser(u), owner: isOwner(u), submission: row ? parseRow(row) : null });
});

export const onRequestPost = wrap(async ({ request, env }) => {
  const u = await requireUser(request, env);
  const b = await readJson(request);
  const answers = validateAnswers(b && b.answers);
  await init(env.DB);
  const now = Date.now();
  const existing = await env.DB.prepare(
    "SELECT created_at FROM sui_pass2_bids WHERE username = ? COLLATE NOCASE"
  ).bind(u.username).first();
  await env.DB.prepare(
    `INSERT INTO sui_pass2_bids (username, user_id, answers, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       answers = excluded.answers,
       user_id = excluded.user_id,
       updated_at = excluded.updated_at`
  ).bind(u.username, u.id, JSON.stringify(answers), existing ? existing.created_at : now, now).run();
  return json({ ok: true, saved: true, username: u.username, created_at: existing ? existing.created_at : now, updated_at: now });
});

export const onRequestDelete = wrap(async ({ request, env }) => {
  const u = await requireUser(request, env);
  if (!isOwner(u)) throw new HttpError(403, "Owner only");
  await init(env.DB);
  const url = new URL(request.url);
  let name = (url.searchParams.get("name") || "").trim();
  if (!name) {
    try {
      const b = await readJson(request);
      name = String((b && b.name) || "").trim();
    } catch (e) {
      name = "";
    }
  }
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  const row = await env.DB.prepare(
    "SELECT username FROM sui_pass2_bids WHERE username = ? COLLATE NOCASE"
  ).bind(name).first();
  if (!row) throw new HttpError(404, "No submission for that name.");
  await env.DB.prepare("DELETE FROM sui_pass2_bids WHERE username = ? COLLATE NOCASE").bind(name).run();
  return json({ ok: true, deleted: row.username });
});
