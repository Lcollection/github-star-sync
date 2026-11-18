import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import sync_stars


def star(name, when):
    return {
        'starred_at': when,
        'repo': {
            'full_name': name,
            'html_url': f'https://github.com/{name}',
            'description': 'A | project\nwith newlines',
            'language': 'Python',
            'topics': ['science', 'ai'],
            'archived': False,
            'fork': False,
        },
    }


class FakeResponse(io.BytesIO):
    def __init__(self, payload):
        super().__init__(json.dumps(payload).encode('utf-8'))


class SyncTest(unittest.TestCase):
    def test_pagination_and_timestamp_order(self):
        responses = [
            FakeResponse([star('a/older', '2025-01-01T00:00:00Z'), star('b/newer', '2026-01-01T00:00:00Z')]),
            FakeResponse([star('c/middle', '2025-06-01T00:00:00Z')]),
        ]
        seen = []

        def fake_open(request, timeout):
            seen.append(request)
            return responses.pop(0)

        with patch.object(sync_stars, 'PAGE_SIZE', 2), patch.object(sync_stars, 'urlopen', side_effect=fake_open):
            repos = sync_stars.fetch_stars('Lcollection', 'dummy-token')
        self.assertEqual([v['full_name'] for v in repos], ['b/newer', 'c/middle', 'a/older'])
        self.assertEqual(repos[0]['starred_at'], '2026-01-01T00:00:00Z')
        self.assertEqual(len(seen), 2)
        self.assertEqual(seen[0].get_header('Accept'), 'application/vnd.github.star+json')
        self.assertTrue(seen[0].full_url.endswith('page=1&sort=created&direction=desc'))

    def test_empty_result_does_not_overwrite(self):
        with patch.object(sync_stars, 'urlopen', return_value=FakeResponse([])):
            with self.assertRaisesRegex(RuntimeError, 'No starred repositories'):
                sync_stars.fetch_stars('Lcollection', None)

    def test_write_stable_and_escape(self):
        repo = {
            'full_name': 'a/project',
            'url': 'https://github.com/a/project',
            'description': 'A | project\nwith newlines',
            'language': 'Python',
            'topics': ['science'],
            'starred_at': '2026-01-02T00:00:00Z',
            'archived': False,
            'fork': False,
        }
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            sync_stars.write_outputs('Lcollection', [repo], directory)
            original_json = (directory / 'stars.json').read_bytes()
            original_md = (directory / 'STARS.md').read_bytes()
            self.assertIn('A \\| project with newlines', original_md.decode())
            self.assertEqual(json.loads(original_json)['count'], 1)
            sync_stars.write_outputs('Lcollection', [repo], directory)
            self.assertEqual(original_json, (directory / 'stars.json').read_bytes())
            self.assertEqual(original_md, (directory / 'STARS.md').read_bytes())


if __name__ == '__main__':
    unittest.main()
