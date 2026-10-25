#!/usr/bin/env python3
"""Ежедневный security-отчёт прод-хоста metravel.by (борд #2721).

Запускается cron-ом на хосте от `sx3` (без sudo), собирает за окно `--since-hours`:
SSH (auth.log + fail2ban.log), web (docker logs nginx), роботов (user_agent против
robots.txt), почту приложения (лог напоминаний модерации, relay-очередь) и факты
хоста (диск, память, нагрузка, контейнеры). Сравнивает с прошлым прогоном из файла
состояния и шлёт письмо через `sendmail -t` — тот же транспорт, что у seo_report.py.

Только стандартная библиотека. Все входы можно подменить файлами (`--nginx-log`,
`--fail2ban-log`, `--auth-log`, …) — так работает jest-тест на фикстурах.
Персональные данные посетителей в письмо не попадают: только IP атакующих и UA роботов;
общий топ трафика — сетями /24 (IPv4) и /48 (IPv6), без адреса посетителя.
"""
from __future__ import annotations

import argparse
import datetime as dt
import functools
import io
import ipaddress
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from collections import Counter, defaultdict
from email.header import Header
from email.utils import formatdate
from pathlib import Path

DEFAULT_EMAIL = 'metraveldev@gmail.com'
DEFAULT_FROM = 'MeTravel security <sx3@metravel.by>'
DEFAULT_ROBOTS_URL = 'https://metravel.by/robots.txt'
HOSTLOG_IMAGES = ('alpine:latest', 'redis:latest')
NGINX_NAME_RE = re.compile(r'^metravel[-_]nginx[-_]1$')

SCANNER_RE = re.compile(
    r'^[A-Z]+ /(?:\.env|\.git/|\.aws|\.DS_Store|wp-login|wp-admin|wp-config|wordpress|xmlrpc'
    r'|phpmyadmin|cgi-bin|vendor/phpunit|actuator|config\.json|[^ ?]*\.php)',
    re.IGNORECASE,
)
# Порядок важен: первый совпавший токен определяет робота.
BOT_TOKENS = [
    'meta-externalagent', 'facebookexternalhit', 'googlebot', 'bingbot', 'yandex', 'duckduckbot',
    'applebot', 'baiduspider', 'claudebot', 'gptbot', 'chatgpt-user', 'oai-searchbot',
    'perplexitybot', 'bytespider', 'petalbot', 'amazonbot', 'dotbot', 'ahrefsbot', 'semrushbot',
    'mj12bot', 'qlyzebot', 'telegrambot', 'twitterbot', 'linkedinbot', 'censys', 'zgrab',
    'python-requests', 'go-http-client', 'curl/', 'nmap', 'masscan', 'sqlmap', 'nikto',
]
SSH_FAIL_RE = re.compile(
    r'(?:Invalid user \S* from|Failed password for .* from|authentication failure.*rhost='
    r'|Connection closed by (?:authenticating|invalid) user \S+|Disconnected from (?:authenticating|invalid) user \S+)'
    r'\s*(\S+)'
)
SSH_OK_RE = re.compile(r'Accepted (\w+) for (\S+) from (\S+)')
# Одно соединение sshd пишет несколько строк отказа (`Invalid user` + `Connection closed by invalid user`,
# pam `authentication failure` + `Failed password`) под одним pid — попыткой считается соединение.
SSHD_PID_RE = re.compile(r'sshd(?:-session)?\[(\d+)\]')
F2B_RE = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ fail2ban\.\w+\s+\[\d+\]: (\w+)\s+\[([\w-]+)\] (Ban|Unban|Restore Ban|Found) (\S+)')
LIMIT_REQ_RE = re.compile(r'limiting requests.*client: ([0-9a-fA-F.:]+)')
MOD_ERR_RE = re.compile(r'^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ ERROR .*\((\w+)\)')
STATUS_RE = re.compile(r'^(\d{3})')
WARN_BOT_MIN = 50
WARN_5XX_MIN = 50
WARN_LIMIT_REQ_MIN = 20
WARN_ADMIN_LOGIN_MIN = 10
WARN_DISK_PCT = 85


