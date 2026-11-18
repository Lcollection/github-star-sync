#!/usr/bin/env python3
"""Sync a GitHub user's starred repositories to JSON and Markdown.

No third-party dependencies. For public star lists, GITHUB_TOKEN is enough.
Use STAR_TOKEN for special account-level authorization when necessary.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

API_ROOT = "https://api.github.com"
API_VERSION = "2026-03-10"
PAGE_SIZE = 100


def fetch_stars(username: str, token: str | None) -> list[dict]:
    """Fetch all pages, preserving the exact time each repository was starred."""
    headers = {
        "Accept": "application/vnd.github.star+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "github-star-sync",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    stars: dict[str, dict] = {}
    page = 1
    while True:
        query = urlencode(
            {"per_page": PAGE_SIZE, "page": page, "sort": "created", "direction": "desc"}
        )
        url = f"{API_ROOT}/users/{quote(username, safe='')}/starred?{query}"
        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
        except HTTPError as exc:
            raise RuntimeError(f"GitHub API returned HTTP {exc.code} on page {page}") from exc
        except URLError as exc:
            raise RuntimeError(f"Cannot reach GitHub API: {exc.reason}") from exc

        if not isinstance(payload, list):
            raise RuntimeError("Unexpected GitHub API response; expected a list")
        for entry in payload:
            if not isinstance(entry, dict) or "repo" not in entry or "starred_at" not in entry:
                raise RuntimeError(
                    "GitHub did not return star timestamps. Check the Accept header."
                )
            repo = entry["repo"]
            full_name = repo["full_name"]
            stars[full_name] = {
                "full_name": full_name,
                "url": repo["html_url"],
                "description": repo.get("description") or "",
                "language": repo.get("language"),
                "topics": sorted(repo.get("topics") or []),
                "starred_at": entry["starred_at"],
                "archived": bool(repo.get("archived", False)),
                "fork": bool(repo.get("fork", False)),
            }

        print(f"Retrieved page {page}: {len(payload)} repositories", flush=True)
        if len(payload) < PAGE_SIZE:
            break
        page += 1

    # A zero-sized response can mean private-profile visibility or an auth issue.
    # Do not silently overwrite a previously valid snapshot with an empty one.
    if not stars:
        raise RuntimeError(
            "No starred repositories were returned. Check profile privacy and token "
            "permissions before replacing the existing snapshot."
        )

    return sorted(stars.values(), key=lambda item: (item["starred_at"], item["full_name"]), reverse=True)


def escape_markdown(value: object, limit: int | None = None) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if limit is not None and len(text) > limit:
        text = text[: limit - 1] + "…"
    return text.replace("\\", "\\\\").replace("|", "\\|").replace("<", "&lt;").replace(">", "&gt;")


def write_outputs(username: str, stars: list[dict], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    data = {"username": username, "count": len(stars), "repositories": stars}
    (output_dir / "stars.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        f"# {username}'s GitHub Stars",
        "",
        f"**Total:** {len(stars)} starred repositories. Automatically synced by GitHub Actions.",
        "",
        "| # | Repository | Language | Starred (UTC) | Description |",
        "| ---: | --- | --- | --- | --- |",
    ]
    for index, repo in enumerate(stars, 1):
        name = escape_markdown(repo["full_name"])
        language = escape_markdown(repo["language"] or "—")
        date = escape_markdown(repo["starred_at"][:10])
        desc = escape_markdown(repo["description"], limit=140)
        lines.append(
            f"| {index} | [{name}]({repo['url']}) | {language} | {date} | {desc} |"
        )

    (output_dir / "STARS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    username = os.getenv("STAR_USERNAME", "Lcollection").strip()
    if not username:
        raise ValueError("STAR_USERNAME cannot be empty")
    token = os.getenv("STAR_TOKEN") or os.getenv("GITHUB_TOKEN")
    stars = fetch_stars(username, token)
    write_outputs(username, stars, Path.cwd())
    print(f"Saved {len(stars)} starred repositories to stars.json and STARS.md")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
