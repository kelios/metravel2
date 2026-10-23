"""Exercise the real observer against LLDB doubles; never attaches to a target."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest


ENTRY = 0x100751830
INVALID = (1 << 64) - 1
SELF = 0x1111
MESSAGE = 0x3333


class Error:
    def __init__(self, failed=False):
        self.failed = failed

    def Fail(self):
        return self.failed

    def Success(self):
        return not self.failed

    def GetType(self):
        return 1

    def GetError(self):
        return 7 if self.failed else 0

    def GetCString(self):
        return 'private bridge body and injected script must never be logged'


class Address:
    def __init__(self, address):
        self.address = address

    def GetLoadAddress(self, _target):
        return self.address


class Symbol:
    def __init__(self, address=ENTRY, valid=True):
        self.address, self.valid = address, valid

    def IsValid(self):
        return self.valid

    def GetStartAddress(self):
        return Address(self.address)


class Breakpoint:
    def __init__(self, address):
        self.address = address

    def GetNumLocations(self):
        return 1

    def GetLocationAtIndex(self, _index):
        return SimpleNamespace(GetAddress=lambda: Address(self.address))

    def SetScriptCallbackFunction(self, _name):
        pass

    def GetID(self):
        return 1


class Frame:
    def __init__(self, pc=ENTRY, payload=None, fail_at=None):
        self.pc = pc
        self.registers = {'x0': SELF, 'x3': MESSAGE}
        self.payload = payload or {'type': 'READY'}
        self.fail_at = fail_at
        self.expressions = []
        self.operations = []

    def GetPC(self):
        return self.pc

    def FindRegister(self, name):
        self.operations.append(name)
        value = self.registers[name]
        return SimpleNamespace(GetValueAsUnsigned=lambda _default: value,
                               GetValue=lambda: hex(value))

    def EvaluateExpression(self, expression):
        self.operations.append('evaluate')
        self.expressions.append(expression)
        # Target expressions need not preserve the argument registers. The
        # receiver for the second expression must still be the original self.
        self.registers.update(x0=0xAAAA, x3=0xBBBB)
        return SimpleNamespace(GetError=lambda: Error(len(self.expressions) == self.fail_at),
                               GetObjectDescription=lambda: json.dumps(self.payload))


class Process:
    def __init__(self, observer, frame=None):
        self.observer, self.frame = observer, frame
        self.state = 'stopped'
        self.detaches = 0
        self.continues = 0
        self.stop_fails = False
        self.detach_fails = False

    def GetBroadcaster(self):
        return self

    def Continue(self):
        self.continues += 1
        self.state = 'running'
        if self.frame and self.observer.callback(self.frame, None, None, None):
            self.state = 'stopped'
        return Error()

    def GetState(self):
        return self.state

    def Stop(self):
        if not self.stop_fails:
            self.state = 'stopped'
        return Error(self.stop_fails)

    def Detach(self):
        self.detaches += 1
        self.state = 'detached'
        return Error(self.detach_fails)


class Target:
    def __init__(self, process):
        self.process = process
        self.symbols = [Symbol()]
        self.address_breakpoints = []
        self.name_breakpoints = []
        self.breakpoint_offset = 0
        self.deleted = []

    def GetProcess(self):
        return self.process

    def GetTriple(self):
        return 'arm64-apple-ios-simulator'

    def FindSymbols(self, name, _kind):
        if name != '-[RNCWebViewImpl userContentController:didReceiveScriptMessage:]':
            raise AssertionError('Observer resolved another callback')
        return SimpleNamespace(GetSize=lambda: len(self.symbols),
                               GetContextAtIndex=lambda index: SimpleNamespace(GetSymbol=lambda: self.symbols[index]))

    def BreakpointCreateByName(self, name):
        # This is the actual optimized candidate's default prologue skipping.
        self.name_breakpoints.append(name)
        return Breakpoint(ENTRY + 0x40)

    def BreakpointCreateByAddress(self, address):
        self.address_breakpoints.append(address)
        return Breakpoint(address + self.breakpoint_offset)

    def BreakpointDelete(self, breakpoint_id):
        self.deleted.append(breakpoint_id)
        return True


class ObserverTests(unittest.TestCase):
    def setUp(self):
        scratch = Path(__file__).resolve().parents[2] / '.codex-temp'
        scratch.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix='native-map-unit-', dir=scratch)
        self.addCleanup(self.directory.cleanup)
        self.out = Path(self.directory.name)
        self.lldb = SimpleNamespace(LLDB_INVALID_ADDRESS=INVALID, eSymbolTypeCode=2,
                                    eStateRunning='running', eStateStopped='stopped',
                                    eStateExited='exited', eStateDetached='detached', eStateCrashed='crashed')
        sys.modules['lldb'] = self.lldb
        spec = importlib.util.spec_from_file_location('observer_under_test', Path(__file__).with_name('lldb_probe.py'))
        self.observer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.observer)
        self.process = Process(self.observer)
        self.target = Target(self.process)
        self.lldb.debugger = SimpleNamespace(GetSelectedTarget=lambda: self.target, SetAsync=lambda _enabled: None)
        self.lldb.SBProcess = SimpleNamespace(eBroadcastBitStateChanged=1,
                                              GetStateFromEvent=lambda event: event.state,
                                              GetRestartedFromEvent=lambda _event: False)
        self.lldb.SBEvent = SimpleNamespace

        def wait_for_event(_seconds, event):
            event.state = self.process.state
            return True

        self.lldb.SBListener = lambda _name: SimpleNamespace(StartListeningForEvents=lambda *_args: None,
                                                             WaitForEvent=wait_for_event)
        self.config = dict(output=str(self.out / 'samples'), ready=str(self.out / 'ready'),
                           stop=str(self.out / 'stop'), finished=str(self.out / 'finished.json'),
                           seconds=0, nonce='test-nonce', script='read-only observer')
        self.config_path = self.out / 'config.json'

    def run_observer(self, seconds=0):
        self.config['seconds'] = seconds
        self.config_path.write_text(json.dumps(self.config))
        self.observer.run(str(self.config_path))

    def receipt(self):
        return json.loads(Path(self.config['finished']).read_text())

    def prepare_callback(self):
        probe = dict(self.config, entry=ENTRY, stream=io.StringIO(), sampled=False,
                     injected_at=0, receiver=None, cleaned=False, error=None, phase='attached')
        self.observer._probe = probe
        return probe

    def callback(self, frame):
        return self.observer.callback(frame, None, None, None)

    def test_breakpoint_uses_symbol_entry_instead_of_skipped_prologue(self):
        self.run_observer()
        self.assertEqual(self.target.address_breakpoints, [ENTRY])
        self.assertEqual(self.target.name_breakpoints, [])
        self.assertEqual(self.target.deleted, [1])
        self.assertTrue(self.receipt()['completed'])
        self.assertTrue(self.receipt()['detached'])

    def test_prologue_skipped_callback_stops_before_any_target_expression(self):
        self.prepare_callback()
        frame = Frame(pc=ENTRY + 0x40)
        self.assertTrue(self.callback(frame))
        self.assertEqual(frame.operations, [])
        self.assertIn('callback-entry', self.observer._probe['error'])

    def test_argument_pointers_survive_expression_register_mutation(self):
        self.prepare_callback()
        frame = Frame()
        self.assertFalse(self.callback(frame))
        self.assertEqual(frame.operations, ['x0', 'x3', 'evaluate', 'evaluate'])
        self.assertEqual(frame.expressions[0], '(id)[(id)0x3333 body]')
        self.assertIn('(id)0x1111 valueForKey:@"webView"', frame.expressions[1])
        self.assertEqual(self.observer._probe['receiver'], SELF)

    def test_ambiguous_or_invalid_symbol_fails_before_resume_and_detaches(self):
        for symbols in [[], [Symbol(), Symbol(ENTRY + 0x100)], [Symbol(valid=False)],
                        [Symbol(INVALID)], [Symbol(0)]]:
            with self.subTest(symbols=symbols):
                self.target.symbols = symbols
                Path(self.config['finished']).unlink(missing_ok=True)
                with self.assertRaises(RuntimeError):
                    self.run_observer()
                self.assertEqual(self.target.address_breakpoints, [])
                self.assertEqual(self.process.continues, 0)
                self.assertFalse(self.receipt()['completed'])
                self.assertTrue(self.receipt()['detached'])
                self.assertTrue(self.receipt()['error'])

    def test_relocated_breakpoint_is_rejected_before_resume(self):
        self.target.breakpoint_offset = 0x40
        with self.assertRaisesRegex(RuntimeError, 'exact callback entry'):
            self.run_observer()
        self.assertEqual(self.process.continues, 0)
        self.assertEqual(self.target.deleted, [1])
        self.assertFalse(self.receipt()['completed'])
        self.assertTrue(self.receipt()['detached'])

    def test_invalid_argument_pointers_do_not_execute_expressions(self):
        for register, value in [('x0', 0), ('x0', INVALID), ('x3', 0), ('x3', INVALID)]:
            with self.subTest(register=register, value=value):
                self.prepare_callback()
                frame = Frame()
                frame.registers[register] = value
                self.assertTrue(self.callback(frame))
                self.assertEqual(frame.expressions, [])

    def test_expression_failures_stop_without_retry_or_private_diagnostics(self):
        for fail_at, phase in [(1, 'message-body'), (2, 'observer-inject')]:
            with self.subTest(phase=phase):
                probe = self.prepare_callback()
                frame = Frame(fail_at=fail_at)
                self.assertTrue(self.callback(frame))
                self.assertTrue(self.callback(frame))
                self.assertEqual(len(frame.expressions), fail_at)
                self.assertEqual(probe['error'], phase + ' failed (LLDB type=1 code=7)')

    def test_stop_uses_frozen_receiver_and_requires_success(self):
        for fail_at in [None, 2]:
            with self.subTest(fail_at=fail_at):
                probe = self.prepare_callback()
                Path(probe['stop']).touch()
                frame = Frame(payload={'type': 'METRAVEL_QA_MAP_SNAPSHOT', 'nonce': 'test-nonce'}, fail_at=fail_at)
                self.assertEqual(self.callback(frame), fail_at == 2)
                self.assertIn('(id)0x1111 valueForKey:@"webView"', frame.expressions[1])
                self.assertEqual(probe['cleaned'], fail_at is None)
                if fail_at:
                    self.assertTrue(self.callback(frame))
                    self.assertEqual(len(frame.expressions), 2)

    def test_missing_snapshot_does_not_repeat_injection_without_new_ready(self):
        probe = self.prepare_callback()
        first = Frame()
        self.assertFalse(self.callback(first))
        probe['injected_at'] -= 10  # Even after the old retry interval elapsed.
        unrelated = Frame(payload={'type': 'UNRELATED'})
        self.assertFalse(self.callback(unrelated))
        self.assertEqual(len(first.expressions), 2)
        self.assertEqual(len(unrelated.expressions), 1)

    def test_only_nonce_matched_snapshot_is_written(self):
        probe = self.prepare_callback()
        probe.update(receiver=SELF, sampled=True)
        for nonce in ['unrelated', 'test-nonce']:
            frame = Frame(payload={'type': 'METRAVEL_QA_MAP_SNAPSHOT', 'nonce': nonce})
            self.assertFalse(self.callback(frame))
        self.assertEqual([json.loads(line)['nonce'] for line in probe['stream'].getvalue().splitlines()], ['test-nonce'])

    def test_failed_expression_has_failed_receipt_and_positive_detach(self):
        self.process.frame = Frame(fail_at=2)
        with self.assertRaisesRegex(RuntimeError, 'observer-inject failed'):
            self.run_observer(seconds=1)
        self.assertEqual(self.process.detaches, 1)
        self.assertEqual(self.target.deleted, [1])
        self.assertEqual(len(self.process.frame.expressions), 2)
        receipt = self.receipt()
        self.assertFalse(receipt['completed'])
        self.assertTrue(receipt['detached'])
        self.assertEqual(receipt['phase'], 'observer-inject')
        self.assertEqual(receipt['error'], 'observer-inject failed (LLDB type=1 code=7)')

    def test_cleanup_stop_failure_still_detaches_with_failed_receipt(self):
        self.process.stop_fails = True
        with self.assertRaisesRegex(RuntimeError, 'safe detach'):
            self.run_observer()
        self.assertEqual(self.process.detaches, 1)
        self.assertFalse(self.receipt()['completed'])
        self.assertTrue(self.receipt()['detached'])

    def test_unsupported_abi_detaches_without_breakpoint_or_resume(self):
        self.target.GetTriple = lambda: 'x86_64-apple-ios-simulator'
        with self.assertRaisesRegex(RuntimeError, 'arm64'):
            self.run_observer()
        self.assertEqual(self.target.address_breakpoints, [])
        self.assertEqual(self.process.continues, 0)
        self.assertFalse(self.receipt()['completed'])
        self.assertTrue(self.receipt()['detached'])

    def test_failed_detach_has_negative_receipt_despite_completed_observation(self):
        self.process.detach_fails = True
        with self.assertRaisesRegex(RuntimeError, 'detach failed'):
            self.run_observer()
        self.assertEqual(self.process.detaches, 1)
        self.assertTrue(self.receipt()['completed'])
        self.assertFalse(self.receipt()['detached'])


if __name__ == '__main__':
    unittest.main(testRunner=unittest.TextTestRunner(stream=sys.stdout))
