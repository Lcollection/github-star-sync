# Starfield · GitHub Star Sync

A zero-build-dependency, searchable GitHub Pages collection powered by an automated Star snapshot. The configured GitHub user is **[Lcollection](https://github.com/Lcollection)**.

## Features

- Daily synchronization of starred repositories, with the original `starred_at` timestamp.
- Automatically maintained `stars.json` (machine-readable) and `STARS.md` (Markdown index).
- Responsive GitHub Pages site with full-text search, language and topic filters, sorting, deep-linkable filters, dark/light themes, and pagination.
- No frontend framework, CDN, trackers, or external API requests from visitors' browsers. Searches are local to the snapshot.
- One workflow builds and publishes the website **after syncing**, avoiding the limitation where GitHub Actions bot commits do not trigger subsequent workflows.

## Deploy to GitHub Pages

1. Create an empty GitHub repository, e.g. `Lcollection/github-stars`. Upload **all project files**, including the hidden `.github` directory, to its default branch.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**. Ensure Actions and Pages are enabled for the repository.
3. Under **Settings → Actions → General → Workflow permissions**, allow the GitHub Actions bot to write repository contents if required by your repository's settings. The workflow explicitly requests `contents: write` to commit the snapshot.
4. Open **Actions → Sync GitHub Stars and Publish Pages → Run workflow**. It fetches the Star list, commits `stars.json` / `STARS.md`, builds `_site`, and deploys it.
5. After a successful deployment, find the published URL under **Settings → Pages** or in the deployment job. A project repository named `github-stars` typically publishes to `https://Lcollection.github.io/github-stars/` (this is an *example*, not a verified deployment).

Subsequent runs occur every day at **03:17 UTC (12:17 JST)**. Pushing changes to website or workflow files on the default branch also triggers a rebuild. GitHub's scheduled run may be delayed. Avoid making changes that conflict with the bot's commit while it is running.

> **Important:** Select **GitHub Actions** as the Pages source, not branch-based publishing. `GITHUB_TOKEN`-authored commits do not trigger a separate branch-based Pages build; this project intentionally deploys within the same workflow run.

## Local usage

Requires Python 3.10+; no extra Python packages or Node.js needed.

```bash
# Fetch actual public Stars; network + GitHub API access required.
STAR_USERNAME=Lcollection python3 scripts/sync_stars.py

# Build static assets (_site/index.html, _site/stars.json, etc.).
python3 scripts/build_site.py

# Serve with HTTP so browser fetch('./stars.json') works.
python3 -m http.server 8000 --directory _site
# Open http://localhost:8000
```

Tests:

```bash
python3 -m unittest discover -s tests -v
node --check web/app.js # optional JavaScript syntax check (Node.js required)
```

## Project structure

```text
.github/workflows/sync-stars.yml  # cron/manual/push sync + Pages deploy
scripts/sync_stars.py             # GitHub REST API → stars.json / STARS.md
scripts/build_site.py             # validate snapshot → _site
web/index.html                    # static UI
web/styles.css                    # responsive themes
web/app.js                        # filters, search, sorting, pagination
web/favicon.svg                   # icon
tests/                            # no-network unit tests
```

## Data and security

- `STAR_USERNAME` in the workflow defaults to `Lcollection`. Change it for another public account.
- `GITHUB_TOKEN` is built into GitHub Actions. No PAT is required for public Stars. A `STAR_TOKEN` repository secret can override it for a user-level token when necessary, subject to GitHub permissions and visibility rules.
- **Pages is usually public**. Never publish a private account's personal or private repository metadata without reviewing the generated JSON first.
- The site's browser reads only the static snapshot. No tokens, secrets, or real-time GitHub API calls are exposed in the frontend.
- With branch protection, the bot may be blocked from committing updated snapshots. Allow bot pushes or change the commit strategy; otherwise the workflow will fail before deployment.
- The build job needs `contents: write`; the deploy job needs `pages: write` and `id-token: write`.
- A full historical record of removed Stars is **not** stored: the snapshot is the current set. Historical tracking can be added separately.

## GitHub API and Pages references

- [List repositories starred by a user](https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-a-user)
- [Custom GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
