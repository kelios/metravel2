import copy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('student', HERE / 'student.py')
student = importlib.util.module_from_spec(spec)
spec.loader.exec_module(student)


def full_profile():
    base = json.loads((HERE / 'base.json').read_text())
    metadata = json.loads((HERE / 'metadata.json').read_text())
    for family in ('agent', 'command'):
        base.setdefault(family, {}).update(metadata[family])
    return base


class StudentTests(unittest.TestCase):
    def test_code_profile_keeps_reads_and_removes_irrelevant_tools_without_mutating_source(self):
        source = full_profile()
        snapshot = copy.deepcopy(source)
        result = student.build_profile(source, 'coder', 'code')
        self.assertEqual(source, snapshot)
        self.assertEqual(result['default_agent'], student.AGENT)
        self.assertEqual(result['agent'][student.AGENT]['mode'], 'primary')
        self.assertEqual(result['agent'][student.AGENT]['steps'], 16)
        self.assertEqual(result['permission']['task'], 'deny')
        self.assertEqual(result['permission']['doom_loop'], 'deny')
        for tool in student.WRITES:
            self.assertEqual(result['permission'][tool], 'deny')
        for name in ('metravel_task_board', 'project_instructions'):
            self.assertTrue(result['mcp'][name]['enabled'])
        for name in ('metravel_knowledge', 'local_flux'):
            self.assertFalse(result['mcp'][name]['enabled'])
        self.assertEqual(result['permission']['read'], snapshot['permission']['read'])
        self.assertEqual(result['permission']['edit'], snapshot['permission']['edit'])
        self.assertEqual(result['permission']['bash'], snapshot['permission']['bash'])
        self.assertEqual(result['instructions'], snapshot['instructions'])
        self.assertEqual(result['skills'], snapshot['skills'])
        self.assertEqual(result['plugin'], snapshot['plugin'])
        self.assertIn('.claude/agents/local-model-apprentice.md', result['agent'][student.AGENT]['prompt'])

    def test_each_backend_is_loopback_only_and_all_roles_use_selected_provider(self):
        expected = {'current':18088, 'coder':18089, 'gemma':18091}
        for backend, port in expected.items():
            with self.subTest(backend=backend):
                profile = student.build_profile(full_profile(), backend)
                self.assertEqual(profile['enabled_providers'], ['local-qwen'])
                self.assertEqual(list(profile['provider']), ['local-qwen'])
                self.assertEqual(profile['provider']['local-qwen']['options']['baseURL'], f'http://127.0.0.1:{port}/v1')
                self.assertEqual(list(profile['provider']['local-qwen']['models']), ['metravel-local'])
                self.assertEqual(profile['model'], student.MODEL)
                self.assertEqual(profile['small_model'], student.MODEL)
                self.assertTrue(all(role['model'] == student.MODEL for role in profile['agent'].values()))
                options = profile['provider']['local-qwen']['models']['metravel-local'].get('options', {})
                if backend == 'gemma':
                    self.assertTrue(options['chat_template_kwargs']['enable_thinking'])
                else:
                    self.assertNotIn('chat_template_kwargs', options)

    def test_cover_mode_adds_only_flux(self):
        code = student.build_profile(full_profile(), 'current', 'code')
        cover = student.build_profile(full_profile(), 'current', 'cover')
        self.assertTrue(cover['mcp']['local_flux']['enabled'])
        cover['mcp']['local_flux']['enabled'] = False
        self.assertEqual(cover, code)

    def test_invalid_selection_and_missing_canonical_role_fail(self):
        for backend, kind in (('cloud', 'code'), ('current', 'release')):
            with self.assertRaises(ValueError):
                student.build_profile(full_profile(), backend, kind)
        source = full_profile()
        del source['agent'][student.AGENT]
        with self.assertRaises(ValueError):
            student.build_profile(source)

    def test_atomic_profile_is_ignored_task_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = student.build_profile(full_profile(), 'gemma', 'cover')
            path = student.write_profile(config, 'gemma', 'cover', root)
            self.assertEqual(path, root / '.codex-temp/local-student/gemma-cover.json')
            self.assertEqual(json.loads(path.read_text()), config)
            self.assertEqual(list(path.parent.glob('*.tmp')), [])

    def test_prompt_uses_stdin_and_exit_status_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            assignment = Path(directory) / 'assignment.txt'
            prompt = 'Run the assigned jest check; do not put this text in argv.'
            assignment.write_text(prompt)
            launcher = SimpleNamespace(CLI=assignment, profile=full_profile, ensure_server=Mock())
            args = SimpleNamespace(backend='coder', kind='code', prompt=str(assignment),
                                   write_config_only=False, title=None, session='ses_example')
            with patch.object(student, 'write_profile', return_value=Path(directory) / 'config.json'), \
                 patch.object(student, 'is_ready', return_value=True), \
                 patch.object(student, 'run_supervised', return_value=7) as run:
                self.assertEqual(student.execute(args, launcher), 7)
            command = run.call_args.args[0]
            self.assertNotIn(prompt, command)
            self.assertNotIn('--auto', command)
            self.assertEqual(command[-2:], ['--session', 'ses_example'])
            self.assertEqual(run.call_args.args[1], prompt)
            env = run.call_args.args[2]
            self.assertEqual(env['OPENCODE_DISABLE_DEFAULT_PLUGINS'], 'true')
            self.assertEqual(json.loads(env['OPENCODE_CONFIG_CONTENT'])['permission']['task'], 'deny')
            launcher.ensure_server.assert_not_called()

    def test_alternate_not_ready_never_starts_current_or_falls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            assignment = Path(directory) / 'assignment.txt'
            assignment.write_text('Read the task.')
            launcher = SimpleNamespace(CLI=assignment, profile=full_profile, ensure_server=Mock())
            args = SimpleNamespace(backend='gemma', kind='code', prompt=str(assignment),
                                   write_config_only=False, title=None, session=None)
            with patch.object(student, 'write_profile', return_value=Path(directory) / 'config.json'), \
                 patch.object(student, 'is_ready', return_value=False), \
                 patch.object(student, 'run_supervised') as run:
                with self.assertRaisesRegex(RuntimeError, '18091.*No fallback'):
                    student.execute(args, launcher)
            launcher.ensure_server.assert_not_called()
            run.assert_not_called()

    def test_current_reuses_existing_service_guard_and_config_only_never_starts_it(self):
        with tempfile.TemporaryDirectory() as directory:
            assignment = Path(directory) / 'assignment.txt'
            assignment.write_text('Read the task.')
            launcher = SimpleNamespace(CLI=assignment, profile=full_profile, ensure_server=Mock())
            args = SimpleNamespace(backend='current', kind='code', prompt=str(assignment),
                                   write_config_only=False, title=None, session=None)
            with patch.object(student, 'write_profile', return_value=Path(directory) / 'config.json'), \
                 patch.object(student, 'run_supervised', return_value=0):
                self.assertEqual(student.execute(args, launcher), 0)
            launcher.ensure_server.assert_called_once()
            launcher.ensure_server.reset_mock()
            args.write_config_only = True
            with patch.object(student, 'write_profile', return_value=Path(directory) / 'config.json'), \
                 patch.object(student, 'run_supervised') as run, patch('builtins.print'):
                self.assertEqual(student.execute(args, launcher), 0)
            launcher.ensure_server.assert_not_called()
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
