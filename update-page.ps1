# Reads today's Diamond Spaders tours from MyLeague and saves them to the page.
$ErrorActionPreference = "Stop"
$root = Join-Path $env:USERPROFILE "diamondspaders"
$log = Join-Path $env:TEMP "diamondspaders-update-log.txt"

function Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line
  Write-Host $line
}

function Find-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fixed = @(
    "$env:ProgramFiles\Git\cmd\git.exe",
    "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
  )
  foreach ($p in $fixed) { if (Test-Path $p) { return $p } }
  $desk = Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop" -Recurse -Filter git.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\cmd\\git.exe$' } |
    Select-Object -First 1
  if ($desk) { return $desk.FullName }
  return $null
}

function Get-Page([string]$url) {
  $out = Join-Path $env:TEMP ("ds-page-" + [guid]::NewGuid().ToString() + ".html")
  & curl.exe -sS -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o $out $url
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) { return "" }
  return [System.IO.File]::ReadAllText($out)
}

function Get-StandingsWinner([string]$html) {
  $table = [regex]::Match($html, '<table border="0" cellspacing="0" cellpadding="0">([\s\S]*?)</table>', 'IgnoreCase')
  if (-not $table.Success) { return @() }
  $maxCol = -1
  $names = @()
  $open = @{}
  foreach ($row in [regex]::Matches($table.Groups[1].Value, '<tr>([\s\S]*?)</tr>', 'IgnoreCase')) {
    $col = 0
    foreach ($cell in [regex]::Matches($row.Groups[1].Value, '<td([^>]*)>([\s\S]*?)</td>', 'IgnoreCase')) {
      $inner = $cell.Groups[2].Value
      $title = ""
      $tm = [regex]::Match($inner, 'title="([^"]+)"')
      if ($tm.Success) { $title = $tm.Groups[1].Value.Trim() }
      $text = [regex]::Replace($inner, '<[^>]+>', ' ')
      $text = [regex]::Replace(($text -replace '&nbsp;', ' '), '\s+', ' ').Trim()
      if ($text -match 'a\.s\.a\.p') { $open["$col"] = $true }
      elseif ($text) { $names += [pscustomobject]@{ col = $col; name = $text; title = $title } }
      if (($text -match 'a\.s\.a\.p' -or $text) -and $col -gt $maxCol) { $maxCol = $col }
      $col++
    }
  }
  if ($maxCol -lt 0 -or $open.ContainsKey("$maxCol")) { return @() }
  $finals = @($names | Where-Object { $_.col -eq $maxCol -and $_.name -notmatch 'bye|\(n/a\)' })
  if ($finals.Count -ne 1) { return @() }
  $champ = $finals[0]
  if ($champ.title -match ',') {
    return @($champ.title.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  }
  $one = ($champ.name -replace '^\(\d+\)\s*', '' -replace '\.$', '').Trim()
  if ($one) { return @($one) } else { return @() }
}

function Get-WinnerTeam([string]$id) {
  $page = Get-Page "https://cgi6.igl.net/tourneysystem/players.php?tcount=$id&path=diamondspaders"
  $m = [regex]::Match($page, "parseJSON\('([\s\S]*?)'\);")
  if (-not $m.Success) { return $null }
  $raw = $m.Groups[1].Value.Replace("\'", "'")
  try { $d = $raw | ConvertFrom-Json } catch { return $null }
  foreach ($tm in @($d.teams)) {
    if ([string]$tm.status -notmatch 'winner') { continue }
    $who = @()
    foreach ($p in @($tm.players)) {
      $pm = [regex]::Match([string]$p, '<strong>([\s\S]*?)</strong>')
      $nm = if ($pm.Success) { $pm.Groups[1].Value } else { [regex]::Replace([string]$p, '<[^>]+>', '') }
      $nm = $nm.Trim()
      if ($nm) { $who += $nm }
    }
    return [pscustomobject]@{ team = ([string]$tm.team).Trim(); names = $who }
  }
  return $null
}

function Esc([string]$s) {
  if (-not $s) { return "" }
  $amp = '&' + 'amp;'
  $lt = '&' + 'lt;'
  $gt = '&' + 'gt;'
  $quot = '&' + 'quot;'
  return $s.Replace('&', $amp).Replace('<', $lt).Replace('>', $gt).Replace('"', $quot)
}

function Label([string]$text, [int]$per) {
  $n = ($text.ToUpper() -replace '\d+\s*/\s*\d+', ' ' -replace '\s+', ' ').Trim()
  if ($per -eq 1 -and $text -match 'LOS\w*R?\s*WIN|(?<![\d/])-?1000(?!\d)') { return "LOSER WINS" }
  if ($n -match 'MIRROR') { return "CUT MIRRORS" }
  if ($n -match 'LOS[E]?R\s*WI') { return "LOSER WINS" }
  if ($n -match 'SINGLE') { return "SINGLES" }
  if ($n -match 'PAB|PARD A BOT|PASS\s*2\s*PART') { return "PAB" }
  if ($n -match 'SUI|SUICIDE|PASS\s*2') { return "SUI PASS 2" }
  if ($n -match 'PARD|PARTNER') { return "REG PARTNERS" }
  if ($per -eq 2) { return "REG PARTNERS" }
  return "CUT"
}

try {
  $git = Find-Git
  if (-not $git) { throw "Git is not installed. Install GitHub Desktop, sign in, then run this again." }
  Log "git $git"

  if (-not (Test-Path (Join-Path $root ".git"))) {
    if (Test-Path $root) {
      Log "removing the blocked folder"
      Remove-Item $root -Recurse -Force
    }
    Log "cloning the site"
    & $git clone https://github.com/SF2021-dev/spades.git $root
    if ($LASTEXITCODE -ne 0) { throw "clone failed" }
  }
  Set-Location $root
  Log "updating the saved copy"
  & $git fetch origin main
  if ($LASTEXITCODE -ne 0) { throw "fetch failed" }
  & $git reset --hard origin/main
  if ($LASTEXITCODE -ne 0) { throw "reset failed" }

  $tz = [TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")
  $now = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz)
  $today = $now.ToString("yyyy-MM-dd")
  Log "today $today Eastern"

  $yestDate = $now.AddDays(-1)
  $yesterday = $yestDate.ToString("yyyy-MM-dd")
  $body = "range=daily&strLadder=diamondspaders&DisplayCount=300&page=1&sort=1&sd=$($yestDate.Day)&sm=$($yestDate.Month)&sy=$($yestDate.Year)&ed=$($now.Day)&em=$($now.Month)&ey=$($now.Year)"
  $cal = Join-Path $env:TEMP "diamondspaders-calendar.xml"
  & curl.exe -sS -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Content-Type: application/x-www-form-urlencoded" --data $body -o $cal "https://www.myleague.com/pages/remote/tournamentCalendar.php"
  if ($LASTEXITCODE -ne 0) { throw "MyLeague did not answer" }
  $xml = [System.IO.File]::ReadAllText($cal)
  if ($xml -notmatch "SQLResults") { throw "MyLeague did not return the tour list" }

  $avatars = @{}
  $cfgPath = Join-Path $root "live\config.json"
  if (Test-Path $cfgPath) {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if ($cfg.avatars) {
      $cfg.avatars.PSObject.Properties | ForEach-Object { $avatars[$_.Name.ToLower()] = $_.Value }
    }
  }

  $tours = @()
  foreach ($rec in [regex]::Matches($xml, "<objRecord>([\s\S]*?)</objRecord>")) {
    $chunk = $rec.Groups[1].Value
    function Field([string]$name) {
      $m = [regex]::Match($chunk, "<$name>([\s\S]*?)</$name>")
      if ($m.Success) { return $m.Groups[1].Value.Trim() } else { return "" }
    }
    $time = 0; [void][int]::TryParse((Field "time"), [ref]$time)
    $year = 0; [void][int]::TryParse((Field "year"), [ref]$year)
    $month = 0; [void][int]::TryParse((Field "month"), [ref]$month)
    $day = 0; [void][int]::TryParse((Field "day"), [ref]$day)
    $date = "{0:0000}-{1:00}-{2:00}" -f $year, ($month + 1), $day
    if ($date -ne $today -and $date -ne $yesterday) { continue }
    $status = Field "status"
    $per = 0; [void][int]::TryParse((Field "perteam"), [ref]$per)
    $h = [math]::Floor($time / 100)
    $mi = $time % 100
    $td = Field "td"
    $id = Field "tcount"
    $game = Label (Field "location") $per
    $tours += [pscustomobject]@{ date = $date; h = $h; m = $mi; game = $game; td = $td; id = $id; per = $per; status = $status; winners = @(); team = "" }
  }
  $nowMin = $now.Hour * 60 + $now.Minute
  foreach ($t in $tours) {
    $started = ($t.date -lt $today) -or ($t.date -eq $today -and $nowMin -ge ($t.h * 60 + $t.m))
    if (-not $started -or -not $t.id) { continue }
    $page = Get-Page "https://cgi6.igl.net/tourneysystem/standings.php?tcount=$($t.id)&path=diamondspaders"
    $names = @(Get-StandingsWinner $page)
    $pard = ($t.per -eq 2) -or ($t.game -eq "REG PARTNERS") -or ($t.game -eq "SUI PASS 2")
    $team = ""
    if ($pard -and $names.Count -lt 2) {
      $wt = Get-WinnerTeam $t.id
      if ($wt -and @($wt.names).Count -ge 2) {
        $names = @($wt.names | Select-Object -First 2)
        $team = [string]$wt.team
      }
    }
    if ($pard) {
      if ($names.Count -ge 2) { $t.winners = @($names | Select-Object -First 2) } else { $t.winners = @() }
      if (-not $team -and $t.winners.Count -eq 2) {
        $wt = Get-WinnerTeam $t.id
        if ($wt) { $team = [string]$wt.team }
      }
    } elseif ($names.Count -eq 1) {
      $t.winners = @($names[0])
    }
    $t.team = $team
  }
  $open = @($tours | Where-Object { $_.date -eq $today -and @($_.winners).Count -eq 0 -and $_.status -ne "2" } | Sort-Object h, m, id)
  $todayWins = @($tours | Where-Object { $_.date -eq $today -and @($_.winners).Count -gt 0 } | Sort-Object h, m, id)
  $yestWins = @($tours | Where-Object { $_.date -eq $yesterday -and @($_.winners).Count -gt 0 } | Sort-Object h, m, id)
  Log ("tours " + $open.Count + " winners " + $todayWins.Count)

  function ClockOf($h, $m) {
    $amp = if ($h -ge 12) { "PM" } else { "AM" }
    $h12 = $h % 12; if ($h12 -eq 0) { $h12 = 12 }
    return ("{0}:{1:00} {2}" -f $h12, $m, $amp)
  }
  function AvaOf([string]$n) {
    $k = $n.ToLower()
    if ($avatars.ContainsKey($k)) { return $avatars[$k] }
    return "https://diamondspaders.online/$n-ava.png"
  }
  function CardOf($t, [int]$i) {
    $bg = if ($i % 2 -eq 0) { "#1a1200" } else { "#000" }
    $label = (ClockOf $t.h $t.m) + " " + $t.game
    $who = @($t.winners)
    if ($who.Count -lt 2) {
      $n = [string]$who[0]
      $ava = AvaOf $n
      $fs = 22
      if ($n.Length -gt 15) { $fs = 16 } elseif ($n.Length -gt 12) { $fs = 18 } elseif ($n.Length -gt 9) { $fs = 20 }
      $en = Esc $n
      return "<div style=`"padding:14px 10px;background:${bg};`"><div style=`"display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;`"><a href=`"https://www.myleague.com/diamondspaders/profile/$([uri]::EscapeDataString($n))`" title=`"$en`" style=`"display:block;line-height:0;color:inherit;text-decoration:none;cursor:pointer;`"><img src=`"$ava`" width=`"64`" height=`"64`" style=`"width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #fbe646;`"></a><div><div style=`"font-size:13px;font-weight:700;`">$(Esc $label)</div><div style=`"font-size:${fs}px;font-weight:800;`">$en</div></div></div></div>"
    }
    $teamHtml = ""
    if ($t.team -and ($t.game -eq "REG PARTNERS" -or $t.game -eq "SUI PASS 2")) {
      $teamHtml = "<div style=`"font-size:14px;font-weight:600;color:#fbe646;margin-bottom:6px;text-align:center;`">$(Esc $t.team)</div>"
    }
    $bits = @()
    foreach ($n in $who) {
      $en = Esc $n
      $ava = AvaOf $n
      $fs = 14
      if ($n.Length -gt 11) { $fs = 12 } elseif ($n.Length -le 7) { $fs = 15 }
      $bits += "<div style=`"display:flex;align-items:center;gap:6px;min-width:0;`"><a href=`"https://www.myleague.com/diamondspaders/profile/$([uri]::EscapeDataString($n))`" title=`"$en`" style=`"display:block;line-height:0;color:inherit;text-decoration:none;cursor:pointer;`"><img src=`"$ava`" width=`"44`" height=`"44`" style=`"width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid #fbe646;`"></a><div style=`"font-size:${fs}px;font-weight:800;overflow-wrap:anywhere;line-height:1.1;`">$en</div></div>"
    }
    return "<div style=`"padding:14px 10px;background:${bg};`"><div style=`"font-size:13px;font-weight:700;margin-bottom:2px;`">$(Esc $label)</div>$teamHtml<div style=`"display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:6px;`">$($bits -join '')</div></div>"
  }

  $rows = @()
  $js = @()
  foreach ($t in $open) {
    $clock = ClockOf $t.h $t.m
    $url = "https://www.myleague.com/diamondspaders/tournament/$($t.id)/"
    $key = $t.td.ToLower()
    $ava = $avatars[$key]
    if (-not $ava) { $ava = "https://diamondspaders.online/$($t.td)-ava.png" }
    $safeGame = Esc $t.game
    $safeTd = Esc $t.td
    $rows += "<div class=`"ds-tour-item`"><a class=`"ds-join`" href=`"$url`" target=`"_blank`">JOIN</a><div class=`"ds-tour-text`">$clock</div><div class=`"ds-tour-text`"><a href=`"$url`" target=`"_blank`">$safeGame w/ $safeTd</a></div><span style=`"margin-left:-6px;display:flex;`"><img class=`"ds-td`" src=`"$ava`" alt=`"`"></span></div>"
    $js += "    { dt: `"$today`", h: $($t.h), m: $($t.m), game: `"$($t.game)`", td: `"$($t.td)`", url: `"$url`", ava: `"$ava`" }"
  }

  $indexPath = Join-Path $root "index.html"
  $html = Get-Content $indexPath -Raw
  $bar = "<div id=`"ds-tours`" class=`"ds-tour`">`r`n" + ($rows -join "`r`n") + "`r`n</div>`r`n"
  $html2 = [regex]::Replace($html, '<div id="ds-tours" class="ds-tour">[\s\S]*?(?=<div id="ds-winners-yesterday")', $bar, 1)
  $list = "  var TOURS = [`r`n" + ($js -join ",`r`n") + "`r`n  ];"
  $html2 = [regex]::Replace($html2, '  var TOURS = \[[\s\S]*?\];', $list, 1)
  if ($todayWins.Count -gt 0) {
    $cards = @()
    for ($i = 0; $i -lt $todayWins.Count; $i++) { $cards += CardOf $todayWins[$i] $i }
    $top = "<div id=`"ds-winners-today`" style=`"display:grid;grid-template-columns:1fr 1fr 1fr;`">`r`n" + ($cards -join "`r`n") + "`r`n</div>`r`n"
    $html2 = [regex]::Replace($html2, '<div id="ds-winners-today"[\s\S]*?(?=<div id="ds-tours")', $top, 1)
    if ($yestWins.Count -gt 0) {
      $yc = @()
      for ($i = 0; $i -lt $yestWins.Count; $i++) { $yc += CardOf $yestWins[$i] $i }
      $head = "<div style=`"grid-column:1/-1;padding:12px 10px 4px;font-size:15px;font-weight:800;letter-spacing:0.14em;color:#fbe646;`">Yesterday's Winners</div>"
      $bot = "<div id=`"ds-winners-yesterday`" style=`"border-top:3px solid #fbe646;display:grid;grid-template-columns:1fr 1fr 1fr;`">`r`n$head`r`n" + ($yc -join "`r`n") + "`r`n</div>`r`n"
      $html2 = [regex]::Replace($html2, '<div id="ds-winners-yesterday"[\s\S]*?(?=<div id="ds-rank")', $bot, 1)
    }
  }
  if ($html2 -eq $html) { Log "no change" }
  else {
    [System.IO.File]::WriteAllText($indexPath, $html2)
    & $git add index.html
    & $git -c user.name="diamondspaders" -c user.email="actions@diamondspaders.online" commit -m "Update the page"
    if ($LASTEXITCODE -ne 0) { throw "commit failed" }
    & $git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw "push failed. Sign in to GitHub on this computer and run this again." }
    Log "saved"
  }
  Log "done"
}
catch {
  Log ("ERROR " + $_.Exception.Message)
  exit 1
}
