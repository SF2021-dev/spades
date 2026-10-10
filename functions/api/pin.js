// Message-box PIN: GET /api/pin?name=X -> {name, hasPin, remembered}
// POST {name, pin, email, action:"set", remember?} -> create PIN + email (hashed) (only if the name has none) -> {ok:true}
// POST {name, pin, action:"check", remember?} -> {ok:true} or 401 wrong / 428 no PIN yet / 429 locked
//   remember:true also sets a 30-day HttpOnly cookie (ds_pin_token) so the PIN isn't asked again on this browser -> {remembered:true, expires}
// POST {action:"forget"} -> drops this browser's remember-me token.
import { wrap, json, readJson, HttpError } from "../_shared/auth.js";
import { normName, pinRow, setPin, checkPin, issueToken, tokenName, forgetToken } from "../_shared/pins.js";

export const onRequestGet = wrap(async ({ request, env }) => {
  const name = normName(new URL(request.url).searchParams.get("name"));
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  const row = await pinRow(env, name);
  const tn = row ? await tokenName(env, request) : "";
  return json({ name, hasPin: !!row, remembered: !!tn && tn.toLowerCase() === row.name.toLowerCase() });
});

export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  if (b?.action === "forget") return json({ ok: true }, 200, { "Set-Cookie": await forgetToken(env, request) });
  const name = normName(b?.name);
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  let canon, status = 200;
  if (b?.action === "set") { await setPin(env, name, b.pin, b.email); canon = (await pinRow(env, name)).name; status = 201; }
  else if (b?.action === "check") canon = await checkPin(env, name, b.pin);
  else throw new HttpError(400, "action must be set, check or forget");
  if (b.remember === true) {
    const t = await issueToken(env, request, canon);
    return json({ ok: true, created: status === 201, remembered: true, expires: t.expires }, status, { "Set-Cookie": t.cookie });
  }
  return json({ ok: true, created: status === 201 }, status);
});
