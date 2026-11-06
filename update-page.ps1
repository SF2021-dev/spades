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
  & $git pull --rebase origin main
  if ($LASTEXITCODE -ne 0) { throw "pull failed" }

  $tz = [TimeZoneInfo]::FindSystemTimeZoneById("Eastern Standard Time")
  $now = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz)
  $today = $now.ToString("yyyy-MM-dd")
  Log "today $today Eastern"

  $body = "range=daily&strLadder=diamondspaders&DisplayCount=300&page=1&sort=1&sd=$($now.Day)&sm=$($now.Month)&sy=$($now.Year)&ed=$($now.Day)&em=$($now.Month)&ey=$($now.Year)"
  $resp = Invoke-WebRequest -Uri "https://www.myleague.com/pages/remote/tournamentCalendar.php" -Method POST -Body $body -Headers @{ "User-Agent" = "Mozilla/5.0" } -UseBasicParsing
  $xml = $resp.Content
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
    if ($date -ne $today) { continue }
    $winner = Field "winner"
    $status = Field "status"
    if ($winner -or $status -eq "2") { continue }
    $per = 0; [void][int]::TryParse((Field "perteam"), [ref]$per)
    $h = [math]::Floor($time / 100)
    $m = $time % 100
    $td = Field "td"
    $id = Field "tcount"
    $game = Label (Field "location") $per
    $tours += [pscustomobject]@{ h = $h; m = $m; game = $game; td = $td; id = $id }
  }
  $tours = $tours | Sort-Object h, m, id
  Log ("tours " + $tours.Count)

  $rows = @()
  $js = @()
  foreach ($t in $tours) {
    $amp = if ($t.h -ge 12) { "PM" } else { "AM" }
    $h12 = $t.h % 12; if ($h12 -eq 0) { $h12 = 12 }
    $clock = "{0}:{1:00} {2}" -f $h12, $t.m, $amp
    $url = "https://www.myleague.com/diamondspaders/tournament/$($t.id)/"
    $key = $t.td.ToLower()
    $ava = $avatars[$key]
    if (-not $ava) { $ava = "https://diamondspaders.online/$($t.td)-ava.png" }
    $safeGame = $t.game.Replace("&", "&")
    $safeTd = $t.td.Replace("&", "&")
    $rows += "<div class=`"ds-tour-item`"><a class=`"ds-join`" href=`"$url`" target=`"_blank`">JOIN</a><div class=`"ds-tour-text`">$clock</div><div class=`"ds-tour-text`"><a href=`"$url`" target=`"_blank`">$safeGame w/ $safeTd</a></div><span style=`"margin-left:-6px;display:flex;`"><img class=`"ds-td`" src=`"$ava`" alt=`"`"></span></div>"
    $js += "    { dt: `"$today`", h: $($t.h), m: $($t.m), game: `"$($t.game)`", td: `"$($t.td)`", url: `"$url`", ava: `"$ava`" }"
  }

  $indexPath = Join-Path $root "index.html"
  $html = Get-Content $indexPath -Raw
  $bar = "<div id=`"ds-tours`" class=`"ds-tour`">`r`n" + ($rows -join "`r`n") + "`r`n</div>"
  $html2 = [regex]::Replace($html, '<div id="ds-tours" class="ds-tour">[\s\S]*?</div>', $bar, 1)
  $list = "  var TOURS = [`r`n" + ($js -join ",`r`n") + "`r`n  ];"
  $html2 = [regex]::Replace($html2, '  var TOURS = \[[\s\S]*?\];', $list, 1)
  if ($html2 -eq $html) { Log "no change" }
  else {
    [System.IO.File]::WriteAllText($indexPath, $html2)
    & $git add index.html
    & $git -c user.name="diamondspaders" -c user.email="actions@diamondspaders.online" commit -m "Update today's tours"
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
