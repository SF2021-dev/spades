# Reads today's Diamond Spaders tours from MyLeague and saves them to the page.
$ErrorActionPreference = "Stop"
$script:asLoop = $args -contains "-loop"
$script:asOnce = $args -contains "-once"
$root = Join-Path $env:USERPROFILE "diamondspaders"
$log = Join-Path $env:TEMP "diamondspaders-update-log.txt"

if ($args -notcontains "-noupdate" -and $PSCommandPath) {
  $latest = Join-Path $env:TEMP "update-page-latest.ps1"
  & curl.exe -fsSL -o $latest "https://raw.githubusercontent.com/SF2021-dev/spades/main/update-page.ps1"
  if ($LASTEXITCODE -eq 0 -and (Test-Path $latest)) {
    $here = (Get-FileHash $PSCommandPath -Algorithm MD5).Hash
    $there = (Get-FileHash $latest -Algorithm MD5).Hash
    if ($here -ne $there) {
      Copy-Item $latest $PSCommandPath -Force
      $pass = @("-NoProfile","-ExecutionPolicy","Bypass","-File",$PSCommandPath,"-noupdate")
      if ($script:asLoop) { $pass += "-loop" }
      if ($script:asOnce) { $pass += "-once" }
      & powershell.exe @pass
      exit $LASTEXITCODE
    }
  }
}

function Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $log -Value $line
  Write-Host $line
}

function Register-Always {
  if (-not $PSCommandPath) { return }
  $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCommandPath -loop"
  & schtasks.exe /Create /F /SC ONLOGON /TN "Diamond Spaders update" /TR $tr | Out-Null
  & schtasks.exe /Create /F /SC MINUTE /MO 5 /TN "Diamond Spaders watchdog" /TR $tr | Out-Null
}

function Get-LoopPid {
  $lock = Join-Path $env:TEMP "diamondspaders-loop.pid"
  if (-not (Test-Path $lock)) { return 0 }
  $id = 0
  [void][int]::TryParse((Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1), [ref]$id)
  if ($id -le 0) { return 0 }
  if (Get-Process -Id $id -ErrorAction SilentlyContinue) { return $id }
  return 0
}

function Start-LoopIfNeeded {
  Register-Always
  if ($script:asLoop -or $script:asOnce) { return }
  if ((Get-LoopPid) -ne 0) { Log "it is already running"; return }
  if (-not $PSCommandPath) { return }
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File",$PSCommandPath,"-loop") -WindowStyle Hidden
  Log "it stays running"
}

