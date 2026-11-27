import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('student', HERE / 'student.py')
student = importlib.util.module_from_spec(spec)
spec.loader.exec_module(student)


def lookup(call, tool='glob', value=None, status='completed'):
    return {'type':'tool_use', 'sessionID':'ses_one', 'part':{
        'callID':str(call), 'messageID':f'message_{call}', 'tool':tool,
        'state':{'status':status, 'input':value if value is not None else {'pattern':'*.tsx'}}}}


class WatchdogTests(unittest.TestCase):
    def run_fake(self, source, prompt='assignment via stdin', **kwargs):
        output, error = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / 'fake_cli.py'
            script.write_text(source)
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(error):
                code = student.run_supervised([sys.executable, str(script)], prompt, dict(os.environ),
                                              directory, grace_seconds=0.1, **kwargs)
        return code, output.getvalue(), error.getvalue()

    def test_finite_process_receives_stdin_and_preserves_raw_lines_and_exit(self):
        source = "import sys,json\nprompt=sys.stdin.read()\nprint(json.dumps({'type':'receipt','input':prompt,'argv':sys.argv[1:]}),flush=True)\nprint('  {\"type\": \"text\", \"part\": {\"text\": \"done\"}}  ',flush=True)\nsys.exit(7)\n"
        code, output, error = self.run_fake(source, prompt='Read the assigned file.\nZażółć.')
        self.assertEqual(code, 7)
        receipt = json.loads(output.splitlines()[0])
        self.assertEqual(receipt['input'], 'Read the assigned file.\nZażółć.')
        self.assertEqual(receipt['argv'], [])
        self.assertTrue(output.endswith('  {"type": "text", "part": {"text": "done"}}  \n'))
        self.assertNotIn('budget_stop', output)
        self.assertEqual(error, '')

    def test_third_identical_lookup_across_messages_stops_even_if_cli_exits_zero(self):
        events = [lookup(1), lookup(2, status='error'), lookup(3)]
        source = f'import sys\nsys.stdin.read()\nfor line in {json.dumps([json.dumps(x) for x in events])}: print(line,flush=True)\n'
        code, output, error = self.run_fake(source)
        rows = [json.loads(line) for line in output.splitlines()]
        self.assertEqual(code, 124)
        self.assertEqual(rows[:-1], events)
        self.assertEqual(rows[-1]['reason'], 'repeated_lookup')
        self.assertEqual(rows[-1]['counts'], {'steps':0,'tools':3,'same_lookup':3})
        self.assertIn('Partial events preserved', error)

    def test_distinct_inputs_and_intervening_edit_or_test_reset_the_lookup_sequence(self):
        budget = student.EventBudget()
        events = [lookup(1, 'read', {'filePath':'a'}), lookup(2, 'read', {'filePath':'a'}),
                  lookup(3, 'read', {'filePath':'b'}), lookup(4, 'read', {'filePath':'a'}),
                  lookup(5, 'edit', {'filePath':'a','newString':'fixed'}),
                  lookup(6, 'read', {'filePath':'a'}), lookup(7, 'read', {'filePath':'a'}),
                  lookup(8, 'bash', {'command':'node --test assigned.test.mjs'}),
                  lookup(9, 'read', {'filePath':'a'})]
        self.assertTrue(all(budget.observe(json.dumps(event)) is None for event in events))
        self.assertEqual(budget.counts(), {'steps':0,'tools':9,'same_lookup':1})

    def test_duplicate_terminal_event_for_one_call_is_not_three_invocations(self):
        budget = student.EventBudget()
        event = json.dumps(lookup('same-call'))
        self.assertEqual([budget.observe(event) for _ in range(3)], [None,None,None])
        self.assertEqual(budget.tools, 1)
        self.assertEqual(budget.same_lookup, 1)

    def test_reused_provider_call_id_in_distinct_messages_still_counts(self):
        budget = student.EventBudget()
        results = []
        for message in range(3):
            event = lookup('call_0')
            event['part']['messageID'] = f'message_{message}'
            results.append(budget.observe(json.dumps(event)))
        self.assertEqual(results, [None, None, 'repeated_lookup'])
        self.assertEqual(budget.tools, 3)

    def test_seventeenth_step_is_a_hard_stop_in_the_wrapper(self):
        event = json.dumps({'type':'step_start','part':{'type':'step-start'}})
        source = f'import sys\nsys.stdin.read()\nfor _ in range(17): print({event!r},flush=True)\n'
        code, output, _ = self.run_fake(source)
        rows = [json.loads(line) for line in output.splitlines()]
        self.assertEqual(code, 124)
        self.assertEqual(rows[-1]['type'], 'budget_stop')
        self.assertEqual(rows[-1]['reason'], 'step_limit')
        self.assertEqual(rows[-1]['counts']['steps'], 17)

    def test_deadline_kills_its_term_ignoring_descendant_but_not_an_unrelated_process(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / 'orphan-was-alive'
            child = ("import signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);"
                     f"time.sleep(0.8);pathlib.Path({str(marker)!r}).write_text('bad');time.sleep(30)")
            source = ("import sys,subprocess,json,time\nsys.stdin.read()\n"
                      f"child=subprocess.Popen([sys.executable,'-c',{child!r}])\n"
                      "print(json.dumps({'type':'child','pid':child.pid}),flush=True)\ntime.sleep(30)\n")
            unrelated = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(30)'])
            try:
                started = time.monotonic()
                code, output, _ = self.run_fake(source, deadline_seconds=0.25)
                self.assertLess(time.monotonic() - started, 2)
                rows = [json.loads(line) for line in output.splitlines()]
                self.assertEqual(code, 124)
                self.assertEqual(rows[-1]['reason'], 'deadline')
                self.assertIsNone(unrelated.poll())
                time.sleep(0.85)
                self.assertFalse(marker.exists(), 'owned descendant survived the deadline')
                status = subprocess.run(['ps','-p',str(rows[0]['pid']),'-o','stat='], capture_output=True, text=True)
                self.assertTrue(not status.stdout.strip() or status.stdout.strip().startswith('Z'),
                                'owned descendant is still running')
            finally:
                unrelated.terminate()
                unrelated.wait(timeout=2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
