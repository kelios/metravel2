import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('context_server', HERE/'context_server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class DiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = server.load_catalog()

    def search(self, *args, **kwargs):
        with patch.object(server, 'load_catalog', return_value=self.catalog):
            return server.find_project_instructions(*args, **kwargs)

    def test_every_canonical_file_is_cataloged_once(self):
        expected = set()
        for directory in ('.codex/skills', '.claude/skills'):
            expected.update(str(p.resolve()) for p in (server.ROOT/directory).glob('*/SKILL.md'))
        for directory in ('.claude/agents', '.claude/commands'):
            expected.update(str(p.resolve()) for p in (server.ROOT/directory).glob('*.md'))
        actual = [item['path'] for item in self.catalog]
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(set(actual)))
        self.assertEqual(self.search('')['counts'], {'skills':105,'roles':64,'commands':14})

    def test_exact_skill_query_first(self):
        result = self.search('$metravel-i18n-guardrails', kind='skills')
        self.assertEqual(result['matches'][0]['name'], 'metravel-i18n-guardrails')
        self.assertTrue(result['matches'][0]['path'].endswith('/.codex/skills/metravel-i18n-guardrails/SKILL.md'))

    def test_exact_roles_and_commands(self):
        self.assertEqual(self.search('code-review-gate',kind='roles')['matches'][0]['name'],'code-review-gate')
        self.assertEqual(self.search('bugfix',kind='commands')['matches'][0]['name'],'bugfix')

    def test_unicode_casefold_english_and_russian_keywords(self):
        self.assertTrue(self.search('КВЕСТ',kind='roles')['matches'])
        self.assertTrue(self.search('translation',kind='skills')['matches'])
        self.assertEqual(self.search('BUGFIX',kind='commands')['matches'][0]['name'],'bugfix')

    def test_bounds_empty_query_and_unknown_query(self):
        self.assertEqual(self.search('')['matches'], [])
        self.assertLess(len(json.dumps(self.search(''),ensure_ascii=False)),800)
        self.assertLessEqual(len(self.search('metravel',limit=12)['matches']),12)
        self.assertEqual(self.search('unmatchableqzxv')['matches'],[])
        for kwargs in ({'limit':13},{'limit':0},{'limit':True},{'kind':'secrets'}):
            with self.assertRaises(ValueError): self.search('test',**kwargs)
        with self.assertRaises(ValueError): self.search('x'*513)

    def test_metadata_only_no_secret_or_arbitrary_paths(self):
        for item in self.catalog:
            self.assertEqual(set(item),{'kind','name','description','path'})
            relative = str(Path(item['path']).relative_to(server.ROOT))
            self.assertTrue(relative.startswith(('.codex/skills/','.claude/skills/','.claude/agents/','.claude/commands/')))
            self.assertNotIn('.secrets/',relative)
            self.assertFalse(Path(relative).name.startswith('.env'))
        # Input is ranking text, never a filesystem/command parameter.
        result = self.search('../../.secrets/metravel-task-board.env')
        self.assertTrue(all('/.secrets/' not in item['path'] for item in result['matches']))
        self.assertTrue(all(item['path'] in {row['path'] for row in self.catalog} for item in result['matches']))


if __name__ == '__main__':
    unittest.main(verbosity=2)
