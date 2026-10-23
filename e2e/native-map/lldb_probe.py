"""LLDB-loaded iOS arm64 WebView observer. Never logs other bridge bodies."""
import json
import os
import time
import lldb

_probe = None
CALLBACK_NAME = '-[RNCWebViewImpl userContentController:didReceiveScriptMessage:]'


def callback_entry(target):
    symbols = target.FindSymbols(CALLBACK_NAME, lldb.eSymbolTypeCode)
    if symbols.GetSize() != 1:
        raise RuntimeError('Exactly one RNCWebViewImpl callback symbol is required')
    symbol = symbols.GetContextAtIndex(0).GetSymbol()
    if not symbol.IsValid():
        raise RuntimeError('Invalid RNCWebViewImpl callback symbol')
    entry = symbol.GetStartAddress().GetLoadAddress(target)
    if entry in (0, lldb.LLDB_INVALID_ADDRESS):
        raise RuntimeError('RNCWebViewImpl callback entry is not loaded')
    return entry


def evaluate(frame, probe, expression, phase):
    probe['phase'] = phase
    result = frame.EvaluateExpression(expression)
    error = result.GetError()
    if error.Fail():
        # GetCString() can contain the evaluated script or unrelated bridge data.
        # Record the failing operation and LLDB's numeric error, never its body.
        probe['error'] = '%s failed (LLDB type=%s code=%s)' % (phase, error.GetType(), error.GetError())
        return None
    return result


def callback(frame, _location, _extra, _internal):
    probe = _probe
    if probe is None:
        return False
    if probe['error']:
        return True
    probe['phase'] = 'callback-entry'
    if frame.GetPC() != probe['entry']:
        probe['error'] = 'callback-entry: PC is not the qualified symbol start'
        return True
    # Name breakpoints skip the optimized prologue, where x0 is already message,
    # not self. Even at exact entry, expression calls may change live registers.
    receiver = frame.FindRegister('x0').GetValueAsUnsigned(lldb.LLDB_INVALID_ADDRESS)
    message = frame.FindRegister('x3').GetValueAsUnsigned(lldb.LLDB_INVALID_ADDRESS)
    if receiver in (0, lldb.LLDB_INVALID_ADDRESS) or message in (0, lldb.LLDB_INVALID_ADDRESS):
        probe['error'] = 'callback-entry: invalid self/message pointers'
        return True
    body = evaluate(frame, probe, '(id)[(id)0x%x body]' % message, 'message-body')
    if body is None:
        return True
    raw = body.GetObjectDescription() or ''
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    if probe['receiver'] is None or payload.get('type') == 'READY':
        if probe['receiver'] != receiver or payload.get('type') == 'READY':
            probe['receiver'] = receiver
            probe['sampled'] = False
            probe['injected_at'] = 0
    if receiver != probe['receiver']:
        return False
    if payload.get('type') == 'METRAVEL_QA_MAP_SNAPSHOT' and payload.get('nonce') == probe['nonce']:
        if os.path.exists(probe['stop']):
            result = evaluate(frame, probe, '(void)[(id)[(id)0x%x valueForKey:@"webView"] evaluateJavaScript:@"window.__metravelQaMapObserver && window.__metravelQaMapObserver.stop()" completionHandler:nil]' % receiver, 'observer-stop')
            if result is None:
                return True
            probe['cleaned'] = True
            return False
        probe['stream'].write(json.dumps(payload) + '\n')
        probe['stream'].flush()
        probe['sampled'] = True
    elif not probe['sampled'] and not probe['injected_at']:
        # Scheduling evaluateJavaScript with no completion handler leaves the main
        # thread free. The actual snapshot returns through this same breakpoint.
        # A missing sample is not permission to repeat the same injection; only
        # a new receiver/READY above establishes a new bootstrap precondition.
        script = probe['script']
        expression = '(void)[(id)[(id)0x%x valueForKey:@"webView"] evaluateJavaScript:@%s completionHandler:nil]' % (receiver, json.dumps(script))
        if evaluate(frame, probe, expression, 'observer-inject') is None:
            return True
        probe['injected_at'] = time.monotonic()
    return False


