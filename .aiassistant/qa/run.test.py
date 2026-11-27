import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('qa_runner', HERE / 'run.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def original_profile():
    source = json.loads((HERE.parent / 'universal/base.json').read_text())
    source['agent'].update(json.loads((HERE.parent / 'universal/metadata.json').read_text())['agent'])
    source['provider']['cloud-example'] = {'models': {}}
    source['enabled_providers'].append('cloud-example')
    return source


def tool(name, output, arguments=None, **state):
    return {'type': 'tool_use', 'part': {'tool': name, 'callID': 'call',
            'state': {'status': 'completed', 'input': arguments or {}, 'output': output, **state}}}


def report(url, evidence):
    return {'cases': [{'name': 'Open search', 'kind': 'functional', 'status': 'PASS', 'actions': ['browser_navigate'],
                       'observed_url': url, 'expected': 'Search is open', 'actual': 'Search page observed',
                       'evidence_files': [evidence]}], 'suspicions': [], 'not_tested': [],
            'images_received': [], 'next_pass': 'Filters'}


def finish(inventory, data, reason='stop', message_id='final'):
    inventory.observe(json.dumps({'type': 'text', 'part': {'messageID': message_id, 'text': json.dumps(data)}}))
    inventory.observe(json.dumps({'type': 'step_finish', 'part': {'messageID': message_id, 'reason': reason}}))


class ConfigTests(unittest.TestCase):
    def test_local_only_permissions_and_source_immutability(self):
        original = original_profile()
        snapshot = copy.deepcopy(original)
        root = qa.ROOT
        output = root / '.codex-temp/local-web-qa/unit-fixture'
        config, browser = qa.build_configs(original, output, 'mobile', Path('/installed/chromium'))
        self.assertEqual(original, snapshot)
        self.assertEqual(config['enabled_providers'], ['local-qwen'])
        self.assertEqual(list(config['provider']), ['local-qwen'])
        provider = config['provider']['local-qwen']
        self.assertEqual(provider['options']['baseURL'], 'http://127.0.0.1:18091/v1')
        model = provider['models']['metravel-local']
        self.assertTrue(model['attachment'])
        self.assertIn('image', model['modalities']['input'])
        self.assertFalse(model['options']['chat_template_kwargs']['enable_thinking'])
        self.assertEqual(list(config['agent']), ['local-web-qa'])
        self.assertEqual(list(config['mcp']), ['browser'])
        permissions = config['permission']
        self.assertEqual(permissions['*'], 'deny')
        for forbidden in ('bash', 'edit', 'task', 'browser_browser_evaluate', 'browser_browser_run_code_unsafe',
                          'browser_browser_resize', 'browser_browser_route', 'browser_browser_cookie_set'):
            self.assertNotIn(forbidden, permissions)
        self.assertEqual(permissions['read']['*'], 'deny')
        self.assertEqual(permissions['read'][str(output) + '/**'], 'allow')
        self.assertEqual(browser['capabilities'], ['core', 'vision'])
        self.assertFalse(browser['webmcp'])
        self.assertEqual(browser['browser']['contextOptions']['serviceWorkers'], 'block')
        self.assertEqual(browser['outputDir'], str(output / 'browser'))
        self.assertTrue(config['plugin'][0].endswith('/.aiassistant/qa/read-guard.mjs'))

    def test_desktop_has_a_fresh_real_desktop_context_not_a_resized_mobile_context(self):
        output = qa.ROOT / '.codex-temp/local-web-qa/unit-fixture'
        config, browser = qa.build_configs(original_profile(), output, 'desktop', Path('/installed/chromium'))
        context = browser['browser']['contextOptions']
        self.assertEqual(context['viewport'], {'width': 1440, 'height': 900})
        self.assertFalse(context['isMobile'])
        self.assertFalse(context['hasTouch'])
        self.assertTrue(browser['browser']['isolated'])
        self.assertEqual(config['agent']['local-web-qa']['steps'], 24)

    def test_output_is_unique_and_cannot_escape_through_a_symlink(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as elsewhere:
            root = Path(directory).resolve()
            first, second = qa.new_output(root), qa.new_output(root)
            self.assertNotEqual(first, second)
            self.assertTrue(first.is_relative_to(root / '.codex-temp/local-web-qa'))
            for child in (first, second):
                child.rmdir()
            (root / '.codex-temp/local-web-qa').rmdir()
            (root / '.codex-temp').rmdir()
            (root / '.codex-temp').symlink_to(elsewhere, target_is_directory=True)
            with self.assertRaises(ValueError):
                qa.new_output(root)
            self.assertEqual(list(Path(elsewhere).iterdir()), [])

    def test_candidate_keeps_browser_authority_and_selects_only_its_local_endpoint(self):
        output = qa.ROOT / '.codex-temp/local-web-qa/unit-fixture'
        original = original_profile()
        baseline, browser = qa.build_configs(original, output, 'mobile', Path('/installed/chromium'))
        candidate, candidate_browser = qa.build_configs(original, output, 'mobile', Path('/installed/chromium'),
                                                        backend='qwen-vl')
        self.assertEqual(candidate_browser, browser)
        for key in ('permission', 'mcp', 'agent', 'instructions'):
            self.assertEqual(candidate[key], baseline[key])
        provider = candidate['provider']['local-qwen']
        self.assertEqual(provider['options']['baseURL'], 'http://127.0.0.1:18092/v1')
        self.assertEqual(candidate['enabled_providers'], ['local-qwen'])
        self.assertEqual(provider['models']['metravel-local']['limit'],
                         baseline['provider']['local-qwen']['models']['metravel-local']['limit'])
        for unsupported in ('current', 'coder', 'cloud', 'unknown'):
            with self.assertRaises(ValueError):
                qa.build_configs(original, output, 'mobile', Path('/installed/chromium'), backend=unsupported)

    def test_output_cannot_follow_a_symlink_into_tracked_paths_even_inside_the_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            tracked = root / 'app'
            tracked.mkdir()
            (root / '.codex-temp').symlink_to(tracked, target_is_directory=True)
            with self.assertRaises(ValueError):
                qa.new_output(root)
            self.assertEqual(list(tracked.iterdir()), [])

    def test_runtime_requires_the_own_canonical_parent_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            owner = root / '.codex-temp/ops/quality-gate.lock/owner.json'
            owner.parent.mkdir(parents=True)
            owner.write_text(json.dumps({'pid': 22, 'name': 'local-browser-qa'}))
            qa.require_quality_owner(root, parent_pid=22)
            with self.assertRaises(RuntimeError):
                qa.require_quality_owner(root, parent_pid=23)
            owner.write_text(json.dumps({'pid': 22, 'name': 'another-operation'}))
            with self.assertRaises(RuntimeError):
                qa.require_quality_owner(root, parent_pid=22)

    def test_pinned_dependency_and_prompt_prerequisites_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            node, mcp = root / 'node', root / 'mcp'
            node.touch()
            mcp.mkdir()
            (mcp / 'package.json').write_text(json.dumps({'version': '0.0.86'}))
            qa.runtime_dependencies(mcp, node)
            (mcp / 'package.json').write_text(json.dumps({'version': 'unreviewed'}))
            with self.assertRaises(RuntimeError):
                qa.runtime_dependencies(mcp, node)
            outside = root / 'assignment.txt'
            outside.write_text('safe text')
            with self.assertRaises(ValueError):
                qa.read_assignment(outside, root)
            assignment = root / '.codex-temp/qa/assignment.txt'
            assignment.parent.mkdir(parents=True)
            assignment.write_text('Run a bounded case.')
            self.assertEqual(qa.read_assignment(assignment, root), 'Run a bounded case.')
            assignment.write_text('x' * 16385)
            with self.assertRaises(ValueError):
                qa.read_assignment(assignment, root)
        with self.assertRaises(ValueError):
            qa.prompt_text('x' * 2001, 'mobile')

    def test_config_only_does_not_probe_or_run_the_model(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            reference = output / 'reference.md'
            reference.touch()
            cli = output / 'opencode'
            cli.touch()
            launcher = SimpleNamespace(CLI=cli, profile=original_profile)
            args = SimpleNamespace(config_only=True, backend='gemma', viewport='mobile', scope='Navigation', prompt=None)
            with patch.object(qa, 'runtime_dependencies'), patch.object(qa, 'REFERENCE', reference), \
                 patch.object(qa, 'new_output', return_value=output), \
                 patch.object(qa, 'browser_executable', return_value=Path('/installed/chromium')), \
                 patch.object(qa, 'build_configs', return_value=({}, {})), \
                 patch.object(qa.student, 'load_launcher', return_value=launcher), \
                 patch.object(qa.student, 'is_ready') as ready, \
                 patch.object(qa.student, 'run_supervised') as run, \
                 contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(qa.execute(args), 0)
            ready.assert_not_called()
            run.assert_not_called()

    def test_execution_retains_the_quality_owner_budget_and_an_unaccepted_structural_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            reference, cli = output / 'reference.md', output / 'opencode'
            reference.touch()
            cli.touch()
            (output / 'state.yml').write_text('Observed page')
            launcher = SimpleNamespace(CLI=cli, profile=original_profile)
            args = SimpleNamespace(config_only=False, backend='qwen-vl', viewport='mobile', scope='Navigation', prompt=None)
            def fake_run(command, prompt, env, cwd, **limits):
                self.assertEqual(env['LOCAL_QA_OUTPUT'], str(output))
                self.assertEqual(limits, {'max_steps':24, 'deadline_seconds':600, 'grace_seconds':16})
                print(json.dumps(tool('browser_browser_navigate', '- Page URL: https://metravel.by/')))
                print(json.dumps({'type':'text','part':{'messageID':'final','text':json.dumps(report('https://metravel.by/', 'state.yml'))}}))
                print(json.dumps({'type':'step_finish','part':{'messageID':'final','reason':'stop'}}))
                return 0
            with patch.object(qa, 'require_quality_owner') as ownership, \
                 patch.object(qa, 'runtime_dependencies'), patch.object(qa, 'REFERENCE', reference), \
                 patch.object(qa, 'new_output', return_value=output), \
                 patch.object(qa, 'browser_executable', return_value=Path('/installed/chromium')), \
                 patch.object(qa, 'build_configs', return_value=({}, {})), \
                 patch.object(qa.student, 'load_launcher', return_value=launcher), \
                 patch.object(qa.student, 'is_ready', return_value=True), \
                 patch.object(qa.student, 'environment', return_value={}), \
                 patch.object(qa.student, 'run_supervised', side_effect=fake_run), \
                 contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(qa.execute(args), 0)
            ownership.assert_called_once()
            receipt = json.loads((output / 'receipt.json').read_text())
            self.assertEqual(receipt['site_verdict'], 'NOT_EVALUATED')
            self.assertTrue(receipt['teacher_review_required'])
            self.assertEqual(receipt['completion'], 'report_ready_for_review')
            self.assertEqual(receipt['backend'], 'qwen-vl')
            self.assertEqual(receipt['endpoint'], 'http://127.0.0.1:18092/v1')


class ReceiptTests(unittest.TestCase):
    def test_visual_case_requires_its_png_to_be_read_with_an_image_attachment(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            image = output / 'screen.png'
            image.write_bytes(b'png fixture')
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '- Page URL: https://metravel.by/')))
            data = report('https://metravel.by/', 'screen.png')
            data['cases'][0]['kind'] = 'visual'
            inventory.observe(json.dumps(tool('read', 'file path only', {'filePath': str(image)})))
            finish(inventory, data)
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            self.assertIn('case_0:visual_input_not_established', result['mechanical_warnings'])
            inventory.observe(json.dumps(tool('read', 'Image read successfully', {'filePath': str(image)},
                                               attachments=[{'mime': 'image/png', 'url': 'not-retained'}])))
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'report_ready_for_review')
            self.assertEqual(result['site_verdict'], 'NOT_EVALUATED')
            self.assertEqual(result['vision']['provider_delivery'], 'not_verified_by_this_receipt')

    def test_partial_schema_and_a_pending_page_observation_are_incomplete(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'state.yml').touch()
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '- Page URL: https://metravel.by/', status='running')))
            data = report('https://metravel.by/', 'state.yml')
            del data['next_pass']
            data['cases'][0]['actions'] = 'not an action list'
            finish(inventory, data)
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            for warning in ('invalid_next_pass', 'case_0:missing_observation', 'case_0:url_not_observed_by_browser'):
                self.assertIn(warning, result['mechanical_warnings'])

    def test_not_tested_has_a_reason_but_needs_no_fabricated_url_or_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = qa.receipts.EvidenceInventory()
            data = report('', '')
            data['cases'][0].update(status='NOT_TESTED', actions=[], evidence_files=[],
                                    actual='Not tested: a policy boundary stopped the navigation.')
            finish(inventory, data)
            result, _ = inventory.finish(directory, 0)
            self.assertEqual(result['completion'], 'report_ready_for_review')
            self.assertEqual(result['site_verdict'], 'NOT_EVALUATED')
            del data['cases'][0]['expected']
            finish(inventory, data, message_id='missing-expected')
            result, _ = inventory.finish(directory, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            self.assertIn('case_0:missing_observation', result['mechanical_warnings'])

    def test_complete_draft_remains_not_evaluated_and_does_not_claim_provider_vision(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'search.yml').write_text('real observed state')
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '### Page\n- Page URL: https://metravel.by/search?search=%D0%91%D0%BB%D0%B5%D0%B4')))
            inventory.observe(json.dumps(tool('read', 'image', {'filePath': str(output / 'screen.png')},
                                               attachments=[{'mime': 'image/png', 'url': 'secret_image_data'}])))
            finish(inventory, report('https://metravel.by/search?search=Блед', 'search.yml'))
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'report_ready_for_review')
            self.assertEqual(result['site_verdict'], 'NOT_EVALUATED')
            self.assertTrue(result['teacher_review_required'])
            self.assertEqual(result['vision']['image_attachments_in_events'], 1)
            self.assertEqual(result['vision']['provider_delivery'], 'not_verified_by_this_receipt')
            self.assertNotIn('secret_image_data', json.dumps(result))

    def test_invented_navigation_and_artifact_labels_cannot_be_a_complete_report(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '### Page\n- Page URL: https://metravel.by/')))
            finish(inventory, report('https://metravel.by/travels/never-visited', 'travel_page_snapshot'))
            result, _ = inventory.finish(directory, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            self.assertIn('case_0:url_not_observed_by_browser', result['mechanical_warnings'])
            self.assertIn('case_0:evidence_file_missing', result['mechanical_warnings'])

    def test_real_search_control_does_not_validate_an_unperformed_travel_transition(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'search.yml').write_text('Observed search page with a Bled result link.')
            inventory = qa.receipts.EvidenceInventory()
            for url in ('https://metravel.by/', 'https://metravel.by/search?search=Bled'):
                inventory.observe(json.dumps(tool('browser_browser_navigate', '- Page URL: ' + url)))
            data = report('https://metravel.by/search?search=Bled', 'search.yml')
            finish(inventory, data)
            healthy, _ = inventory.finish(output, 0)
            self.assertEqual(healthy['completion'], 'report_ready_for_review')
            self.assertEqual(healthy['site_verdict'], 'NOT_EVALUATED')
            invented = dict(data['cases'][0], name='Open travel result',
                            observed_url='https://metravel.by/travels/bled',
                            actions=['clicked the travel result'], actual='Travel detail loaded.')
            data['cases'].append(invented)
            finish(inventory, data, message_id='second-final')
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            self.assertEqual(result['mechanical_warnings'], ['case_1:url_not_observed_by_browser'])

    def test_stream_failure_and_invalid_url_types_cannot_become_a_site_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'state.yml').touch()
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '- Page URL: https://metravel.by/')))
            data = report({'malformed': 'url'}, 'state.yml')
            finish(inventory, data)
            inventory.observe(json.dumps({'type': 'error', 'error': {'message': 'provider failed'}}))
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'runtime_error')
            self.assertEqual(result['stream_errors'], 1)
            self.assertIn('case_0:invalid_observed_url', result['mechanical_warnings'])

    def test_evidence_outside_the_batch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            output = root / 'batch'
            output.mkdir()
            (root / 'outside.yml').write_text('do not use')
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps(tool('browser_browser_navigate', '- Page URL: https://metravel.by/')))
            finish(inventory, report('https://metravel.by/', '../outside.yml'))
            result, _ = inventory.finish(output, 0)
            self.assertIn('case_0:evidence_outside_batch', result['mechanical_warnings'])
            finish(inventory, report('https://metravel.by/', '\x00invalid'), message_id='invalid-file')
            result, _ = inventory.finish(output, 0)
            self.assertEqual(result['completion'], 'incomplete_report')
            self.assertIn('case_0:invalid_evidence_path', result['mechanical_warnings'])

    def test_plan_only_length_and_budget_are_incomplete_even_with_cli_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = qa.receipts.EvidenceInventory()
            inventory.observe(json.dumps({'type': 'text', 'part': {'messageID': 'plan', 'text': 'I will test everything.'}}))
            inventory.observe(json.dumps({'type': 'step_finish', 'part': {'messageID': 'final', 'reason': 'length'}}))
            result, _ = inventory.finish(directory, 0)
            self.assertEqual(result['completion'], 'incomplete_length')
            self.assertIn('missing_complete_final_response', result['mechanical_warnings'])
            inventory.observe(json.dumps({'type': 'budget_stop', 'reason': 'deadline'}))
            result, _ = inventory.finish(directory, 124)
            self.assertEqual(result['completion'], 'budget_stop')
            self.assertEqual(result['runtime_exit_code'], 124)

    def test_tee_preserves_raw_text_and_parses_events_split_between_writes(self):
        destination, terminal = io.StringIO(), io.StringIO()
        inventory = qa.receipts.EvidenceInventory()
        tee = qa.receipts.EventTee(destination, terminal, inventory)
        raw = '  {"type":"step_start","part":{}}\n'
        tee.write(raw[:12])
        tee.write(raw[12:])
        tee.flush()
        self.assertEqual(destination.getvalue(), raw)
        self.assertEqual(terminal.getvalue(), raw)
        self.assertEqual(inventory.steps, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
