// GET /api/chat/audio/<id> -> audio bytes, only for the sender or recipient (remember-me cookie).
import { wrap, HttpError } from "../../../_shared/auth.js";
import { tokenName } from "../../../_shared/pins.js";
export const onRequestGet = wrap(async ({ request, env, params }) => {
  const my = await tokenName(env, request);
  if (!my) throw new HttpError(401, "Please log in.");
  const r = await env.DB.prepare("SELECT mime, audio FROM chat_msgs WHERE id = ? AND (from_name = ? OR to_name = ? OR to_name IN (SELECT 'g:' || gid FROM chat_group_members WHERE name = ? AND status = 'ok'))").bind(String(params.id), my, my, my).first();
  if (!r || !r.audio) throw new HttpError(404, "Not found");
  return new Response(r.audio, { headers: { "Content-Type": r.mime, "Cache-Control": "private, max-age=86400" } });
});