def parse_args(argv):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--since-hours', type=float, default=24)
    p.add_argument('--now', help='ISO-время «сейчас» с зоной (для тестов)')
    p.add_argument('--log-utc-offset', help='смещение наивных меток fail2ban.log вида +03:00 (по умолчанию зона машины); '
                   'лог модерации пишет Django с TIME_ZONE=UTC и всегда читается в UTC')
    p.add_argument('--nginx-log', help='access-лог nginx (JSON-строки) вместо docker logs')
    p.add_argument('--nginx-err', help='stderr nginx вместо docker logs')
    p.add_argument('--fail2ban-log', action='append', default=[])
    p.add_argument('--auth-log', action='append', default=[])
    p.add_argument('--moderation-log', default=os.path.expanduser('~/.local/state/metravel/moderation-reminders.log'))
    p.add_argument('--relay-log', default=os.path.expanduser('~/metravel-monitor/relay-queue.cron.log'))
    p.add_argument('--robots', default=DEFAULT_ROBOTS_URL, help='URL или файл robots.txt')
    p.add_argument('--state', default=os.path.expanduser('~/.local/state/metravel/security-report-state.json'))
    p.add_argument('--email', default=os.environ.get('SECURITY_REPORT_EMAIL') or DEFAULT_EMAIL)
    p.add_argument('--from-addr', default=os.environ.get('SECURITY_REPORT_FROM') or DEFAULT_FROM)
    p.add_argument('--ignore-ip', action='append', default=None, help='свои адреса (не считать атакой/лимитом)')
    p.add_argument('--hostname', default=os.environ.get('SECURITY_REPORT_HOST') or 'metravel.by')
    p.add_argument('--no-host', action='store_true', help='не собирать df/free/docker (тесты)')
    p.add_argument('--dry-run', action='store_true', help='печатать письмо, не отправлять')
    p.add_argument('--write-state', action='store_true', help='при --dry-run всё же записать состояние (тесты); без --dry-run пишется всегда')
    p.add_argument('--no-state', action='store_true', help='не записывать состояние (ручной --run-now не должен сдвигать базу дельт)')
    args = p.parse_args(argv)
    if args.ignore_ip is None:
        env_ips = os.environ.get('SECURITY_REPORT_IGNORE_IPS', '')
        args.ignore_ip = [ip for ip in env_ips.split() if ip]
    return args


