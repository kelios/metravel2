"""Run one guest-only local visual-model QA batch; every result needs teacher review."""
import argparse
import contextlib
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
NODE = Path('/opt/homebrew/opt/node@22/bin/node')
MCP = Path.home() / 'metravel-ai/tools/playwright-mcp/node_modules/@playwright/mcp'
MCP_VERSION = '0.0.86'
STEPS = 24
SECONDS = 600
QA_BACKENDS = ('gemma', 'qwen-vl')
REFERENCE = ROOT / '.codex/skills/metravel-local-apprentice/references/browser-qa.md'


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


student = load_module('local_qa_student', HERE.parent / 'universal/student.py')
receipts = load_module('local_qa_receipt', HERE / 'receipt.py')


def browser_executable(node=NODE, root=ROOT):
    result = subprocess.run([str(node), '-e', "process.stdout.write(require('playwright').chromium.executablePath())"],
                            cwd=root, capture_output=True, text=True, check=True, timeout=10)
    executable = Path(result.stdout.strip())
    if not executable.is_file():
        raise RuntimeError('The project Playwright Chromium is absent; the teacher must provision it first.')
    return executable


def runtime_dependencies(mcp=MCP, node=NODE):
    if not node.is_file():
        raise RuntimeError('The configured Node 22 runtime is not installed.')
    try:
        version = json.loads((mcp / 'package.json').read_text(encoding='utf-8'))['version']
    except (OSError, KeyError, ValueError):
        raise RuntimeError('Playwright MCP is not installed; follow the QA README. No automatic install was attempted.') from None
    if version != MCP_VERSION:
        raise RuntimeError(f'Reviewed Playwright MCP {MCP_VERSION} is required, found {version}.')


def new_output(root=ROOT):
    root = root.resolve()
    base = root / '.codex-temp/local-web-qa'
    if base.resolve() != base:
        raise ValueError('QA output must stay inside the ignored repository artifact directory.')
    base.mkdir(parents=True, exist_ok=True)
    base = base.resolve()
    if base != root / '.codex-temp/local-web-qa':
        raise ValueError('QA output must stay inside the ignored repository artifact directory.')
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    output = base / name
    output.mkdir()
    return output


def require_quality_owner(root=ROOT, parent_pid=None):
    try:
        owner = json.loads((root / '.codex-temp/ops/quality-gate.lock/owner.json').read_text())
    except (OSError, ValueError):
        owner = {}
    if owner.get('name') != 'local-browser-qa' or owner.get('pid') != (parent_pid or os.getppid()):
        raise RuntimeError('Use the canonical quality-gate wrapper with name local-browser-qa; do not run a second gate.')


def build_configs(original, output, viewport, executable, *, backend='gemma', root=ROOT, node=NODE):
    if backend not in QA_BACKENDS:
        raise ValueError('Choose an explicitly supported local visual QA backend.')
    output = output.resolve()
    config = student.build_profile(original, backend, 'code')
    model = config['provider']['local-qwen']['models']['metravel-local']
    model.update({'attachment': True, 'reasoning': False,
                  'modalities': {'input': ['text', 'image'], 'output': ['text']}})
    model['options']['chat_template_kwargs'] = {'enable_thinking': False}
    model['limit']['output'] = 3072
    config['agent'] = {'local-web-qa': {
        'description': 'Guest-only local browser QA: self-written scenarios and observed evidence.',
        'mode': 'primary', 'model': student.MODEL, 'steps': STEPS,
        'prompt': 'You are the local MeTravel QA apprentice. Inspect the live interface, choose and execute bounded scenarios, and report only observed evidence. Do not edit application code. Teacher acceptance is always separate.',
    }}
    config['default_agent'] = 'local-web-qa'
    config['plugin'] = [(root / '.aiassistant/qa/read-guard.mjs').as_uri()]
    config['instructions'] = [str(root / '.codex/skills/metravel-qa-agent/SKILL.md'),
                              str(root / '.codex/skills/metravel-local-apprentice/references/browser-qa.md')]
    # The batch defines the emulation context. There is no model-side viewport/config switch.
    allowed = ('navigate', 'navigate_back', 'snapshot', 'click', 'fill_form', 'type', 'press_key',
               'hover', 'select_option', 'take_screenshot', 'console_messages', 'network_requests',
               'tabs', 'wait_for', 'close', 'mouse_click_xy', 'mouse_move_xy', 'mouse_wheel')
    relative = output.relative_to(root.resolve()).as_posix()
    config['permission'] = {'*': 'deny', 'doom_loop': 'deny', 'todowrite': 'allow',
                            **{'browser_browser_' + name: 'allow' for name in allowed},
                            'read': {'*': 'deny', str(output) + '/**': 'allow', relative + '/**': 'allow'}}
    mobile = viewport == 'mobile'
    browser = {
        'browser': {'browserName': 'chromium', 'isolated': True,
                    'launchOptions': {'headless': True, 'executablePath': str(executable)},
                    'contextOptions': {'viewport': {'width': 390 if mobile else 1440, 'height': 844 if mobile else 900},
                                       'isMobile': mobile, 'hasTouch': mobile, 'deviceScaleFactor': 1,
                                       'serviceWorkers': 'block'},
                    'initPage': [str(root / '.aiassistant/qa/init-page.ts')]},
        'capabilities': ['core', 'vision'], 'outputDir': str(output / 'browser'), 'saveSession': True,
        'webmcp': False, 'imageResponses': 'allow', 'console': {'level': 'warning'},
        'redactUrlParams': ['token', 'access_token', 'code', 'hash', 'key', 'password', 'csrfmiddlewaretoken'],
        'timeouts': {'action': 5000, 'navigation': 30000},
    }
    config['mcp'] = {'browser': {
        'type': 'local', 'command': [str(node), str(root / '.aiassistant/qa/browser-stdio.cjs'), str(output / 'browser.json')],
        'environment': {'LOCAL_QA_OUTPUT': str(output)}, 'enabled': True, 'timeout': 45000,
    }}
    return config, browser


