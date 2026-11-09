import { wrap, readJson, json, normEmail, sendConfirmation } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const u = await env.DB.prepare("SELECT id, email, username, verified_at FROM users WHERE email = ?").bind(normEmail(b.email)).first();
  if (u && !u.verified_at) await sendConfirmation(env, request, u);
  return json({ ok: true, message: "If that account needs confirming, a new link is on its way." });
});
