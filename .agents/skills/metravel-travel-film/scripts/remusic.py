#!/usr/bin/env python3
"""Заменяет музыку в уже сведённом звуке фильма, когда отдельных дорожек нет.

Запуск: uv run --with numpy --with scipy --with soundfile remusic.py spec.json [--check]

Идея: исходный музыкальный файл известен из раскладки Filmora. Его выравнивают
с миксом по времени, подгоняют фильтром и громкостью и вычитают — в миксе
остаются речь и шумы плана. Затем подмешивается новый трек: под речью тише,
в паузах громче. Исходный звук не меняется: результат пишется в копию WAV.

spec.json:
{
  "src": "/путь/audio_full.wav",          # звук источника (WAV, вся длина)
  "out": "/путь/audio_remusic.wav",
  "words": "/путь/tr/audio16k.json",      # расшифровка mlx_whisper с временами слов
  "words_offset": 0,                      # сколько вычесть из времён слов, чтобы попасть в src
  "jobs": [
    {"name": "кухня",
     "range": [1056.73, 1184.77],         # где в src играет заменяемый трек
     "old": "/путь/ES_old.mp3",
     "runs": [{"a": 1056.73, "b": 1184.77, "src_in": 0.0,     # куски трека из раскладки
               "ramp_in": [1056.61, 1056.85],                  # необязательно: кроссфейд склейки, где вес
               "ramp_out": [1184.65, 1184.89]}],               # куска в миксе растёт от 0 до 1 и падает до 0
     "new": "/путь/ES_new.mp3", "new_start": 0.0,
     "new_at": 1056.73,                   # необязательно: где в src звучит точка new_start (по умолчанию начало range)
     "level_db": 0.0,                     # поправка к громкости старой музыки
     "lift_db": 4.0,                      # насколько громче в паузах речи
     "bridge": 0.5,                       # промежуток между кусками короче этого новая музыка проходит без паузы
     "mute": [[1100.0, 1107.0]],          # окна, где новая музыка молчит (живой звук в кадре)
     "solo": [[1280.0, 1313.0]]}          # окна, где остаётся только музыка: речь и шум плана убираются
                                          # (на экране титры-субтитры говорят другое, чем голос)
  ]
}
Новая музыка звучит только там, где стояла старая: между далеко разнесёнными
кусками она молчит, промежутки короче "bridge" (по умолчанию полсекунды)
проходит без паузы. Окна
заданий могут пересекаться (два трека встык с переходом): каждое задание
правит уже накопленный результат. Кусок короче секунды не вычитается, о нём
печатается предупреждение. Результат пишется во временный файл и занимает место
"out" только после успешного конца; "out" не может совпадать с "src".
--check только измеряет, насколько чисто вычитается старая музыка, и ничего не пишет.
Глубина подавления измеряется там, где музыка звучит одна (титр, заставка):
16 дБ и больше достаточно, меньше 10 дБ — старая музыка будет слышна, замену
в этом месте не делать.
"""
import argparse
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from scipy.linalg import solve_toeplitz
from scipy.ndimage import median_filter
from scipy.signal import correlate, fftconvolve

TAPS = 513
PAD = 1.5  # запас при декодировании старого трека, с
MIN_RUN = 1.0  # кусок короче не вычитается: фильтр по нему не подгоняется, с
BRIDGE = 0.5  # промежуток между кусками короче этого новая музыка проходит без паузы, с


def decode(path: str, start: float, dur: float, sr: int) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0.0, start):.4f}", "-t", f"{dur:.4f}", "-i", path,
                          "-ar", str(sr), "-ac", "2", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def db(v: np.ndarray) -> float:
    return 10 * np.log10(float((v.astype(np.float64) ** 2).mean()) + 1e-12)


