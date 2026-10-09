import { consumeToken, createSession } from "../../_shared/auth.js";
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const userId = env.DB ? await consumeToken(env, url.searchParams.get("token")) : null;
  if (!userId) return Response.redirect(`${url.origin}/register?confirm=invalid`, 302);
  return new Response(null, { status: 302, headers: { Location: "/register?confirmed=1", "Set-Cookie": await createSession(env, userId), "Cache-Control": "no-store" } });
}
