#!/usr/bin/env python3
"""Свежесть бэкапа прод-базы: возраст последней копии и две последние ночи (борд #3208).

Единственный владелец порога `MAX_AGE_HOURS` и правила, по которому считается возраст.
Потребителей два, и оба берут этот файл, а не переписывают числа:

  * `scripts/enable-prod-db-backup.sh --verify` везёт исходник в ssh-payload и
    запускает на прод-хосте как CLI (на хост ничего не пишется);
  * `scripts/security-report.py` импортирует копию, которую кладёт рядом с ним
    `scripts/enable-prod-security-report.sh`, и печатает возраст в ежедневном письме.

Возраст копии — «сейчас» минус UTC-метка в имени архива
`metravel-postgres-YYYYMMDDTHHMMSSZ.sql.gz`, одинаково для каталога и для S3.
Метку ставит сам скрипт бэкапа в момент снятия дампа, поэтому она отвечает на
нужный вопрос — «насколько стары данные в копии». mtime файла и колонка времени
`aws s3 ls` отвечают на другой («когда файл трогали»): их сдвигает `cp`, `touch`
и повторная выгрузка, а время листинга ещё и печатается в зоне хоста.

Только стандартная библиотека; работает одинаково на Linux прода и macOS теста.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import subprocess
import sys

MAX_AGE_HOURS = 26
# Запас на расхождение часов: метка «из будущего» дальше этого — не свежая копия, а сбой.
FUTURE_SLACK_HOURS = 1
STALE_WORD = 'ПРОСРОЧЕНО'
DEFAULT_ENV_FILE = '~/.metravel-backup.env'
ARCHIVE_RE = re.compile(r'(?:^|\s)(metravel-postgres-(\d{8}T\d{6})Z\.sql\.gz)$')
COMPLETED_RE = re.compile(r'^\[(\d{4}-\d{2}-\d{2})T[^\]]*\] Backup completed')
COPIES = (('local', 'локальный архив'), ('s3', 'объект в S3'))


def newest_archive(lines):
    """Самый поздний архив по UTC-метке в имени. `lines` — имена файлов или строки `aws s3 ls`."""
    best = None
    for line in lines:
        match = ARCHIVE_RE.search(line.strip())
        if not match:
            continue
        try:
            taken = dt.datetime.strptime(match.group(2), '%Y%m%dT%H%M%S').replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        if best is None or taken > best[1]:
            best = (match.group(1), taken)
    return best


def copy_state(lines, now, error=''):
    found = newest_archive(lines)
    if not found:
        return {'name': None, 'age_hours': None, 'ok': False, 'error': error or 'архивов нет'}
    name, taken = found
    age = (now - taken).total_seconds() / 3600
    return {'name': name, 'age_hours': age, 'ok': -FUTURE_SLACK_HOURS <= age <= MAX_AGE_HOURS, 'error': ''}


def describe(label, state):
    if state['name'] is None:
        return f'{label}: {STALE_WORD} — {state["error"]}'
    age = f'{state["age_hours"]:.1f} ч'
    if state['ok']:
        return f'{label}: {age} — {state["name"]} (порог {MAX_AGE_HOURS} ч)'
    if state['age_hours'] < 0:
        return f'{label}: метка архива из будущего ({age}) — {state["name"]}, сверить часы хоста'
    return f'{label}: {STALE_WORD} — {age} при пороге {MAX_AGE_HOURS} ч ({state["name"]})'


def summarize(states):
    """Строки для вывода и те из них, что требуют внимания."""
    lines = []
    problems = []
    for key, label in COPIES:
        text = describe(label, states[key])
        lines.append(text)
        if not states[key]['ok']:
            problems.append(text)
    return {'lines': lines, 'problems': problems}


def last_two_nights(log_lines, now):
    """Две последние ночи — сутки UTC, как их пишет лог бэкапа.

    Якорь — сегодня, если сегодняшний прогон уже завершился, иначе вчера: до ночного
    запуска сегодняшней даты в логе быть не может, и это не пропуск.
    """
    done = set()
    for line in log_lines:
        match = COMPLETED_RE.match(line)
        if match:
            done.add(match.group(1))
    today = now.astimezone(dt.timezone.utc).date()
    anchor = today if today.isoformat() in done else today - dt.timedelta(days=1)
    required = [anchor.isoformat(), (anchor - dt.timedelta(days=1)).isoformat()]
    return {'required': required, 'missing': [day for day in required if day not in done]}


def describe_nights(nights):
    span = ' и '.join(nights['required'])
    if nights['missing']:
        return f'две последние ночи (сутки UTC {span}): нет Backup completed за {", ".join(nights["missing"])}'
    return f'две последние ночи (сутки UTC {span}): Backup completed в обеих'


def read_env(path):
    """`KEY=value` из конфига бэкапа; его пишет enable-prod-db-backup.sh, кавычек и подстановок там нет."""
    values = {}
    try:
        with open(path, encoding='utf-8', errors='replace') as handle:
            for raw in handle:
                line = raw.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    values[key.strip()] = value.strip()
    except OSError:
        pass
    return values


def list_local(backup_dir):
    try:
        return os.listdir(backup_dir), ''
    except OSError as exc:
        return [], f'каталог не читается ({type(exc).__name__})'


def list_s3(aws_cli, s3_uri):
    if not aws_cli or not s3_uri:
        return [], 'в конфиге бэкапа нет AWS_CLI или S3_URI'
    try:
        proc = subprocess.run([aws_cli, 's3', 'ls', s3_uri.rstrip('/') + '/'], capture_output=True,
                              stdin=subprocess.DEVNULL, timeout=90, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return [], f'листинг S3 не удался ({type(exc).__name__})'
    if proc.returncode != 0:
        return [], f'листинг S3 не удался (rc={proc.returncode})'
    return proc.stdout.decode('utf-8', 'replace').splitlines(), ''


def collect(now, backup_dir=None, s3_listing=None, env_file=DEFAULT_ENV_FILE):
    """Состояние обеих копий. Без явных входов раскладку хоста даёт конфиг бэкапа."""
    env = read_env(os.path.expanduser(env_file)) if backup_dir is None or s3_listing is None else {}
    local_lines, local_error = list_local(backup_dir or env.get('BACKUP_DIR') or os.path.expanduser('~/db-backups'))
    if s3_listing is None:
        s3_lines, s3_error = list_s3(env.get('AWS_CLI'), env.get('S3_URI'))
    else:
        s3_lines, s3_error = s3_listing.splitlines(), ''
    return {'local': copy_state(local_lines, now, local_error), 's3': copy_state(s3_lines, now, s3_error)}


def parse_now(value):
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    parsed = dt.datetime.fromisoformat(value[:-1] + '+00:00' if value.endswith('Z') else value)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.timezone.utc)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Свежесть бэкапа прод-базы: код 1, если копия старше порога.')
    parser.add_argument('--backup-dir', required=True, help='каталог локальных архивов')
    parser.add_argument('--s3-listing', required=True, help='файл с выводом `aws s3 ls` или `-` для stdin')
    parser.add_argument('--log', action='append', default=[], help='лог бэкапа (можно несколько: ротация)')
    parser.add_argument('--now', help='ISO-время «сейчас» (для тестов)')
    args = parser.parse_args(argv)
    now = parse_now(args.now)
    # Вывод — кириллица; по ssh локаль хоста может оказаться не UTF-8, и print упал бы
    # UnicodeEncodeError — ложным красным вместо результата проверки.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')

    if args.s3_listing == '-':
        listing = sys.stdin.read()
    else:
        with open(args.s3_listing, encoding='utf-8', errors='replace') as handle:
            listing = handle.read()
    summary = summarize(collect(now, backup_dir=args.backup_dir, s3_listing=listing))
    failed = bool(summary['problems'])
    for line in summary['lines']:
        print(('❌ ' if line in summary['problems'] else '') + line)

    if args.log:
        log_lines = []
        for path in args.log:
            try:
                with open(path, encoding='utf-8', errors='replace') as handle:
                    log_lines.extend(handle.read().splitlines())
            except OSError:
                pass
        nights = last_two_nights(log_lines, now)
        failed = failed or bool(nights['missing'])
        print(('❌ ' if nights['missing'] else '') + describe_nights(nights))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