def estimate_music(x: np.ndarray, old: str, src_in: float, sr: int) -> tuple[np.ndarray, float]:
    """Оценка старой музыки внутри отрезка микса x. Возвращает оценку и корреляцию выравнивания."""
    n = len(x)
    lead = min(PAD, src_in)
    m = decode(old, src_in - lead, n / sr + lead + PAD, sr)
    xm, mm = x.mean(1), m.mean(1)
    win = min(n, sr * 45)
    ref = mm[: win + int((lead + PAD) * sr)]
    c = correlate(xm[:win], ref, mode="full", method="fft")
    zero = len(ref) - 1
    # трек декодирован с запасом lead до своей точки входа: сдвиг ищется только в пределах запасов,
    # иначе на цикличной музыке победит сдвиг на такт
    lo, hi = max(0, zero - int((lead + PAD) * sr)), min(len(c) - 1, zero + int(PAD * sr))
    k = lo + int(np.argmax(np.abs(c[lo: hi + 1])))
    lag = k - zero
    if lag <= 0:
        ms = m[-lag: -lag + n]
    else:
        ms = np.vstack([np.zeros((lag, 2), np.float32), m])[:n]
    if len(ms) < n:
        ms = np.vstack([ms, np.zeros((n - len(ms), 2), np.float32)])
    msm = ms.mean(1)
    peak = float(abs(np.dot(xm[:win], msm[:win])) / (np.linalg.norm(xm[:win]) * np.linalg.norm(msm[:win]) + 1e-9))
    half = TAPS // 2
    est = np.zeros_like(x)
    for ch in range(2):
        mc, xc = ms[:, ch].astype(np.float64), x[:, ch].astype(np.float64)
        r = correlate(mc, mc, mode="full", method="fft")[len(mc) - 1: len(mc) - 1 + TAPS]
        p = correlate(xc, mc, mode="full", method="fft")[len(mc) - 1 - half: len(mc) - 1 - half + TAPS]
        r[0] *= 1.001
        h = solve_toeplitz(r, p)
        est[:, ch] = fftconvolve(mc, h, mode="full")[half: half + n]
    # громкость по блокам: автоматизация уровня и затухания в исходном монтаже
    blk, hop = int(2.0 * sr), int(0.5 * sr)
    centers, gains = [], []
    for i in range(0, max(1, n - blk + 1), hop):
        e, xx = est[i:i + blk], x[i:i + blk]
        gains.append(float((xx * e).sum()) / (float((e * e).sum()) + 1e-9))
        centers.append(i + blk / 2)
    g = median_filter(np.clip(np.array(gains), 0.0, 2.5), 5, mode="nearest") if len(gains) > 4 else np.array(gains)
    gi = np.interp(np.arange(n), centers, g).astype(np.float32) if len(g) > 1 else np.full(n, g[0], np.float32)
    return est * gi[:, None], peak


def speech_mask(words_path: str, offset: float, a: float, b: float, sr: int) -> np.ndarray:
    n = int(round((b - a) * sr))
    mask = np.zeros(n, dtype=bool)
    for seg in json.load(open(words_path))["segments"]:
        if seg.get("no_speech_prob", 0) > 0.6:
            continue
        for w in seg.get("words", []):
            i0 = int((w["start"] - offset - a - 0.6) * sr)
            i1 = int((w["end"] - offset - a + 0.6) * sr)
            if i1 > 0 and i0 < n:
                mask[max(0, i0): max(0, i1)] = True
    return mask