def run(cmd, timeout=120):
    try:
        proc = subprocess.run(cmd, capture_output=True, stdin=subprocess.DEVNULL, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 1, '', str(exc)
    return proc.returncode, proc.stdout.decode('utf-8', 'replace'), proc.stderr.decode('utf-8', 'replace')


def read_text(path):
    try:
        return Path(path).read_text(encoding='utf-8', errors='replace')
    except OSError:
        return ''


def read_root_logs(names):
    """Файлы syslog:adm 640 читаются одноразовым контейнером только на чтение (без сети)."""
    script = ' '.join(f'cat /hostlog/{n} 2>/dev/null;' for n in names)
    for image in HOSTLOG_IMAGES:
        rc, out, _ = run(['docker', 'run', '--rm', '--network', 'none', '-v', '/var/log:/hostlog:ro', image, 'sh', '-c', script])
        if rc == 0:
            return out
    return ''


def iter_file(path):
    """Строки файла потоком: access-лог за сутки — сотни мегабайт, целиком в память не читаем."""
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            yield from fh
    except OSError:
        return


def docker_nginx_stats(hours, since, ignore):
    """`docker logs` nginx разбирается потоком из stdout; stderr (limit_req) — через временный файл."""
    rc, names, _ = run(['docker', 'ps', '--format', '{{.Names}}'])
    name = next((n for n in names.split() if NGINX_NAME_RE.match(n)), None)
    if not name:
        return analyze_nginx((), (), since, ignore), 'контейнер nginx не найден'
    note = ''
    _, started, _ = run(['docker', 'inspect', '-f', '{{.State.StartedAt}}', name])
    started_at = parse_iso(started) if started.strip() else None
    if started_at and started_at > since:
        note = f'nginx перезапущен {started_at.astimezone(dt.timezone.utc):%d.%m %H:%M} UTC — web-окно короче'
    with tempfile.TemporaryFile() as err_file:
        try:
            proc = subprocess.Popen(['docker', 'logs', '--since', f'{max(1, int(hours * 3600))}s', name],
                                    stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=err_file)
        except OSError as exc:
            return analyze_nginx((), (), since, ignore), f'docker logs: {exc}'
        with io.TextIOWrapper(proc.stdout, encoding='utf-8', errors='replace') as access:
            ng = analyze_nginx(access, (), since, ignore)
        rc = proc.wait()
        err_file.seek(0)
        count_limit_req(ng, io.TextIOWrapper(err_file, encoding='utf-8', errors='replace'), ignore)
    if rc != 0:
        note = '; '.join(n for n in (note, f'docker logs rc={rc}') if n)
    return ng, note


def parse_iso(value):
    value = value.strip()
    if value.endswith('Z'):
        value = value[:-1] + '+00:00'
    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def parse_local(value, tz):
    try:
        return dt.datetime.strptime(value, '%Y-%m-%d %H:%M:%S').replace(tzinfo=tz)
    except ValueError:
        return None


@functools.lru_cache(maxsize=65536)
def ip_network_label(ip):
    """Адрес посетителя → его сеть /24 или /48: топ трафика без персональных данных."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return '?'
    prefix = 24 if addr.version == 4 else 48
    return str(ipaddress.ip_network(f'{addr}/{prefix}', strict=False))


def analyze_nginx(access, err, since, ignore):
    out = {
        'external': 0, 'status': Counter(), 'scanner_requests': 0, 'scanner_ips': Counter(),
        'scanner_paths': Counter(), 'admin_login_posts': 0, 'http_5xx_paths': Counter(), 'http_499': 0,
        'bots': Counter(), 'bot_paths': defaultdict(Counter), 'top_networks': Counter(), 'limit_req': Counter(),
        'skipped': 0,
    }
    for line in access:
        line = line.strip()
        if not line.startswith('{'):
            continue
        try:
            row = json.loads(line)
        except ValueError:
            out['skipped'] += 1
            continue
        when = parse_iso(str(row.get('time', '')))
        if when and when < since:
            continue
        ip = str(row.get('remote_addr', ''))
        if ip in ignore:
            continue
        request = str(row.get('request', ''))
        status = str(row.get('status', ''))
        ua = str(row.get('user_agent', '')).lower()
        path = request.split(' ')[1].split('?')[0] if ' ' in request else request
        out['external'] += 1
        out['status'][status[:1] + 'xx' if status[:1].isdigit() else '?'] += 1
        out['top_networks'][ip_network_label(ip)] += 1
        if status == '499':
            out['http_499'] += 1
        if status.startswith('5'):
            out['http_5xx_paths'][re.sub(r'/\d+(?=/|$)', '/N', path)[:80]] += 1
        if SCANNER_RE.match(request):
            out['scanner_requests'] += 1
            out['scanner_ips'][ip] += 1
            out['scanner_paths'][path[:60]] += 1
        if request.startswith('POST /admin/login/'):
            out['admin_login_posts'] += 1
        token = next((t for t in BOT_TOKENS if t in ua), None)
        if token:
            out['bots'][token] += 1
            out['bot_paths'][token][path.split('/')[1] if path.startswith('/') and len(path) > 1 else '/'] += 1
    count_limit_req(out, err, ignore)
    return out


def count_limit_req(out, err, ignore):
    for line in err:
        m = LIMIT_REQ_RE.search(line)
        if m and m.group(1) not in ignore:
            out['limit_req'][m.group(1)] += 1


def analyze_fail2ban(text, since, tz):
    bans = Counter()
    unbans = Counter()
    restored = Counter()
    banned_ips = defaultdict(Counter)
    found = 0
    for line in text.splitlines():
        m = F2B_RE.match(line)
        if not m:
            continue
        when = parse_local(m.group(1), tz)
        if when is None or when < since:
            continue
        jail, action, ip = m.group(3), m.group(4), m.group(5)
        if action == 'Ban':
            bans[jail] += 1
            banned_ips[jail][ip] += 1
        elif action == 'Unban':
            unbans[jail] += 1
        elif action == 'Restore Ban':
            restored[jail] += 1
        elif action == 'Found':
            found += 1
    return {'bans': bans, 'unbans': unbans, 'restored': restored, 'banned_ips': banned_ips, 'found': found}


def analyze_auth(text, since, ignore):
    failed = 0
    ips = Counter()
    accepted = Counter()
    seen = set()
    for line in text.splitlines():
        stamp = line.split(' ', 1)[0]
        when = parse_iso(stamp)
        if when and when < since:
            continue
        m = SSH_FAIL_RE.search(line)
        pid = SSHD_PID_RE.search(line) if m else None
        if pid:
            key = (pid.group(1), m.group(1))
            if key not in seen:
                seen.add(key)
                failed += 1
                ips[m.group(1)] += 1
            continue
        m = SSH_OK_RE.search(line)
        if m:
            accepted[(m.group(2), m.group(3), m.group(1))] += 1
    unknown = [(user, ip, method, n) for (user, ip, method), n in accepted.items() if ip not in ignore]
    return {'failed': failed, 'ips': ips, 'accepted': accepted, 'unknown_logins': unknown}


def analyze_moderation(text, since):
    """Лог пишет Django с TIME_ZONE='UTC' (asctime в UTC), не в зоне хоста."""
    errors = 0
    classes = Counter()
    for line in text.splitlines():
        m = MOD_ERR_RE.match(line)
        if not m:
            continue
        when = parse_local(m.group(1), dt.timezone.utc)
        if when is None or when < since:
            continue
        errors += 1
        classes[m.group(2)] += 1
    return {'errors': errors, 'classes': classes}


def analyze_relay(text):
    for line in reversed(text.splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                row = json.loads(line)
            except ValueError:
                continue
            return {'deferred': int(row.get('deferred_count') or 0), 'queue_depth': int(row.get('queue_depth') or 0),
                    'error': row.get('last_relay_error_code'), 'collected_at': row.get('collected_at')}
    return None


def closed_crawlers(source):
    """Имена групп robots.txt с `Disallow: /` — закрытые целиком роботы (кроме `*`)."""
    closed = set()
    agents = []
    last_was_agent = False
    for raw in source.splitlines():
        line = raw.split('#', 1)[0].strip()
        if ':' not in line:
            continue
        field, value = (part.strip() for part in line.split(':', 1))
        if field.lower() == 'user-agent':
            if not last_was_agent:
                agents = []
            agents.append(value.lower())
            last_was_agent = True
            continue
        last_was_agent = False
        if field.lower() == 'disallow' and value == '/':
            closed.update(a for a in agents if a != '*')
    return closed


def load_robots(spec):
    if spec.startswith('http://') or spec.startswith('https://'):
        try:
            with urllib.request.urlopen(spec, timeout=15) as resp:
                return resp.read().decode('utf-8', 'replace')
        except Exception:  # noqa: BLE001 — отчёт важнее источника
            return ''
    return read_text(spec)


def host_facts():
    facts = {}
    rc, out, _ = run(['df', '-m', '/'])
    parts = out.strip().splitlines()[-1].split() if rc == 0 and out.strip() else []
    if len(parts) >= 5:
        used, free = int(parts[2]), int(parts[3])
        facts['disk_pct'] = round(used * 100 / (used + free))
        facts['disk_free_mb'] = free
    rc, out, _ = run(['free', '-m'])
    for line in out.splitlines():
        if line.startswith('Mem:'):
            cols = line.split()
            facts['mem_available_mb'] = int(cols[6]) if len(cols) > 6 else None
    facts['loadavg'] = read_text('/proc/loadavg').split()[:3]
    facts['reboot_required'] = Path('/var/run/reboot-required').exists()
    facts['monitor_state'] = read_text('/var/tmp/system_monitor.state').strip() or None
    rc, out, _ = run(['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.Status}}'])
    bad = []
    for line in out.splitlines():
        name, _, status = line.partition('\t')
        if name.startswith('metravel') and ('unhealthy' in status or (status.startswith('Exited') and 'permissions' not in name)):
            bad.append(f'{name}: {status}')
    facts['bad_containers'] = bad
    return facts


def fmt_delta(key, cur, prev):
    if not prev or key not in prev:
        return ''
    diff = cur - prev[key]
    return f' ({"+" if diff >= 0 else ""}{diff} ко вчера)'


def top(counter, n=5):
    return ', '.join(f'{k} ×{v}' for k, v in counter.most_common(n)) or '—'


def build_report(args, now, since, ng, f2b, auth, mod, relay, closed, facts, prev):
    warn = []
    lines = []
    period = f'{since.astimezone(dt.timezone.utc):%d.%m %H:%M} – {now.astimezone(dt.timezone.utc):%d.%m %H:%M} UTC'
    lines.append(f'Security report {args.hostname}, окно {period}')
    lines.append('')

    lines.append('== SSH ==')
    sshd_bans = f2b['bans'].get('sshd', 0)
    lines.append(f'Неудачных попыток входа: {auth["failed"]} с {len(auth["ips"])} адресов{fmt_delta("ssh_failed", auth["failed"], prev)}; fail2ban Found: {f2b["found"]}')
    lines.append(f'Баны: sshd {sshd_bans} (уникальных {len(f2b["banned_ips"].get("sshd", {}))}), sshd-slow {f2b["bans"].get("sshd-slow", 0)}, recidive {f2b["bans"].get("recidive", 0)}{fmt_delta("bans_sshd", sshd_bans, prev)}')
    other = {j: n for j, n in f2b['bans'].items() if j not in ('sshd', 'sshd-slow', 'recidive')}
    if other:
        lines.append(f'Другие jail: {other}')
    if f2b['restored']:
        lines.append(f'Восстановлено банов после рестарта: {dict(f2b["restored"])}')
    lines.append(f'Топ атакующих: {top(auth["ips"])}')
    if f2b['banned_ips'].get('sshd-slow'):
        lines.append(f'Новые долгие баны: {", ".join(f2b["banned_ips"]["sshd-slow"])}')
    ok = ', '.join(f'{u} с {ip} ({m}) ×{n}' for (u, ip, m), n in auth['accepted'].items()) or 'нет'
    lines.append(f'Успешные входы: {ok}')
    for user, ip, method, n in auth['unknown_logins']:
        warn.append(f'SSH-вход {user} с НЕЗНАКОМОГО адреса {ip} ({method}, ×{n})')
    lines.append('')

    lines.append('== Web (nginx, без своих адресов) ==')
    st = ng['status']
    lines.append(f'Внешних запросов: {ng["external"]}; 2xx {st.get("2xx", 0)}, 3xx {st.get("3xx", 0)}, 4xx {st.get("4xx", 0)}, 5xx {st.get("5xx", 0)}{fmt_delta("http_5xx", st.get("5xx", 0), prev)}, 499 {ng["http_499"]}')
    lines.append(f'Сканеры (.env/.git/wp-*/php): {ng["scanner_requests"]} запросов с {len(ng["scanner_ips"])} адресов{fmt_delta("scanner_requests", ng["scanner_requests"], prev)}')
    lines.append(f'  топ адресов: {top(ng["scanner_ips"])}')
    lines.append(f'  топ путей: {top(ng["scanner_paths"])}')
    lines.append(f'POST /admin/login/: {ng["admin_login_posts"]}; срабатываний limit_req: {sum(ng["limit_req"].values())} ({top(ng["limit_req"], 3)})')
    if st.get('5xx', 0):
        lines.append(f'  5xx по путям: {top(ng["http_5xx_paths"])}')
    lines.append(f'Топ сетей по запросам (/24, /48): {top(ng["top_networks"])}')
    if st.get('5xx', 0) >= WARN_5XX_MIN:
        warn.append(f'5xx внешним клиентам: {st["5xx"]} (порог {WARN_5XX_MIN})')
    if sum(ng['limit_req'].values()) >= WARN_LIMIT_REQ_MIN:
        warn.append(f'limit_req сработал {sum(ng["limit_req"].values())} раз по чужим адресам')
    if ng['admin_login_posts'] >= WARN_ADMIN_LOGIN_MIN:
        warn.append(f'подбор пароля к /admin/login/: {ng["admin_login_posts"]} POST')
    lines.append('')

    lines.append('== Роботы (user_agent) ==')
    bot_total = sum(ng['bots'].values())
    lines.append(f'Всего запросов роботов: {bot_total}{fmt_delta("bot_requests", bot_total, prev)}; закрыто в robots.txt: {len(closed)}')
    for token, n in ng['bots'].most_common(20):
        is_closed = token in closed
        mark = ' [закрыт в robots.txt]' if is_closed else ''
        sections = top(ng['bot_paths'][token], 3)
        lines.append(f'  {token:<20} {n:>6}{mark}  {sections}')
        if is_closed and n >= WARN_BOT_MIN:
            warn.append(f'закрытый робот {token} всё равно сделал {n} запросов')
    lines.append('')

    lines.append('== Почта приложения ==')
    lines.append(f'Ошибок SMTP в рассылке модерации: {mod["errors"]}' + (f' ({dict(mod["classes"])})' if mod['errors'] else ''))
    if mod['errors']:
        warn.append(f'ошибки отправки писем: {mod["errors"]} ({", ".join(mod["classes"])})')
    if relay:
        lines.append(f'Очередь Postfix: deferred {relay["deferred"]}, глубина {relay["queue_depth"]}, ошибка {relay["error"] or "нет"} (замер {relay["collected_at"]})')
        if relay['deferred']:
            warn.append(f'в очереди Postfix {relay["deferred"]} отложенных писем')
    else:
        lines.append('Очередь Postfix: нет данных relay-queue.cron.log')
    lines.append('')

    if facts:
        lines.append('== Хост ==')
        lines.append(f'Диск: {facts.get("disk_pct", "?")} % (свободно {facts.get("disk_free_mb", "?")} МБ); память доступна {facts.get("mem_available_mb", "?")} МБ; load {" ".join(facts.get("loadavg", []))}; монитор {facts.get("monitor_state") or "?"}')
        if facts.get('reboot_required'):
            lines.append('Требуется перезагрузка хоста (обновление ядра)')
        if facts.get('bad_containers'):
            lines.append('Контейнеры не в норме: ' + '; '.join(facts['bad_containers']))
            warn.append('контейнеры не в норме: ' + '; '.join(facts['bad_containers']))
        if isinstance(facts.get('disk_pct'), int) and facts['disk_pct'] >= WARN_DISK_PCT:
            warn.append(f'диск {facts["disk_pct"]} % (порог отчёта {WARN_DISK_PCT}, монитора 89)')
        if facts.get('monitor_state') and facts['monitor_state'] != 'OK':
            warn.append(f'monitor.sh в состоянии {facts["monitor_state"]}')
        lines.append('')

    if ng['skipped']:
        lines.append(f'Пропущено нечитаемых строк access-лога: {ng["skipped"]}')
    lines.append('== Итог ==')
    if warn:
        lines.extend(f'⚠ {w}' for w in warn)
    else:
        lines.append('Отклонений по порогам отчёта нет.')
    lines.append('')
    lines.append('Что считается: SSH — auth.log и fail2ban.log за окно; web — docker logs nginx без адресов из SECURITY_REPORT_IGNORE_IPS; '
                 'роботы — по user_agent, закрытые группы берутся из robots.txt; почта — лог send_moderation_reminders и relay-queue; '
                 'дельты — к прошлому прогону. Скрипт: scripts/security-report.py (#2721).')
    metrics = {
        'ssh_failed': auth['failed'], 'ssh_unique_ips': len(auth['ips']), 'bans_sshd': sshd_bans,
        'scanner_requests': ng['scanner_requests'], 'scanner_ips': len(ng['scanner_ips']),
        'http_5xx': st.get('5xx', 0), 'bot_requests': bot_total, 'external': ng['external'],
    }
    subject = f'Security report {args.hostname} {now.astimezone(dt.timezone.utc):%d.%m.%Y}: ' + (f'{len(warn)} ⚠' if warn else 'OK')
    return subject, '\n'.join(lines), metrics, warn


def send_mail(args, subject, body):
    message = (
        f'From: {args.from_addr}\n'
        f'To: {args.email}\n'
        f'Subject: {Header(subject, "utf-8").encode()}\n'
        f'Date: {formatdate(localtime=True)}\n'
        'MIME-Version: 1.0\n'
        'Content-Type: text/plain; charset=utf-8\n'
        'Content-Transfer-Encoding: 8bit\n'
        '\n' + body + '\n'
    )
    try:
        proc = subprocess.run(['/usr/sbin/sendmail', '-t'], input=message.encode('utf-8'), capture_output=True,
                              timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f'sendmail: {exc}', file=sys.stderr)
        return 1
    if proc.returncode != 0:
        print(f'sendmail rc={proc.returncode}: {proc.stderr.decode("utf-8", "replace")}', file=sys.stderr)
    return proc.returncode


def main(argv=None):
    args = parse_args(argv)
    now = parse_iso(args.now) if args.now else dt.datetime.now(dt.timezone.utc).astimezone()
    if now is None:
        print('--now: ожидается ISO-время с зоной', file=sys.stderr)
        return 2
    since = now - dt.timedelta(hours=args.since_hours)
    if args.log_utc_offset:
        sign = -1 if args.log_utc_offset.startswith('-') else 1
        hh, mm = args.log_utc_offset.lstrip('+-').split(':')
        log_tz = dt.timezone(sign * dt.timedelta(hours=int(hh), minutes=int(mm)))
    else:
        log_tz = dt.datetime.now().astimezone().tzinfo
    ignore = set(args.ignore_ip)
    notes = []

    if args.nginx_log:
        ng = analyze_nginx(iter_file(args.nginx_log), iter_file(args.nginx_err) if args.nginx_err else (), since, ignore)
    else:
        ng, note = docker_nginx_stats(args.since_hours, since, ignore)
        if note:
            notes.append(note)
    f2b_text = ''.join(read_text(p) for p in args.fail2ban_log) if args.fail2ban_log else read_root_logs(['fail2ban.log.1', 'fail2ban.log'])
    auth_text = ''.join(read_text(p) for p in args.auth_log) if args.auth_log else read_root_logs(['auth.log.1', 'auth.log'])
    if not f2b_text:
        notes.append('fail2ban.log не прочитан')
    if not auth_text:
        notes.append('auth.log не прочитан')

    f2b = analyze_fail2ban(f2b_text, since, log_tz)
    auth = analyze_auth(auth_text, since, ignore)
    mod = analyze_moderation(read_text(args.moderation_log), since)
    relay = analyze_relay(read_text(args.relay_log))
    closed = closed_crawlers(load_robots(args.robots))
    facts = {} if args.no_host else host_facts()

    prev = None
    try:
        prev = json.loads(Path(args.state).read_text(encoding='utf-8')).get('metrics')
    except (OSError, ValueError):
        pass
    subject, body, metrics, warn = build_report(args, now, since, ng, f2b, auth, mod, relay, closed, facts, prev)
    if notes:
        body += '\n\nПримечания сбора: ' + '; '.join(notes)
        subject += ' (сбор неполный)'

    print(subject)
    print(body)
    rc = 0
    if not args.dry_run:
        rc = send_mail(args, subject, body)
    if args.no_state or (args.dry_run and not args.write_state):
        return rc
    try:
        Path(args.state).parent.mkdir(parents=True, exist_ok=True)
        Path(args.state).write_text(json.dumps({'generated_at': now.isoformat(), 'metrics': metrics, 'warnings': warn}, ensure_ascii=False, indent=1), encoding='utf-8')
    except OSError as exc:
        print(f'state not written: {exc}', file=sys.stderr)
    return rc


if __name__ == '__main__':
    sys.exit(main())
