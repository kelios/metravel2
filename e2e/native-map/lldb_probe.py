"""LLDB-loaded iOS arm64 WebView observer. Never logs other bridge bodies."""
import json
import os
import time
import lldb

_probe = None


def callback(frame, _location, _extra, _internal):
    probe = _probe
    if probe is None:
        return False
    body = frame.EvaluateExpression('(id)[(id)$x3 body]')
    if body.GetError().Fail():
        probe['error'] = 'Cannot read the arm64 WKScriptMessage body'
        return True
    raw = body.GetObjectDescription() or ''
    receiver = frame.FindRegister('x0').GetValue()
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
            result = frame.EvaluateExpression('(void)[(id)[(id)$x0 valueForKey:@"webView"] evaluateJavaScript:@"window.__metravelQaMapObserver && window.__metravelQaMapObserver.stop()" completionHandler:nil]')
            probe['cleaned'] = result.GetError().Success()
            return False
        probe['stream'].write(json.dumps(payload) + '\n')
        probe['stream'].flush()
        probe['sampled'] = True
    elif not probe['sampled'] and time.monotonic() - probe['injected_at'] > 1:
        # Scheduling evaluateJavaScript with no completion handler leaves the main
        # thread free. The actual snapshot returns through this same breakpoint.
        script = probe['script']
        expression = '(void)[(id)[(id)$x0 valueForKey:@"webView"] evaluateJavaScript:@%s completionHandler:nil]' % json.dumps(script)
        result = frame.EvaluateExpression(expression)
        if result.GetError().Fail():
            probe['error'] = 'WKWebView evaluateJavaScript unavailable'
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
    try:
        if 'arm64' not in (target.GetTriple() or ''):
            raise RuntimeError('Only the qualified iOS arm64 callback ABI is supported')
        listener = lldb.SBListener('metravel-map-probe')
        listener.StartListeningForEvents(process.GetBroadcaster(), lldb.SBProcess.eBroadcastBitStateChanged)
        breakpoint = target.BreakpointCreateByName('-[RNCWebViewImpl userContentController:didReceiveScriptMessage:]')
        if breakpoint.GetNumLocations() != 1:
            raise RuntimeError('Exactly one RNCWebViewImpl callback is required')
        descriptor = os.open(config['output'], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        stream = os.fdopen(descriptor, 'w', encoding='utf-8')
        _probe = dict(config, stream=stream, sampled=False, injected_at=0, error=None, receiver=None, cleaned=False)
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
        completed = True
    finally:
        cleanup_ok = True
        try:
            if process.GetState() == lldb.eStateRunning and process.Stop().Fail():
                cleanup_ok = False
                raise RuntimeError('Cannot stop debugger for safe detach')
            if breakpoint is not None and not target.BreakpointDelete(breakpoint.GetID()):
                cleanup_ok = False
                raise RuntimeError('Cannot delete observer breakpoint')
        finally:
            # A failed Stop/breakpoint cleanup must still attempt detach.
            error = process.Detach()  # Detach resumes a stopped application.
            if stream is not None:
                stream.close()
            _probe = None
            # LLDB's `script` command can print an exception yet exit zero.
            # The parent must require this positive receipt, not only exitCode.
            with open(config['finished'], 'x', encoding='utf-8') as receipt:
                json.dump({'completed': completed and cleanup_ok, 'detached': error.Success()}, receipt)
            if error.Fail():
                raise RuntimeError('LLDB detach failed; verify target process before reuse')
