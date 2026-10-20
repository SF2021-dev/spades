# /ask: what it can and can't answer yet

Works (any league in leagues.json, last ~60 days, times in ET):
- Who won a tour (by date and time; nearest tour that day if no exact match). Includes team players when the tour's TEAMS page lists them.
- Who ran (TD) a tour, its game type/format, entry, whether it was cancelled.
- How many tours ran in a league on a day or in a date range.
- How many tours a player won (and which) on a day or in a range.
- List of a day's tours and winners.
- When a player last won a tour in a league (searches back up to 60 days).

Not reachable / not supported yet:
- Anything about players who played but did not win (who entered, placings, scores, hands): the calendar feed only has winners. The per-tour TEAMS page has the entrant list, but only one tour is looked up per question.
- "Last time X played" (as opposed to won): needs every tour's entrant list. Too many lookups per question.
- Ladder standings, ratings, Ladderbux balances, player profiles.
- Leagues not in leagues.json (add them there).
- Tour names that exist only on the tour's own page (the feed has the format text, e.g. "2 VS 2").
- More than 60 days back.
- Player wins inside team tours where the feed lists only the team name (counted only when the TEAMS page is checked, which is done for single-tour questions).
