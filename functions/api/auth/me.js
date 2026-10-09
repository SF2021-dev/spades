import { wrap, json, currentUser, publicUser } from "../../_shared/auth.js";
export const onRequestGet = wrap(async ({ request, env }) => {
  const u = await currentUser(request, env);
  return u ? json({ user: publicUser(u) }) : json({ user: null }, 401);
});