def run(config_path):
    global _probe
    with open(config_path, encoding='utf-8') as source:
        config = json.load(source)
    target = lldb.debugger.GetSelectedTarget()
    process = target.GetProcess()
    breakpoint = None
    stream = None
    completed = False
    failure = None
    try:
        if 'arm64' not in (target.GetTriple() or ''):
            raise RuntimeError('Only the qualified iOS arm64 callback ABI is supported')
        listener = lldb.SBListener('metravel-map-probe')
        listener.StartListeningForEvents(process.GetBroadcaster(), lldb.SBProcess.eBroadcastBitStateChanged)
        entry = callback_entry(target)
        breakpoint = target.BreakpointCreateByAddress(entry)
        if (breakpoint.GetNumLocations() != 1 or
                breakpoint.GetLocationAtIndex(0).GetAddress().GetLoadAddress(target) != entry):
            raise RuntimeError('Observer breakpoint must resolve to the exact callback entry')
        descriptor = os.open(config['output'], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        stream = os.fdopen(descriptor, 'w', encoding='utf-8')
        _probe = dict(config, entry=entry, stream=stream, sampled=False, injected_at=0,
                      error=None, phase='attached', receiver=None, cleaned=False)
        breakpoint.SetScriptCallbackFunction(__name__ + '.callback')
        lldb.debugger.SetAsync(True)
        error = process.Continue()
        if error.Fail():
            raise RuntimeError('Attached process could not resume')
        with open(config['ready'], 'x', encoding='utf-8') as ready:
            ready.write('observer attached; no application assertion yet\n')
        deadline = time.monotonic() + config['seconds']
        stop_requested_at = None
        while time.monotonic() < deadline:
            if os.path.exists(config['stop']):
                if stop_requested_at is None:
                    stop_requested_at = time.monotonic()
                if _probe['cleaned'] or time.monotonic() - stop_requested_at > 2:
                    break
            event = lldb.SBEvent()
            if listener.WaitForEvent(1, event):
                state = lldb.SBProcess.GetStateFromEvent(event)
                if state in (lldb.eStateExited, lldb.eStateDetached, lldb.eStateCrashed):
                    raise RuntimeError('Application left the attached running state')
                if state == lldb.eStateStopped and not lldb.SBProcess.GetRestartedFromEvent(event):
                    raise RuntimeError(_probe['error'] or 'Unexpected debugger stop')
        if _probe['error']:
            raise RuntimeError(_probe['error'])
        completed = True
    except RuntimeError as error:
        failure = str(error)
        raise
    finally:
        cleanup_ok = True
        try:
            if process.GetState() == lldb.eStateRunning and process.Stop().Fail():
                cleanup_ok = False
                failure = failure or 'Cannot stop debugger for safe detach'
                raise RuntimeError(failure)
            if breakpoint is not None and not target.BreakpointDelete(breakpoint.GetID()):
                cleanup_ok = False
                failure = failure or 'Cannot delete observer breakpoint'
                raise RuntimeError(failure)
        finally:
            # A failed Stop/breakpoint cleanup must still attempt detach.
            error = process.Detach()  # Detach resumes a stopped application.
            if stream is not None:
                stream.close()
            phase = _probe['phase'] if _probe else 'setup'
            _probe = None
            # LLDB's `script` command can print an exception yet exit zero.
            # The parent must require this positive receipt, not only exitCode.
            with open(config['finished'], 'x', encoding='utf-8') as receipt:
                json.dump({'completed': completed and cleanup_ok, 'detached': error.Success(),
                           'phase': phase, 'error': failure or ('LLDB detach failed' if error.Fail() else None)}, receipt)
            if error.Fail():
                raise RuntimeError('LLDB detach failed; verify target process before reuse')