if ($args -contains "-loop") {
  if ((Get-LoopPid) -ne 0) { exit 0 }
  $lock = Join-Path $env:TEMP "diamondspaders-loop.pid"
  Set-Content -Path $lock -Value $PID
  Register-Always
  Log "staying running"
  while ($true) {
    try {
      $latest = Join-Path $env:TEMP "update-page-latest.ps1"
      & curl.exe -fsSL -o $latest "https://raw.githubusercontent.com/SF2021-dev/spades/main/update-page.ps1"
      if ($LASTEXITCODE -eq 0 -and (Test-Path $latest) -and $PSCommandPath) {
        $here = (Get-FileHash $PSCommandPath -Algorithm MD5).Hash
        $there = (Get-FileHash $latest -Algorithm MD5).Hash
        if ($here -ne $there) {
          Copy-Item $latest $PSCommandPath -Force
          Remove-Item $lock -Force -ErrorAction SilentlyContinue
          Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File",$PSCommandPath,"-loop") -WindowStyle Hidden
          exit 0
        }
      }
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $PSCommandPath -noupdate -once
    } catch {
      Log ("ERROR " + $_.Exception.Message)
    }
    Start-Sleep -Seconds 300
  }
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

  $tz = [TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")
  $now = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz)
  $today = $now.ToString("yyyy-MM-dd")
  $statePath = Join-Path $env:TEMP "diamondspaders-update-state.json"
  $state = $null
  if (Test-Path $statePath) { try { $state = Get-Content $statePath -Raw | ConvertFrom-Json } catch { $state = $null } }
  $full = $false
  if ($state -and [string]$state.fullDay -eq $today) { $full = $true }
  $lastCal = $null
  if ($state -and $state.lastCalendar) { try { $lastCal = [datetime]$state.lastCalendar } catch { $lastCal = $null } }
  $doCalendar = (-not $full) -and ((-not $lastCal) -or (($now - $lastCal).TotalMinutes -ge 30))
  if (-not $doCalendar -and (-not $state -or -not $state.tours)) { $doCalendar = $true }
  $nowMin = $now.Hour * 60 + $now.Minute
  $saved = @()
  if ($state -and $state.tours) { $saved = @($state.tours) }
  $dueCount = 0
  foreach ($t in $saved) {
    if ([string]$t.date -ne $today) { continue }
    $known = $false
    if ($state.winners) { $known = [bool]($state.winners.PSObject.Properties.Name -contains [string]$t.id) }
    if ($known) { continue }
    $age = $nowMin - ([int]$t.h * 60 + [int]$t.m)
    if ($age -ge 20) { $dueCount++ }
  }
  if (-not $doCalendar -and $dueCount -eq 0) {
    Start-LoopIfNeeded
    if ($full) { Log "all 16 slots filled, next tour check is after midnight" } else { Log "nothing to check" }
    Log "done"
    exit 0
  }

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
  if ($doCalendar) { Log "checking MyLeague for tours" } else { Log "using the saved tour list" }

  $yestDate = $now.AddDays(-1)
  $yesterday = $yestDate.ToString("yyyy-MM-dd")
  if ($doCalendar) {
    $body = "range=daily&strLadder=diamondspaders&DisplayCount=300&page=1&sort=1&sd=$($yestDate.Day)&sm=$($yestDate.Month)&sy=$($yestDate.Year)&ed=$($now.Day)&em=$($now.Month)&ey=$($now.Year)"
    $cal = Join-Path $env:TEMP "diamondspaders-calendar.xml"
    & curl.exe -sS -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Content-Type: application/x-www-form-urlencoded" --data $body -o $cal "https://www.myleague.com/pages/remote/tournamentCalendar.php"
    if ($LASTEXITCODE -ne 0) { throw "MyLeague did not answer" }
    $xml = [System.IO.File]::ReadAllText($cal)
    if ($xml -notmatch "SQLResults") { throw "MyLeague did not return the tour list" }
  }

  $avatars = @{}
  $cfgPath = Join-Path $root "live\config.json"
  if (Test-Path $cfgPath) {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if ($cfg.avatars) {
      $cfg.avatars.PSObject.Properties | ForEach-Object { $avatars[$_.Name.ToLower()] = $_.Value }
    }
  }

  $tours = @()
  if ($doCalendar) {
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
    $win = Field "winner"
    $tours += [pscustomobject]@{ date = $date; h = $h; m = $mi; game = $game; td = $td; id = $id; per = $per; status = $status; win = $win; winners = @(); team = "" }
  }
  $slotHours = @{}
  foreach ($t in $tours) { if ($t.date -eq $today -and $t.m -eq 15 -and $t.h -ge 8 -and $t.h -le 23) { $slotHours[[string]$t.h] = $true } }
  if ($slotHours.Count -ge 16) { $full = $true; Log "all 16 slots are filled" }
  } else {
    foreach ($t in $saved) {
      $tours += [pscustomobject]@{ date = [string]$t.date; h = [int]$t.h; m = [int]$t.m; game = [string]$t.game; td = [string]$t.td; id = [string]$t.id; per = [int]$t.per; status = [string]$t.status; win = [string]$t.win; winners = @(); team = "" }
    }
  }
  $nowMin = $now.Hour * 60 + $now.Minute
  foreach ($t in $tours) {
    if ($t.date -ne $today -or -not $t.id) { continue }
    $knownNames = $null
    $knownTeam = ""
    if ($state -and $state.winners) {
      $prop = $state.winners.PSObject.Properties | Where-Object { $_.Name -eq [string]$t.id } | Select-Object -First 1
      if ($prop) { $knownNames = @($prop.Value.names); $knownTeam = [string]$prop.Value.team }
    }
    if ($knownNames) { $t.winners = @($knownNames); $t.team = $knownTeam; continue }
    if ($t.status -eq "2" -and $t.win) {
      $pard = ($t.per -eq 2) -or ($t.game -eq "REG PARTNERS") -or ($t.game -eq "SUI PASS 2")
      if ($pard) {
        $wt = Get-WinnerTeam $t.id
        if ($wt -and @($wt.names).Count -ge 2) {
          $t.winners = @($wt.names | Select-Object -First 2)
          $t.team = [string]$wt.team
          continue
        }
      }
      $t.winners = @($t.win)
      continue
    }
    $age = $nowMin - ($t.h * 60 + $t.m)
    if ($age -lt 20) { continue }
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
  $open = @($tours | Where-Object { $_.date -eq $today -and @($_.winners).Count -eq 0 } | Sort-Object h, m, id)
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
    $alreadyMoved = $state -and [string]$state.movedDay -eq $today
    if (-not $alreadyMoved) {
      $oldTop = [regex]::Match($html2, '<div id="ds-winners-today"[^>]*>([\s\S]*?)</div>\s*(?=<div id="ds-tours")')
      if ($oldTop.Success -and $oldTop.Groups[1].Value.Trim()) {
        $head = "<div style=`"grid-column:1/-1;padding:12px 10px 4px;font-size:15px;font-weight:800;letter-spacing:0.14em;color:#fbe646;`">Yesterday's Winners</div>"
        $bot = "<div id=`"ds-winners-yesterday`" style=`"border-top:3px solid #fbe646;display:grid;grid-template-columns:1fr 1fr 1fr;`">`r`n$head`r`n" + $oldTop.Groups[1].Value.Trim() + "`r`n</div>`r`n"
        $html2 = [regex]::Replace($html2, '<div id="ds-winners-yesterday"[\s\S]*?(?=<div id="ds-rank")', $bot, 1)
        $movedDay = $today
      }
    }
    $cards = @()
    for ($i = 0; $i -lt $todayWins.Count; $i++) { $cards += CardOf $todayWins[$i] $i }
    $top = "<div id=`"ds-winners-today`" style=`"display:grid;grid-template-columns:1fr 1fr 1fr;`">`r`n" + ($cards -join "`r`n") + "`r`n</div>`r`n"
    $html2 = [regex]::Replace($html2, '<div id="ds-winners-today"[\s\S]*?(?=<div id="ds-tours")', $top, 1)
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
  $winMap = @{}
  if ($state -and $state.winners) {
    foreach ($p in $state.winners.PSObject.Properties) { $winMap[$p.Name] = $p.Value }
  }
  foreach ($t in $tours) {
    if (@($t.winners).Count -gt 0) { $winMap[[string]$t.id] = @{ names = @($t.winners); team = [string]$t.team } }
  }
  $tourSave = @()
  foreach ($t in $tours) { $tourSave += @{ date = $t.date; h = $t.h; m = $t.m; game = $t.game; td = $t.td; id = $t.id; per = $t.per; status = $t.status; win = $t.win } }
  $keepMoved = ""
  if ($movedDay) { $keepMoved = $movedDay } elseif ($state) { $keepMoved = [string]$state.movedDay }
  $keepCal = if ($doCalendar) { $now.ToString("o") } elseif ($state) { [string]$state.lastCalendar } else { "" }
  $keepFull = if ($full) { $today } else { "" }
  @{ lastCalendar = $keepCal; fullDay = $keepFull; movedDay = $keepMoved; tours = $tourSave; winners = $winMap } | ConvertTo-Json -Depth 6 | Set-Content -Path $statePath -Encoding UTF8
  Start-LoopIfNeeded
  Log "done"
}
catch {
  Log ("ERROR " + $_.Exception.Message)
  exit 1
}
