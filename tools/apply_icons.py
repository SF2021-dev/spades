#!/usr/bin/env python3
"""Apply an icon edit posted by /start-edit or /start2-edit."""
import base64
import json
import re
import urllib.request
from pathlib import Path

TOKEN = "345c1027-504a-4813-a456-3edbc4488817"
ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"start.html", "start2/index.html"}


def requests_():
    url = f"https://webhook.site/token/{TOKEN}/requests?per_page=20&sorting=newest"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response).get("data") or []


def ok_href(value):
    return bool(re.match(r"https?://", value or "")) and len(value) < 500 and "<" not in value


def ok_src(value):
    return bool(re.match(r"(https?://\S+|/icons/[A-Za-z0-9._/-]+)$", value or "")) and ".." not in (value or "") and len(value) < 500


def esc(value):
    return (value or "").replace("&", "\u0026amp;").replace('"', "\u0026quot;").replace("<", "\u0026lt;")


def rows_html(rows, mark):
    html = f"        <!-- icons:{mark} -->\n"
    for row in rows:
        if not isinstance(row, list):
            continue
        cells = []
        for item in row:
            if not isinstance(item, dict) or not ok_href(item.get("href")) or not ok_src(item.get("src")):
                continue
            title = str(item.get("title") or "")[:80]
            cells.append(
                f'            <a class="icon-sq" href="{esc(item["href"])}" title="{esc(title)}">'
                f'<img src="{esc(item["src"])}" alt="{esc(title)}"></a>\n'
            )
        if cells:
            html += '        <div class="icon-row">\n' + "".join(cells) + "        </div>\n"
    return html


def splice(html, inner):
    key = '<div class="icons-area">'
    start = html.find(key)
    if start < 0:
        raise SystemExit("icons area missing")
    index = start + len(key)
    depth = 1
    while index < len(html) and depth:
        open_at = html.find("<div", index)
        close_at = html.find("</div>", index)
        if close_at < 0:
            raise SystemExit("icons area is broken")
        if open_at != -1 and open_at < close_at:
            depth += 1
            index = open_at + 4
        else:
            depth -= 1
            index = close_at + 6
    return html[:start] + key + "\n" + inner + "    </div>" + html[index:]


def main():
    applied_path = ROOT / "update" / "icons-applied.txt"
    applied = set(applied_path.read_text().split()) if applied_path.exists() else set()
    jobs = []
    for item in requests_():
        try:
            body = json.loads(item.get("content") or "")
        except Exception:
            continue
        if not isinstance(body, dict):
            continue
        mark = str(body.get("id") or "")
        if not mark.isdigit() or body.get("file") not in ALLOWED or mark in applied:
            continue
        jobs.append(body)
    jobs.sort(key=lambda body: int(body["id"]))
    if not jobs:
        print("no new icon edits")
        return
    for body in jobs:
        for image in (body.get("images") or [])[:8]:
            path = str(image.get("path") or "")
            raw = str(image.get("b64") or "")
            if not re.match(r"icons/e[a-z0-9]+\.png$", path) or len(raw) > 400000:
                continue
            try:
                data = base64.b64decode(raw)
            except Exception:
                continue
            if not (32 <= len(data) <= 300000):
                continue
            dest = ROOT / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        page = ROOT / body["file"]
        page.write_text(splice(page.read_text(), rows_html(body.get("rows") or [], body["id"])))
        applied.add(str(body["id"]))
        print("applied", body["id"], body["file"])
    applied_path.parent.mkdir(exist_ok=True)
    applied_path.write_text("\n".join(sorted(applied)[-40:]) + "\n")


if __name__ == "__main__":
    main()