def smooth(env: np.ndarray, sr: int, seconds: float) -> np.ndarray:
    k = max(1, min(int(seconds * sr), len(env)))
    if k <= 1:
        return env.astype(np.float32)
    pad = np.concatenate([np.full(k // 2, env[0]), env, np.full(k - 1 - k // 2, env[-1])]).astype(np.float64)
    c = np.cumsum(np.concatenate([[0.0], pad]))
    return ((c[k:] - c[:-k]) / k).astype(np.float32)


def ramp(n: int, r0: int, a: float, sr: int, window, rising: bool) -> np.ndarray:
    """Вес куска в миксе на кроссфейде склейки: линейно между двумя временами окна."""
    t = a + (r0 + np.arange(n)) / sr
    w = np.clip((t - window[0]) / max(1e-6, window[1] - window[0]), 0.0, 1.0)
    return (w if rising else 1.0 - w).astype(np.float32)


def music_gate(runs: list, a: float, n: int, sr: int, bridge: float = BRIDGE) -> np.ndarray:
    """Где звучит новая музыка: на кусках старой, с плавным входом и выходом на краях каждой группы."""
    spans = sorted((max(0, int(round((r["a"] - a) * sr))), min(n, int(round((r["b"] - a) * sr)))) for r in runs)
    if not spans:
        return np.zeros(n, dtype=np.float32)
    groups = [list(spans[0])]
    for s0, s1 in spans[1:]:
        if s0 - groups[-1][1] <= bridge * sr:
            groups[-1][1] = max(groups[-1][1], s1)
        else:
            groups.append([s0, s1])
    gate = np.zeros(n, dtype=np.float32)
    for s0, s1 in groups:
        gate[s0:s1] = 1.0
        edge = min(int(1.5 * sr), (s1 - s0) // 4)
        if edge > 0:
            gate[s0:s0 + edge] *= np.linspace(0, 1, edge, dtype=np.float32)
            gate[s1 - edge:s1] *= np.linspace(1, 0, edge, dtype=np.float32)
    return gate


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    spec = json.load(open(args.spec))
    info = sf.info(spec["src"])
    sr = info.samplerate
    dst, part = None, spec["out"] + ".part.wav"
    if not args.check:
        if os.path.exists(spec["out"]) and os.path.samefile(spec["src"], spec["out"]):
            raise SystemExit("out совпадает с src: исходный звук не перезаписывается")
        # копия пишется заново, а не копированием файла: WAV из ffmpeg несёт текстовые поля в заголовке,
        # и библиотека отказывается открывать такой файл на чтение и запись
    src = sf.SoundFile(spec["src"])
    try:
        if not args.check:
            with sf.SoundFile(spec["src"]) as f, sf.SoundFile(part, "w", sr, info.channels, info.subtype) as g:
                for block in f.blocks(blocksize=1 << 20, dtype="float32", always_2d=True):
                    g.write(block)
            dst = sf.SoundFile(part, "r+")
        process(spec, args.check, src, dst, sr)
    except BaseException:
        if dst is not None:
            dst.close()
        if not args.check and os.path.exists(part):
            os.unlink(part)
        raise
    if dst is not None:
        dst.close()
        os.replace(part, spec["out"])
        print("записано:", spec["out"])


def solo_windows(spec: dict, sr: int, frames: int) -> list:
    """Окна solo всех заданий, слитые и расширенные на сглаживание краёв."""
    margin = int(0.5 * sr)
    spans = sorted((max(0, int(s0 * sr)), min(frames, int(s1 * sr)))
                   for job in spec["jobs"] for s0, s1 in job.get("solo", []))
    wins = []
    for s0, s1 in spans:
        if s1 <= s0:
            continue
        if wins and s0 - margin <= wins[-1]["w1"]:
            wins[-1]["cuts"].append((s0, s1))
            wins[-1]["w1"] = max(wins[-1]["w1"], min(frames, s1 + margin))
        else:
            wins.append({"w0": max(0, s0 - margin), "w1": min(frames, s1 + margin), "cuts": [(s0, s1)]})
    for w in wins:
        w["est"] = np.zeros((w["w1"] - w["w0"], 2), np.float32)
    return wins


def process(spec: dict, check: bool, src, dst, sr: int) -> None:
    solos = solo_windows(spec, sr, src.frames)
    for job in spec["jobs"]:
        a, b = job["range"]
        i0, n = int(round(a * sr)), int(round((b - a) * sr))
        src.seek(i0)
        x = src.read(n, dtype="float32", always_2d=True)
        n = len(x)
        est_total = np.zeros_like(x)
        for run in job["runs"]:
            r0, r1 = max(0, int(round((run["a"] - a) * sr))), min(n, int(round((run["b"] - a) * sr)))
            if r1 - r0 < MIN_RUN * sr:
                print(f"{job['name']}: ВНИМАНИЕ, кусок {run['a']:.2f}-{run['b']:.2f} короче {MIN_RUN} с — "
                      f"старая музыка в нём не вычитается")
                continue
            est, peak = estimate_music(x[r0:r1], job["old"], run["src_in"], sr)
            if run.get("ramp_in"):
                est *= ramp(r1 - r0, r0, a, sr, run["ramp_in"], True)[:, None]
            if run.get("ramp_out"):
                est *= ramp(r1 - r0, r0, a, sr, run["ramp_out"], False)[:, None]
            est_total[r0:r1] += est
            print(f"{job['name']}: кусок {run['a']:.1f}-{run['b']:.1f} выровнен, корреляция {peak:.2f}, "
                  f"старая музыка {db(est):.1f} дБ при миксе {db(x[r0:r1]):.1f} дБ")
        res = x - est_total
        for w in solos:  # оценки старой музыки всех заданий в окнах solo: нужны для общего прохода в конце
            lo, hi = max(i0, w["w0"]), min(i0 + n, w["w1"])
            if hi > lo:
                w["est"][lo - w["w0"]: hi - w["w0"]] += est_total[lo - i0: hi - i0]
        sp = speech_mask(spec["words"], spec.get("words_offset", 0.0), a, a + n / sr, sr)[:n]
        sp = np.concatenate([sp, np.zeros(n - len(sp), dtype=bool)])
        active = np.abs(est_total).sum(1) > 0
        quiet = active & ~sp
        if quiet.sum() > sr:
            print(f"{job['name']}: вне речи микс {db(x[quiet]):.1f} дБ → остаток {db(res[quiet]):.1f} дБ")
        if check:
            continue

        gate = music_gate(job["runs"], a, n, sr, job.get("bridge", BRIDGE))
        # range может начинаться на запас кроссфейда раньше музыки: новый трек привязан к new_at
        lead = job.get("new_at", a) - a
        shift = max(0, int(round(lead * sr)))
        # new_at раньше окна: трек к началу окна уже прошёл это время
        new = decode(job["new"], job.get("new_start", 0.0) + max(0.0, -lead), n / sr + 0.5, sr)
        new = np.vstack([np.zeros((shift, 2), np.float32), new])[:n]
        if len(new) < n:
            if gate[len(new):].any():
                raise SystemExit(f"{job['name']}: новый трек короче места ({len(new) / sr:.1f} с из {n / sr:.1f} с)")
            new = np.vstack([new, np.zeros((n - len(new), 2), np.float32)])
        old_level = db(est_total[active]) if active.any() else -40.0
        loud = np.abs(new).sum(1) > 1e-4
        if not loud.any():
            raise SystemExit(f"{job['name']}: новый трек на этом месте пуст")
        scale = 10 ** ((old_level + job.get("level_db", 0.0) - db(new[loud])) / 20)
        lift = 10 ** (job.get("lift_db", 4.0) / 20)
        env = np.where(sp, 1.0, lift).astype(np.float32)
        for m0, m1 in job.get("mute", []):
            env[max(0, int((m0 - a) * sr)): max(0, int((m1 - a) * sr))] = 0.0
        for s0, s1 in job.get("solo", []):
            env[max(0, int((s0 - a) * sr)): max(0, int((s1 - a) * sr))] = lift
        env = smooth(env, sr, 0.8) * gate
        # к накопленному результату прибавляется только вклад этого задания: пересекающиеся окна
        # соседних заданий не затирают друг друга
        dst.seek(i0)
        cur = dst.read(n, dtype="float32", always_2d=True)
        out = cur - est_total + new * (scale * env)[:, None]
        dst.seek(i0)
        dst.write(out)
        print(f"{job['name']}: новая музыка {job['new'].split('/')[-1]} на уровне {old_level + job.get('level_db', 0.0):.1f} дБ "
              f"под речью, +{job.get('lift_db', 4.0)} дБ в паузах")
    if check:
        return
    # окна solo — общим проходом после всех заданий: из результата уходит исходный звук без старой
    # музыки (речь и шум плана), а новая музыка любого задания остаётся
    for w in solos:
        n = w["w1"] - w["w0"]
        src.seek(w["w0"])
        x = src.read(n, dtype="float32", always_2d=True)
        keep = np.ones(len(x), dtype=np.float32)
        for s0, s1 in w["cuts"]:
            keep[s0 - w["w0"]: s1 - w["w0"]] = 0.0
        keep = smooth(keep, sr, 0.5)
        dst.seek(w["w0"])
        cur = dst.read(len(x), dtype="float32", always_2d=True)
        dst.seek(w["w0"])
        dst.write(cur - (x - w["est"][: len(x)]) * (1.0 - keep)[:, None])


if __name__ == "__main__":
    main()
