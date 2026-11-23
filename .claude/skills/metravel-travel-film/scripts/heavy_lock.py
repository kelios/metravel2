#!/usr/bin/env python3
"""Один замок на машину для всех тяжёлых заданий по исходникам: рендер, поиск машин, размытие и проверка лиц, проход кадров.

Замер 22.11 (GR21): рендер и два поиска машин разных серий разом — load 300, всё шло в 3–5 раз медленнее, чем по очереди.
Замок — flock на ~/.cache/metravel-film-render.lock (тот же файл, что у render_plan). В файле — кто держит: задание, pid, время;
ждущий печатает это. После задания запись стирается.

В скрипте:   import heavy_lock; heavy_lock.acquire("audit_frames s3_v20_1080.mp4")
             — ждёт замок (или выход с кодом 75 при wait=False), понижает приоритет (nice 10: рендер идёт первым).
Обёртка:     python3 heavy_lock.py [--no-wait] [--nice N] -- <команда …>   — для любого тяжёлого скрипта серии.
Вложенные вызовы (тяжёлый скрипт запускает другой) замок не берут повторно: держатель ставит METRAVEL_HEAVY_LOCK=1 в окружение.
Приоритет рендера (рецензент 23.11): ждущий рендер (render_plan, nice 0) ставит метку ~/.cache/metravel-film-render.wait-<pid>;
остальные ждут опросом раз в 2 с и, освободив себе замок, уступают, пока метка живого рендера есть. Порядок среди не-рендеров не гарантирован.
"""
import atexit, fcntl, os, subprocess, sys, time

LOCK = os.path.expanduser("~/.cache/metravel-film-render.lock")
WAIT_PREFIX = "metravel-film-render.wait-"   # метка ждущего рендера: ~/.cache/metravel-film-render.wait-<pid>
_held = None


def _render_waiting():
    """Живые рендеры, которые ждут замок (метки render.wait-<pid> рядом с замком)."""
    out = []
    for f in os.listdir(os.path.dirname(LOCK)):
        if not f.startswith(WAIT_PREFIX): continue
        try:
            pid = int(f[len(WAIT_PREFIX):]); os.kill(pid, 0); out.append(pid)
        except (ValueError, ProcessLookupError, PermissionError):
            try: os.remove(os.path.join(os.path.dirname(LOCK), f))   # метка упавшего рендера
            except OSError: pass
    return out


def acquire(label, nice=10, wait=True, render=None):
    """Взять замок тяжёлых заданий. nice — на сколько понизить приоритет (рендер — 0). render (по умолчанию nice == 0) — рендер:
    у него приоритет (рецензент 23.11): ждущий рендер оставляет метку, и остальные задания, даже освободив себе замок, уступают ему.
    Возвращает файл замка или None (уже держим)."""
    global _held
    if _held is not None or os.environ.get("METRAVEL_HEAVY_LOCK") == "1":
        return _held
    render = (nice == 0) if render is None else render
    if nice:
        try: os.nice(nice)
        except OSError: pass
    os.makedirs(os.path.dirname(LOCK), exist_ok=True)
    f = open(LOCK, "a+")                    # не "w": ждущий не должен стирать запись о том, кто держит замок
    told = False
    while True:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            if not told:
                f.seek(0); who = f.read().strip() or "запись пуста"
                print(f"очередь тяжёлых заданий: замок держит — {who}", flush=True)
                if not wait:
                    print(f"--no-wait: выхожу; повторите после него (замок {LOCK})", flush=True); sys.exit(75)
                print(f"«{label}» ждёт его окончания (одно тяжёлое задание на машину{'; рендер — первым' if render else ''})", flush=True)
                told = True
            if render:                           # рендер ждёт в flock и держит метку: остальные ему уступают
                mark = os.path.join(os.path.dirname(LOCK), f"{WAIT_PREFIX}{os.getpid()}")
                open(mark, "w").close()
                try: fcntl.flock(f, fcntl.LOCK_EX)
                finally:
                    try: os.remove(mark)
                    except OSError: pass
                break
            time.sleep(2); continue
        if not render and _render_waiting():     # замок свободен, но его ждёт рендер — уступить
            fcntl.flock(f, fcntl.LOCK_UN)
            if not told:
                print(f"«{label}» уступает очередь рендеру", flush=True); told = True
            time.sleep(2); continue
        break
    f.seek(0); f.truncate(); f.write(f"{label}, pid {os.getpid()}, с {time.strftime('%d.%m %H:%M')}\n"); f.flush()
    os.environ["METRAVEL_HEAVY_LOCK"] = "1"
    atexit.register(_release, f)
    _held = f
    return f


def _release(f):
    try: f.seek(0); f.truncate(); f.flush()
    except Exception: pass


def holder():
    """Кто держит замок сейчас: строка записи или None, если свободен."""
    f = open(LOCK, "a+") if os.path.exists(LOCK) else None
    if f is None: return None
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB); fcntl.flock(f, fcntl.LOCK_UN); return None
    except BlockingIOError:
        f.seek(0); return f.read().strip() or "запись пуста"


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a == ["status"]:
        h = holder(); print(f"замок держит: {h}" if h else "замок свободен"); sys.exit(0)
    if "--" not in a: print(__doc__); sys.exit(2)
    i = a.index("--"); opts, cmd = a[:i], a[i + 1:]
    nice = int(opts[opts.index("--nice") + 1]) if "--nice" in opts else 10
    acquire(" ".join(os.path.basename(x) if k == 0 else x for k, x in enumerate(cmd))[:160], nice=nice, wait="--no-wait" not in opts)
    sys.exit(subprocess.run(cmd).returncode)