def prompt_text(scope, viewport, extra=None):
    if not scope.strip() or len(scope) > 2000:
        raise ValueError('Scope must contain 1–2000 characters.')
    text = ('Проведи самостоятельный гостевой UI/UX QA на https://metravel.by/.\n'
            f'Scope этого batch: {scope.strip()}\n'
            f'Контекст уже настроен: {viewport}; не меняй viewport.\n'
            'Сам составь и выполни сценарии по реально увиденному интерфейсу. Следуй канонической browser-qa инструкции. '
            'Лимит 24 шага/600 секунд. Финальный JSON с реальными evidence обязателен. '
            'Не выдавай план, открытие URL или сохранение PNG за полную проверку сайта.\n')
    if extra:
        text += '\nДополнительное назначение учителя:\n' + extra
    return text


def read_assignment(file, root=ROOT):
    file = Path(file).resolve()
    if not file.is_relative_to((root / '.codex-temp').resolve()):
        raise ValueError('Teacher assignment must be a UTF-8 text file in .codex-temp, without secrets.')
    if any(part.startswith('.env') or part in ('.secrets', '.ssh') for part in file.parts):
        raise ValueError('Secret files cannot be used as QA assignments.')
    if file.stat().st_size > 16384:
        raise ValueError('Teacher assignment exceeds 16 KiB for the bounded local context.')
    return file.read_text(encoding='utf-8')


def execute(args):
    if not args.config_only:
        require_quality_owner()
    runtime_dependencies()
    if not REFERENCE.is_file():
        raise RuntimeError('The canonical browser-qa reference is missing.')
    launcher = student.load_launcher()
    if not launcher.CLI.is_file():
        raise RuntimeError('The installed local OpenCode runtime is missing.')
    output = new_output()
    (output / 'browser').mkdir()
    config, browser = build_configs(launcher.profile(), output, args.viewport, browser_executable(), backend=args.backend)
    prompt = prompt_text(args.scope, args.viewport, read_assignment(args.prompt) if args.prompt else None)
    for name, value in (('browser.json', browser), ('opencode.json', config)):
        (output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (output / 'assignment.md').write_text(prompt, encoding='utf-8')
    print(f'QA artifacts: {output}', file=sys.stderr)
    if args.config_only:
        print(output / 'opencode.json')
        return 0
    port, label = student.BACKENDS[args.backend]
    if not student.is_ready(args.backend):
        raise RuntimeError(f'{label} at 127.0.0.1:{port} is not ready; the teacher must start it. No fallback was used.')
    command = [str(launcher.CLI), 'run', '--format', 'json', '--agent', 'local-web-qa',
               '--model', student.MODEL, '--title', args.backend + ' guest QA ' + args.viewport]
    inventory = receipts.EvidenceInventory()
    code = 1
    started = time.monotonic()
    started_utc = datetime.now(timezone.utc).isoformat()
    try:
        with (output / 'events.jsonl').open('w', encoding='utf-8') as raw:
            tee = receipts.EventTee(raw, sys.stdout, inventory)
            env = student.environment(config, output / 'opencode.json', os.environ)
            env['LOCAL_QA_OUTPUT'] = str(output)
            with contextlib.redirect_stdout(tee):
                code = student.run_supervised(command, prompt, env,
                                              ROOT, max_steps=STEPS, deadline_seconds=SECONDS,
                                              grace_seconds=16)  # Pinned MCP's owned-browser exit watchdog allows 15 seconds.
    except KeyboardInterrupt:
        code = 130
        raise
    except SystemExit as error:
        code = error.code if isinstance(error.code, int) else 1
        raise
    finally:
        receipt, final_text = inventory.finish(output, code)
        receipt.update({'backend': args.backend, 'endpoint': f'http://127.0.0.1:{port}/v1',
                        'playwright_mcp_version': MCP_VERSION, 'viewport': args.viewport,
                        'started_utc': started_utc, 'elapsed_seconds': round(time.monotonic() - started, 3),
                        'scope': args.scope, 'output': str(output)})
        (output / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (output / 'model-final.txt').write_text(final_text, encoding='utf-8')
    print(f'QA result: {receipt["completion"]}; teacher review required. Receipt: {output / "receipt.json"}', file=sys.stderr)
    return code if code else (0 if receipt['completion'] == 'report_ready_for_review' else 2)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', choices=QA_BACKENDS, default='gemma')
    parser.add_argument('--viewport', choices=('mobile', 'desktop'), default='mobile')
    parser.add_argument('--scope', default='Гостевая навигация, поиск и одно интерактивное состояние.')
    parser.add_argument('--prompt', help='Optional teacher assignment in ignored .codex-temp; never credentials.')
    parser.add_argument('--config-only', action='store_true', help='Prepare a profile without browser/model execution.')
    return execute(parser.parse_args(argv))


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f'Local QA could not run: {error}', file=sys.stderr)
        raise SystemExit(1)
