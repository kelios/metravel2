#!/usr/bin/env python3
"""Мастеринг звука фильма: выравнивание кусков, цель по громкости, ограничение пиков.

Запуск: python3 master_audio.py in.wav out.wav [--target -14] [--tp -1.5] [--leveler 0.6]

Шаги:
1. Выравнивание (leveler > 0): по кратковременной громкости (EBU R128, окно 3 с)
   строится плавная кривая усиления. Громкие места приглушаются, тихая речь
   подтягивается, шум и паузы не поднимаются. leveler — доля компенсации
   отклонения от типичной громкости фильма (0 выключает, 1 — полное выравнивание).
2. Общее усиление до целевой интегральной громкости.
3. Компрессор снимает редкие выбросы (хлопки, порывы ветра), чтобы ограничитель
   не работал постоянно. Ограничитель пиков считает на частоте 192 кГц: без
   передискретизации межотсчётные пики уходят выше цели на 2–3 дБ. Запас 0.5 дБ
   оставлен на кодирование в AAC.
--highpass срезает гул ниже указанной частоты (0 выключает).
Печатает измерения до и после. Зависимости: только ffmpeg и стандартная библиотека.
"""
import argparse
import math
import os
import re
import subprocess
import tempfile

HOP = 0.1  # шаг измерений ebur128, с


def measure(path: str) -> dict:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", path, "-af", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    tail = r.stderr[-1500:]
    out = {}
    for key, pat in (("I", r"I:\s+(-?[\d.]+) LUFS"), ("LRA", r"LRA:\s+(-?[\d.]+) LU"),
                     ("TP", r"Peak:\s+(-?[\d.]+) dBFS")):
        m = re.findall(pat, tail)
        out[key] = float(m[-1]) if m else float("nan")
    return out


def short_term(path: str) -> list[float]:
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
        meta = f.name
    subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-i", path, "-af",
                    f"ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file={meta}", "-f", "null", "-"],
                   check=True)
    vals = [float(m) for m in re.findall(r"lavfi\.r128\.S=(-?[\d.]+)", open(meta).read())]
    os.unlink(meta)
    return vals


def median(xs: list[float]) -> float:
    s = sorted(xs)
    return s[len(s) // 2] if s else 0.0


def smooth(xs: list[float], radius: int) -> list[float]:
    """Скользящее среднее, два прохода — близко к гауссову окну."""
    for _ in range(2):
        acc, out, n = 0.0, [], len(xs)
        csum = [0.0]
        for x in xs:
            acc += x
            csum.append(acc)
        for i in range(n):
            a, b = max(0, i - radius), min(n, i + radius + 1)
            out.append((csum[b] - csum[a]) / (b - a))
        xs = out
    return xs


def gain_curve(st: list[float], strength: float, max_boost: float = 5.0, max_cut: float = 6.0) -> list[float]:
    active = [s for s in st if s > -40]
    ref = median(active)
    # окно ebur128 смотрит на 3 с назад: сдвигаем измерение к центру окна
    shift = int(1.5 / HOP)
    centered = st[shift:] + [st[-1]] * shift if st else st
    gains = []
    for s in centered:
        dev = ref - s
        if dev > 0:  # тише типичного
            # тихую речь подтягиваем; всё, что тише типичного на 14+ LU, считаем фоном
            fade = max(0.0, min(1.0, (14.0 - dev) / 6.0))
            g = min(max_boost, dev * strength) * fade
        else:
            g = max(-max_cut, dev * strength)
        gains.append(g)
    return smooth(gains, int(2.0 / HOP))


def volume_expr_file(gains: list[float], step: float = 1.0) -> str:
    """Команды sendcmd: громкость меняется ступенями каждые step секунд.

    Кривая заранее сглажена окном 2 с, поэтому соседние ступени отличаются на доли децибела."""
    lines = []
    stride = max(1, int(step / HOP))
    for i in range(0, len(gains), stride):
        t = i * HOP
        lines.append(f"{t:.2f} volume@lev volume {10 ** (gains[i] / 20):.5f};")
    with tempfile.NamedTemporaryFile("w", suffix=".cmd", delete=False) as f:
        f.write("\n".join(lines))
        return f.name


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--target", type=float, default=-14.0)
    ap.add_argument("--tp", type=float, default=-1.5)
    ap.add_argument("--leveler", type=float, default=0.6)
    ap.add_argument("--highpass", type=float, default=0.0)
    args = ap.parse_args()

    before = measure(args.src)
    print(f"до:    I {before['I']:.1f} LUFS, LRA {before['LRA']:.1f} LU, пик {before['TP']:.1f} dBFS")

    work = args.src
    tmp_level = None
    if args.leveler > 0:
        st = short_term(args.src)
        gains = gain_curve(st, args.leveler)
        cmdfile = volume_expr_file(gains, step=0.5)
        tmp_level = args.dst + ".level.wav"
        subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i", args.src,
                        "-af", f"asendcmd=f={cmdfile},volume@lev=volume=1:eval=frame:precision=float",
                        "-c:a", "pcm_f32le", tmp_level], check=True)
        os.unlink(cmdfile)
        work = tmp_level
        mid = measure(work)
        print(f"после выравнивания: I {mid['I']:.1f} LUFS, LRA {mid['LRA']:.1f} LU, пик {mid['TP']:.1f} dBFS "
              f"(усиление от {min(gains):.1f} до {max(gains):.1f} дБ)")
    else:
        mid = before

    limit_db = args.tp - 0.5
    gain = args.target - mid["I"]
    hp = f"highpass=f={args.highpass}," if args.highpass > 0 else ""
    # порог компрессора — на 4 дБ ниже предела ограничителя: речь он не трогает
    comp = (f"acompressor=threshold={10 ** ((limit_db - 4) / 20):.5f}:ratio=3:attack=5:release=120:knee=4,")
    for attempt in range(4):
        subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-i", work, "-af",
                        f"{hp}volume={gain:.2f}dB,{comp}aresample=192000,"
                        f"alimiter=limit={10 ** (limit_db / 20):.5f}:attack=5:release=80:level=disabled,"
                        "aresample=48000",
                        "-c:a", "pcm_s24le", args.dst], check=True)
        after = measure(args.dst)
        miss = args.target - after["I"]
        if abs(miss) <= 0.3 or attempt == 3:
            break
        gain += miss  # ограничитель съел часть громкости — добираем следующей попыткой
    if tmp_level:
        os.unlink(tmp_level)
    print(f"после: I {after['I']:.1f} LUFS, LRA {after['LRA']:.1f} LU, пик {after['TP']:.1f} dBFS "
          f"(общее усиление {gain:+.1f} дБ, предел ограничителя {limit_db:.1f} dBFS)")
    if after["TP"] > args.tp + 0.2:
        print("ВНИМАНИЕ: истинный пик выше цели, уменьшите --tp или --target")


if __name__ == "__main__":
    main()
