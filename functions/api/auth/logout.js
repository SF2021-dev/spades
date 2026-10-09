import { wrap, json, destroySession, cookie } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  await destroySession(request, env);
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
});
