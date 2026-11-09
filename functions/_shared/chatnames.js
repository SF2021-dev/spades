export const ROSTER = ["0UTLAND3R", "1jimbeam", "3Bid3Bags", "aceinblack", "AceyLynn", "AngelJoyXO", "apearl_521", "BigDaddyKool68", "bluangel1950", "bluangel1953", "bob2112", "bonebidder", "booradly", "bustingthatnil", "chameleon3388", "Chanz", "ClassicSpadesPlaR", "CLaSSiKSPaDZPLaR", "COASTALKAT", "DaHwRoOkIe", "deaddly", "DementedWench", "DetroitLionsRule", "DevilsNiteBaby", "diamondslgirl", "Duke413", "Eager_1", "EasyOne23", "EgammeR", "Ellisandrew80", "fetch_it_up", "flipflopgirlsc", "flowerbill2", "ForeverBlessed", "Gift_Shopper", "Gizimo", "Gman88", "goldengirl2026", "GoldenGirl2026", "gooneybird", "Gryzzlybear", "Hardwuudmamia", "Hardwuudmania", "Hotandspicey69", "houdini", "huskernut50265", "illbid13", "Im_already_gone", "JAWS33", "Jays_26", "JBaby1", "jbmusket42", "jopisme", "JustAnotherGirl", "k3ssy", "KeEpDuCkInThEm", "Lewisrulz55", "Lil_shopper", "Loffe_Dawg", "loneranger11452", "Looks__", "Lunatic20ca", "madrat", "maggie_may", "makinpa", "manicdepressive1", "MargoMoo", "Me6052", "MEL1c1ous_1", "MsZigs", "muziklvr", "MyBagsRGucci", "o_siris", "ochwiay", "oooLAURAooo", "PeaKoh", "phoenix_on_fire", "photobratboy09", "Player88141", "PotSayHiToKettle", "PurpleHaven16", "REALLY_WHY", "rookie_bagger", "sadiee", "SILK ROLLZ", "SkippyJJones", "slovell_too", "soloryder", "SOLORYDER", "Sumpin2du", "SunshineGal63", "TATSUJIN", "Treco521", "trifolium", "Tykesbratt", "Untouchable_One", "va_country_guy", "ViCiOuSNaTuRe", "waskelwabbit", "WaverunnerFX", "Wezee", "Whiskey_and_Gold", "whocantplay", "xsuicide_blondex", "ZappyCow"];
// Is this a known Diamond Spaders player? (board PIN, board poster, or has an avatar) -> canonical name or ""
// Board/display names that belong to a different site account
export const ALIAS = { "fetch": "Fetch_it_up" };
export async function known(env, name) {
  const al = ALIAS[String(name).trim().toLowerCase()]; if (al) name = al;
  const p = await env.DB.prepare("SELECT name FROM msg_pins WHERE name = ? COLLATE NOCASE").bind(name).first();
  if (p) return p.name;
  const m = await env.DB.prepare("SELECT name FROM messages WHERE name = ? COLLATE NOCASE LIMIT 1").bind(name).first();
  if (m) return m.name;
  try { const u = await env.DB.prepare("SELECT username FROM users WHERE username = ? COLLATE NOCASE").bind(name).first(); if (u) return u.username; } catch {}
  const lc = String(name).toLowerCase(), hit = ROSTER.find((r) => r.toLowerCase() === lc);
  if (hit) return hit;
  if (env.ASSETS && /^[A-Za-z0-9_. -]{1,40}$/.test(name)) {   // has an avatar on the site (exact spelling)
    try { const r = await env.ASSETS.fetch(new Request("https://x/" + encodeURIComponent(name) + "-ava.png", { method: "HEAD" })); if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) return name; } catch {}
  }
  return "";
}
