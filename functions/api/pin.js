// Message-box PIN: GET /api/pin?name=X -> {name, hasPin}
// POST {name, pin, action:"set"}   -> create PIN (only if the name has none) -> {ok:true}
// POST {name, pin, action:"check"} -> {ok:true} or 401 wrong / 428 no PIN yet / 429 locked
import { wrap, json, readJson, HttpError } from "../_shared/auth.js";
import { normName, pinRow, setPin, checkPin } from "../_shared/pins.js";

export const onRequestGet = wrap(async ({ request, env }) => {
  const name = normName(new URL(request.url).searchParams.get("name"));
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  return json({ name, hasPin: !!(await pinRow(env, name)) });
});

export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const name = normName(b?.name);
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  if (b?.action === "set") { await setPin(env, name, b.pin); return json({ ok: true, created: true }, 201); }
  if (b?.action === "check") { await checkPin(env, name, b.pin); return json({ ok: true }); }
  throw new HttpError(400, "action must be set or check");
});
