import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_site import build


class BuildTest(unittest.TestCase):
    def test_creates_complete_offline_site(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'stars.json'
            data.write_text(json.dumps({
                'username': 'Lcollection', 'count': 1, 'repositories': [{
                    'full_name': 'owner/repo', 'starred_at': '2026-01-02T00:00:00Z',
                    'topics': ['science']
                }]
            }), encoding='utf-8')
            dest = root / '_site'
            self.assertEqual(build(data, dest), 1)
            for filename in ['index.html', 'app.js', 'styles.css', 'favicon.svg', 'stars.json', '.nojekyll']:
                self.assertTrue((dest / filename).exists(), filename)
            self.assertEqual(json.loads((dest / 'stars.json').read_text())['repositories'][0]['full_name'], 'owner/repo')

    def test_rejects_inconsistent_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'stars.json'
            data.write_text(json.dumps({'username': 'Lcollection', 'count': 3, 'repositories': []}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'count does not match'):
                build(data, root / '_site')

    def test_rejects_invalid_repository_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'stars.json'
            data.write_text(json.dumps({'username': 'Lcollection', 'count': 1, 'repositories': [
                {'full_name': 'https://evil.test/x', 'starred_at': '2026-01-01', 'topics': []}
            ]}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Invalid repository name'):
                build(data, root / '_site')


if __name__ == '__main__':
    unittest.main()
