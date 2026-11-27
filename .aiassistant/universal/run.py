"""Launch the local MeTravel OpenCode profile; stdout belongs to ACP/CLI only."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CLI = Path('/Users/juliasavran/metravel-ai/tools/opencode/node_modules/.bin/opencode')
QWEN_LAUNCHER = Path('/Users/juliasavran/metravel-ai/tools/local-qwen-service/start_coder.py')
BASE_URL = 'http://127.0.0.1:18088'
LABEL = 'by.metravel.local-qwen'


def ready():
    try:
        with urllib.request.urlopen(BASE_URL + '/health', timeout=1) as response:
            return response.status == 200
    except urllib.error.HTTPError:
        return False
    except (urllib.error.URLError, OSError):
        return False


def ensure_server():
    if ready():
        return
    # A listening/loading server must not cause a second model process.
    import socket
    with socket.socket() as probe:
        probe.settimeout(1)
        listening = probe.connect_ex(('127.0.0.1', 18088)) == 0
    if not listening:
        if not QWEN_LAUNCHER.is_file():
            raise RuntimeError('Missing installed local Qwen launcher: ' + str(QWEN_LAUNCHER))
        logs = Path.home() / 'Library/Logs/MeTravelAI'
        logs.mkdir(parents=True, exist_ok=True)
        domain = f'gui/{os.getuid()}/{LABEL}'
        status = subprocess.run(['launchctl', 'print', domain], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if status.returncode == 0:
            started = subprocess.run(['launchctl', 'kickstart', domain], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            started = subprocess.run(['launchctl', 'submit', '-l', LABEL, '-o', str(logs / 'qwen.log'),
                '-e', str(logs / 'qwen-error.log'), '--', '/usr/bin/python3', str(QWEN_LAUNCHER),
                '--model', 'qwen38-27b-q3', '--no-open'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if started.returncode:
            # Another ACP startup can register the same launchctl label first.
            # A real launch failure should not leave the client waiting for two minutes.
            registered = subprocess.run(['launchctl', 'print', domain],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if registered.returncode:
                raise RuntimeError('Could not start local Qwen service; inspect ~/Library/Logs/MeTravelAI/qwen-error.log')
    for _ in range(120):
        if ready():
            return
        time.sleep(1)
    raise RuntimeError('Local Qwen did not become ready; inspect ~/Library/Logs/MeTravelAI/qwen-error.log')


def profile():
    result = subprocess.run([sys.executable, str(HERE / 'sync_metadata.py'), '--check'],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if result.returncode:
        subprocess.run([sys.executable, str(HERE / 'sync_metadata.py')], cwd=ROOT,
            stdout=sys.stderr, check=True)
    base = json.loads((HERE / 'base.json').read_text())
    metadata = json.loads((HERE / 'metadata.json').read_text())
    for section in ('agent', 'command'):
        target = base.setdefault(section, {})
        for name, value in metadata.get(section, {}).items():
            if name in target:
                raise RuntimeError('Duplicate metadata adapter: ' + name)
            target[name] = value
    return base


def main():
    if not CLI.is_file():
        raise RuntimeError('Pinned OpenCode runtime is not installed: ' + str(CLI))
    config = profile()
    config_path = HERE / 'opencode.json'
    # Avoid concurrent identical writes by multiple ACP sessions.
    rendered = json.dumps(config, ensure_ascii=False, indent=2) + '\n'
    if not config_path.exists() or config_path.read_text() != rendered:
        import tempfile
        with tempfile.NamedTemporaryFile('w', dir=HERE, delete=False, suffix='.tmp', encoding='utf-8') as temp:
            temp.write(rendered)
            temporary = Path(temp.name)
        temporary.replace(config_path)
    args = sys.argv[1:] or ['acp', '--cwd', str(ROOT)]
    if args[0] not in ('debug', 'models', 'mcp', '--version', '--help'):
        ensure_server()
    env = os.environ.copy()
    env['PATH'] = '/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:' + env.get('PATH', '/usr/bin:/bin')
    env['CLAUDE_PROJECT_DIR'] = str(ROOT)
    env['OPENCODE_CONFIG'] = str(config_path)
    env['OPENCODE_CONFIG_CONTENT'] = json.dumps({key: config[key] for key in
        ('enabled_providers', 'provider', 'model', 'small_model')})
    env['OPENCODE_DISABLE_AUTOUPDATE'] = 'true'
    env['OPENCODE_DISABLE_MODELS_FETCH'] = 'true'
    env['OPENCODE_DISABLE_DEFAULT_PLUGINS'] = 'true'
    os.chdir(ROOT)
    os.execve(str(CLI), [str(CLI), *args], env)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Local MeTravel agent could not start: {exc}', file=sys.stderr)
        raise SystemExit(1)
