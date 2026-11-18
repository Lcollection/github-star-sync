#!/usr/bin/env python3
"""Build a dependency-free static GitHub Pages site from a Stars snapshot."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ('index.html', 'styles.css', 'app.js', 'favicon.svg')
REPO_PATTERN = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
USER_PATTERN = re.compile(r'^[A-Za-z0-9-]{1,39}$')


def build(data_file: Path, destination: Path, source_dir: Path | None = None) -> int:
    source_dir = source_dir or BASE_DIR / 'web'
    snapshot = json.loads(data_file.read_text(encoding='utf-8'))
    if not isinstance(snapshot, dict) or not USER_PATTERN.fullmatch(str(snapshot.get('username', ''))):
        raise ValueError('stars.json requires a valid GitHub username')
    repositories = snapshot.get('repositories')
    if not isinstance(repositories, list):
        raise ValueError('stars.json requires a repositories array')
    if snapshot.get('count') != len(repositories):
        raise ValueError('stars.json count does not match repositories length')

    observed = set()
    for index, repo in enumerate(repositories):
        if not isinstance(repo, dict) or not REPO_PATTERN.fullmatch(str(repo.get('full_name', ''))):
            raise ValueError(f'Invalid repository name at index {index}')
        if repo['full_name'].lower() in observed:
            raise ValueError(f'Duplicate repository: {repo["full_name"]}')
        observed.add(repo['full_name'].lower())
        if not isinstance(repo.get('starred_at'), str):
            raise ValueError(f'Missing star timestamp at index {index}')
        if not isinstance(repo.get('topics', []), list):
            raise ValueError(f'Invalid topics at index {index}')

    destination.mkdir(parents=True, exist_ok=True)
    for name in PUBLIC_FILES:
        if not (source_dir / name).is_file():
            raise FileNotFoundError(source_dir / name)
        shutil.copyfile(source_dir / name, destination / name)
    shutil.copyfile(data_file, destination / 'stars.json')
    (destination / '.nojekyll').touch()
    print(f'Built GitHub Pages site in {destination} ({len(repositories)} repositories)')
    return len(repositories)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=BASE_DIR / 'stars.json')
    parser.add_argument('--out', type=Path, default=BASE_DIR / '_site')
    args = parser.parse_args()
    build(args.data, args.out)


if __name__ == '__main__':
    main()
