# /ask: what it can and can't answer yet

Works (any league in leagues.json, last ~60 days, times in ET):
- Who won a tour (by date and time; nearest tour that day if no exact match). Includes team players when the tour's TEAMS page lists them.
- Who ran (TD) a tour, its game type/format, entry, whether it was cancelled.
- How many tours ran in a league on a day or in a date range.
- How many tours a player won (and which) on a day or in a range.
- List of a day's tours and winners.
- How many tours a player played (entered), with 1st/2nd/3rd counts, bux won and last entry, all time or for a date range. Source: the league's public Ladderbux log on cgi6.igl.net (full history for that league; Ochwiay's starts Jun 20, 2026).
- When a player last won a tour in a league (searches back up to 60 days).

Not reachable / not supported yet:
- "I"/"me" questions: the page can't know who is asking; name the player.
- Played-tour dates/times are when the entry was made (Ladderbux log), not the tour's start; the log has no partner names. Tours entered for free (no entry fee) would not be counted.
- Anything about players who played but did not win (who entered, placings, scores, hands): the calendar feed only has winners. The per-tour TEAMS page has the entrant list, but only one tour is looked up per question.
- Ladder standings, ratings, Ladderbux balances, player profiles.
- Leagues not in leagues.json (add them there).
- Tour names that exist only on the tour's own page (the feed has the format text, e.g. "2 VS 2").
- More than 60 days back.
- Player wins inside team tours where the feed lists only the team name (counted only when the TEAMS page is checked, which is done for single-tour questions).
