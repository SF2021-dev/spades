# /ask: what it can and can't answer yet

Works (any league in leagues.json, last ~60 days, times in ET):
- Who won a tour (by date and time; nearest tour that day if no exact match). Includes team players when the tour's TEAMS page lists them.
- Who ran (TD) a tour, its game type/format, entry, whether it was cancelled.
- How many tours ran in a league on a day or in a date range.
- How many tours a player won (and which) on a day or in a range.
- List of a day's tours and winners.
- How many tours a player played (entered), with 1st/2nd/3rd counts, bux won and last entry, all time or for a date range. Any player-history question with no period (including "when did X last play") searches the player's entire log, not 60 days. Source: the league's public Ladderbux log (cgi6.igl.net, or plus2.igl.net for MyLeague Plus leagues such as AMS and Just4Fun) (full history for that league; Ochwiay's starts Jun 20, 2026).
- Tours-played questions that say any/all/every league, or name no league, search every league in leagues.json and answer per league (leagues with none are named). Naming a league searches only that league.
- When a player last won a tour in a league (searches back up to 60 days).

- Which tours a player played in a period (today, yesterday, this/last week, a date, up to 31 days): "what tours did X play today", "how many tours did X play this week", "did X win any tours". Lists each tour with start time (ET), board label, TD and result (won / 2nd / 3rd / played), plus the partner and team name in partner tours, across every league unless one is named. Source: the player's Ladderbux log (which tours charged an entry fee, and placing) joined to the league calendar by tour id, and the tour's TEAMS page for partners and not-yet-finished registrations. Aliases in leagues.json are honored.
- Who played in a tour: "who played in the 6:15" (a start time, today unless a date is given): the entrant list from the tour's TEAMS page, with teams for partner tours and the winner.
- Leaderboard (no player name needed): "who won the most CUT tours at Diamond Spaders in October", "most wins", "top 5 winners", "who hosted the most", optionally filtered by game type (board labels such as CUT, SINGLES, SUI PASS 2, REG PARTNERS; case-insensitive) or TD/host. Default league is Diamond Spaders. Periods: month names (most recent such month), "this week", "last month" (the previous calendar month), "today", "yesterday", and date ranges. The answer names the leader (or a tie), the win count, and a top-5 list (ties at the cutoff are included). Partner tours credit each winner; cancelled/hidden tours are excluded. Game-type matching is exact on the board label ("CUT" is not "CUT MIRRORS"). When MyLeague's calendar no longer lists older days, Diamond Spaders days are filled from published daily reports when those exist.
- Who played the most tours on a single day, when that day's daily report is available (all game types together). A month-long "who played the most" is not available.
- A player's success rate by game variation (board labels such as CUT, SINGLES, REG PARTNERS, SUI PASS 2, LOSER WINS, CUT MIRRORS): tours played, wins, and win %, sorted by win %. "I"/"me"/"my" is treated as Ochwiay; a named player also works. Periods: today, this/last week, this/last month, a month name (October, November), last N days, and date ranges. The answer leads with the best (or worst, if asked) game type, then the table. Related phrasings: best/worst game type, win rate, record by variation, "what variation have I had the most success with, percentage wise." Partner-tour wins count if the player was on the winning team. Only finished Diamond Spaders tours with a posted winner are counted. Source: each tour's checked-in entrant list (TEAMS page) joined to board labels and posted winners; kept up to date by the same updater that publishes the board. Coverage starts when those entry lists were first stored (currently mid-September 2026) and includes this month in full.


Not reachable / not supported yet:
- "I"/"me"/"my" is Ochwiay on this page. For any other player, name them.
- Played-tour dates/times are when the entry was made (Ladderbux log), not the tour's start; the log has no partner names. Tours entered for free (no entry fee) would not be counted.
- Scores and hands. Placings below 3rd are not in the log (shown as "played, did not place"). Entrant lists are one tour per question.
- Ladder standings, ratings, Ladderbux balances, player profiles.
- Leagues not in leagues.json (add them there).
- Tour names that exist only on the tour's own page (the feed has the format text, e.g. "2 VS 2").
- More than 60 days back for winner/calendar questions (player tours-played history has no limit). Leaderboards can reach a named month a bit further back when daily reports exist (Diamond Spaders, roughly the last few months).
- "Who played the most" over more than one day (no complete entrant lists for a whole month).
- Player wins inside team tours where the feed lists only the team name (counted only when the TEAMS page is checked, which is done for single-tour questions).
