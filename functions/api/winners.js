// Cloudflare Pages Function: /api/winners
// Fetches recent winners from MyLeague and returns clean JSON.
// No bot required. Called by the page itself when someone visits.

export async function onRequest() {
  try {
    const res = await fetch("https://myleague.com/diamondspaders/tournaments", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DiamondSpaders/1.0)",
        "Accept": "text/html"
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: "Could not reach MyLeague" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const html = await res.text();

    // Very simple extraction — looks for date headers and the winner lines that follow.
    // This is good enough for the current MyLeague layout.
    const winners = [];
    const lines = html.split(/\n|<br\s*\/?>/i);

    let currentDate = null;
    for (const raw of lines) {
      const line = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!line) continue;

      // Date header like "Tuesday November 3, 2026"
      const dateMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\w+\s+\d{1,2},\s+\d{4}/i);
      if (dateMatch) {
        currentDate = dateMatch[0];
        continue;
      }

      // Rough winner line detection (contains a time-like pattern or "vs")
      if (currentDate && (line.includes("vs") || line.match(/\d{1,2}:\d{2}/))) {
        // Try to pull winner names (very basic)
        const nameMatches = line.match(/[A-Z][a-zA-Z0-9_]{2,}/g) || [];
        winners.push({
          date: currentDate,
          text: line,
          names: nameMatches.slice(0, 4)
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      updated: new Date().toISOString(),
      winners: winners.slice(0, 40)   // keep it reasonable
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
