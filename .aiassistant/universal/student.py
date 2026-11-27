"""Run a bounded local student without changing the full PhpStorm ACP profile."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
AGENT = 'local-model-apprentice'
MODEL = 'local-qwen/metravel-local'
BACKENDS = {
    'current': (18088, 'Qwen3.8-27B Q3_K_XL local'),
    'coder': (18089, 'Qwen3-Coder-30B-A3B Q3_K_M local'),
    'gemma': (18091, 'Gemma4-12B QAT local'),
    'qwen-vl': (18092, 'Qwen3-VL-8B Instruct Q8 local'),
}
WRITES = tuple(f'metravel_task_board_metravel_{kind}_{action}'
               for kind in ('task', 'sprint') for action in ('create', 'update', 'delete'))


class EventBudget:
    """Count actual streamed steps and repeated terminal lookups across messages."""
    def __init__(self, max_steps=16, lookup_limit=3):
        self.max_steps, self.lookup_limit = max_steps, lookup_limit
        self.steps = self.tools = self.same_lookup = 0
        self.previous = None
        self.seen_calls = set()

    def observe(self, line):
        try:
            event = json.loads(line)
        except ValueError:
            return None
        if not isinstance(event, dict):
            return None
        if event.get('type') == 'step_start':
            self.steps += 1
            return 'step_limit' if self.steps > self.max_steps else None
        part = event.get('part', {})
        state = part.get('state', {}) if isinstance(part, dict) else {}
        if event.get('type') != 'tool_use' or not isinstance(state, dict) or state.get('status') not in ('completed', 'error'):
            return None
        # Providers may reuse a callID in a later assistant message.
        call = part.get('id') or ((part.get('messageID'), part['callID']) if part.get('callID') else None)
        if call and call in self.seen_calls:
            return None
        if call:
            self.seen_calls.add(call)
        self.tools += 1
        tool = part.get('tool')
        key = (tool, json.dumps(state.get('input'), sort_keys=True)) if tool in ('glob', 'grep', 'read') else None
        self.same_lookup = self.same_lookup + 1 if key is not None and key == self.previous else (1 if key else 0)
        self.previous = key
        return 'repeated_lookup' if self.same_lookup >= self.lookup_limit else None

    def counts(self):
        return {'steps': self.steps, 'tools': self.tools, 'same_lookup': self.same_lookup}


def run_supervised(command, prompt, env, cwd, *, deadline_seconds=600, grace_seconds=5, max_steps=16):
    """Supervise only this CLI process group; never signal the shared model service."""
    budget = EventBudget(max_steps=max_steps)
    stopped = []
    state_lock, termination_lock = threading.Lock(), threading.Lock()
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               text=True, encoding='utf-8', bufsize=1, start_new_session=True,
                               env=env, cwd=cwd)

    def terminate_owned():
        with termination_lock:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                return
            try:
                process.wait(timeout=grace_seconds)
            except subprocess.TimeoutExpired:
                pass
            # Also stop children that ignored TERM after their parent exited.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

    def stop(reason):
        with state_lock:
            if stopped:
                return
            stopped.append(reason)
        terminate_owned()

    timer = threading.Timer(deadline_seconds, lambda: stop('deadline'))
    timer.daemon = True
    timer.start()
    previous_term = None
    if threading.current_thread() is threading.main_thread():
        def interrupt(signum, _frame):
            raise SystemExit(128 + signum)
        previous_term = signal.signal(signal.SIGTERM, interrupt)
    try:
        try:
            process.stdin.write(prompt)
            process.stdin.close()
        except BrokenPipeError:
            pass
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            reason = budget.observe(line)
            if reason:
                stop(reason)
        result = process.wait()
    finally:
        timer.cancel()
        terminate_owned()
        timer.join()
        process.wait()
        for pipe in (process.stdin, process.stdout):
            try:
                pipe.close()
            except BrokenPipeError:
                pass
        if previous_term is not None:
            signal.signal(signal.SIGTERM, previous_term)
    if stopped:
        print(json.dumps({'type': 'budget_stop', 'reason': stopped[0], 'counts': budget.counts()}), flush=True)
        print(f'Local student stopped by teacher budget: {stopped[0]}. Partial events preserved.', file=sys.stderr)
        return 124
    return result


def build_profile(original, backend='current', kind='code'):
    """Pure selection: no source mutation, service startup, file writes or inference."""
    if backend not in BACKENDS or kind not in ('code', 'cover'):
        raise ValueError('Choose backend ' + '/'.join(BACKENDS) + ' and kind code/cover.')
    config = copy.deepcopy(original)
    try:
        provider = config['provider']['local-qwen']
        model = provider['models']['metravel-local']
        student = config['agent'][AGENT]
        mcp = config['mcp']
        for name in ('metravel_task_board', 'project_instructions', 'metravel_knowledge', 'local_flux'):
            if not isinstance(mcp[name], dict):
                raise ValueError('Invalid required MCP configuration.')
    except (KeyError, TypeError):
        raise ValueError('Full local profile lacks the required student/provider/MCP configuration.') from None
    port, label = BACKENDS[backend]
    provider['name'] = label
    provider['options']['baseURL'] = f'http://127.0.0.1:{port}/v1'
    model['name'] = label
    if backend == 'gemma':
        model['reasoning'] = True
        model.setdefault('options', {})['chat_template_kwargs'] = {'enable_thinking': True}
    provider['models'] = {'metravel-local': model}
    config['provider'] = {'local-qwen': provider}
    config['enabled_providers'] = ['local-qwen']
    config['model'] = config['small_model'] = MODEL
    for role in config['agent'].values():
        role['model'] = MODEL
    student['mode'] = 'primary'
    student['steps'] = 16
    config['default_agent'] = AGENT
    permissions = config.setdefault('permission', {})
    permissions['task'] = 'deny'
    permissions['doom_loop'] = 'deny'
    for method in WRITES:
        permissions[method] = 'deny'
    mcp['metravel_task_board']['enabled'] = True
    mcp['project_instructions']['enabled'] = True
    mcp['metravel_knowledge']['enabled'] = False
    mcp['local_flux']['enabled'] = kind == 'cover'
    return config


def write_profile(config, backend, kind, root=ROOT):
    destination = root / '.codex-temp/local-student' / f'{backend}-{kind}.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=destination.parent, prefix='.student-',
                                     suffix='.tmp', delete=False, encoding='utf-8') as stream:
        temporary = Path(stream.name)
        try:
            json.dump(config, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination


def environment(config, config_path, environ):
    env = dict(environ)
    env['PATH'] = '/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:' + env.get('PATH', '/usr/bin:/bin')
    env['CLAUDE_PROJECT_DIR'] = str(ROOT)
    env['OPENCODE_CONFIG'] = str(config_path)
    env['OPENCODE_CONFIG_CONTENT'] = json.dumps({key: config[key] for key in
        ('enabled_providers', 'provider', 'model', 'small_model', 'default_agent', 'permission', 'mcp')})
    env['OPENCODE_DISABLE_AUTOUPDATE'] = 'true'
    env['OPENCODE_DISABLE_MODELS_FETCH'] = 'true'
    env['OPENCODE_DISABLE_DEFAULT_PLUGINS'] = 'true'
    return env


def is_ready(backend):
    port = BACKENDS[backend][0]
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, OSError):
        return False


def load_launcher():
    spec = importlib.util.spec_from_file_location('full_local_launcher', Path(__file__).with_name('run.py'))
    launcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(launcher)
    return launcher


def execute(args, launcher):
    if not launcher.CLI.is_file():
        raise RuntimeError('Pinned OpenCode runtime is not installed.')
    config = build_profile(launcher.profile(), args.backend, args.kind)
    config_path = write_profile(config, args.backend, args.kind)
    if args.write_config_only:
        print(config_path)
        return 0
    prompt = Path(args.prompt).read_text(encoding='utf-8')
    if not prompt.strip():
        raise ValueError('Assignment file is empty.')
    if args.backend == 'current':
        launcher.ensure_server()
    elif not is_ready(args.backend):
        port = BACKENDS[args.backend][0]
        raise RuntimeError(f'Selected {args.backend} backend is not ready at 127.0.0.1:{port}; '
                           'the teacher must start that serialized local server. No fallback was used.')
    command = [str(launcher.CLI), 'run', '--format', 'json', '--agent', AGENT,
               '--model', MODEL, '--title', args.title or f'Local student {args.backend}/{args.kind}']
    if args.session:
        command.extend(['--session', args.session])
    # Pinned OpenCode run.ts:401-405 accepts non-TTY stdin. Keep prompt contents
    # out of argv: process inventories otherwise misclassify a quoted Jest prompt
    # as an active test process. Actual test commands retain their normal gates.
    return run_supervised(command, prompt, environment(config, config_path, os.environ), ROOT)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', choices=BACKENDS, default='current')
    parser.add_argument('--kind', choices=('code', 'cover'), default='code')
    parser.add_argument('--prompt', help='UTF-8 assignment file, sent to OpenCode stdin')
    parser.add_argument('--session', '--session-id', dest='session', help='Continue this explicit OpenCode session')
    parser.add_argument('--title', help='Short session label; do not put the assignment body here')
    parser.add_argument('--write-config-only', action='store_true', help='Write the bounded profile without starting a model')
    args = parser.parse_args(argv)
    if not args.write_config_only and not args.prompt:
        parser.error('--prompt is required unless --write-config-only is used')
    return execute(args, load_launcher())


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(f'Local student could not start: {error}', file=sys.stderr)
        raise SystemExit(1)
