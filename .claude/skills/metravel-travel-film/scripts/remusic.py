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
     "runs": [{"a": 1056.73, "b": 1184.77, "src_in": 0.0}],   # куски трека из раскладки
     "new": "/путь/ES_new.mp3", "new_start": 0.0,
     "level_db": 0.0,                     # поправка к громкости старой музыки
     "lift_db": 4.0,                      # насколько громче в паузах речи
     "mute": [[1100.0, 1107.0]],          # окна, где новая музыка молчит (живой звук в кадре)
     "solo": [[1280.0, 1313.0]]}          # окна, где остаётся только музыка: речь и шум плана убираются
                                          # (на экране титры-субтитры говорят другое, чем голос)
  ]
}
--check только измеряет, насколько чисто вычитается старая музыка, и ничего не пишет.
Глубина подавления измеряется там, где музыка звучит одна (титр, заставка):
16 дБ и больше достаточно, меньше 10 дБ — старая музыка будет слышна, замену
в этом месте не делать.
"""
import argparse
import json
import shutil
import subprocess

import numpy as np
import soundfile as sf
from scipy.linalg import solve_toeplitz
from scipy.ndimage import median_filter
from scipy.signal import correlate, fftconvolve

TAPS = 513
PAD = 1.5  # запас при декодировании старого трека, с


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
    c = correlate(xm[:win], mm[: win + int((lead + PAD) * sr)], mode="full", method="fft")
    zero = len(mm[: win + int((lead + PAD) * sr)]) - 1
    k = int(np.argmax(np.abs(c)))
    lag = k - zero
    peak = float(np.abs(c[k]) / (np.linalg.norm(xm[:win]) * np.linalg.norm(mm[:win]) + 1e-9))
    if lag <= 0:
        ms = m[-lag: -lag + n]
    else:
        ms = np.vstack([np.zeros((lag, 2), np.float32), m])[:n]
    if len(ms) < n:
        ms = np.vstack([ms, np.zeros((n - len(ms), 2), np.float32)])
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
    k = max(1, int(seconds * sr))
    c = np.cumsum(np.concatenate([[0.0], env.astype(np.float64)]))
    out = (c[k:] - c[:-k]) / k
    return np.concatenate([np.full(k // 2, out[0]), out, np.full(len(env) - len(out) - k // 2, out[-1])]).astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    spec = json.load(open(args.spec))
    info = sf.info(spec["src"])
    sr = info.samplerate
    if not args.check:
        shutil.copyfile(spec["src"], spec["out"])
        dst = sf.SoundFile(spec["out"], "r+")
    src = sf.SoundFile(spec["src"])

    for job in spec["jobs"]:
        a, b = job["range"]
        i0, n = int(round(a * sr)), int(round((b - a) * sr))
        src.seek(i0)
        x = src.read(n, dtype="float32", always_2d=True)
        est_total = np.zeros_like(x)
        for run in job["runs"]:
            r0, r1 = int(round((run["a"] - a) * sr)), int(round((run["b"] - a) * sr))
            est, peak = estimate_music(x[r0:r1], job["old"], run["src_in"], sr)
            est_total[r0:r1] = est
            print(f"{job['name']}: кусок {run['a']:.1f}-{run['b']:.1f} выровнен, корреляция {peak:.2f}, "
                  f"старая музыка {db(est):.1f} дБ при миксе {db(x[r0:r1]):.1f} дБ")
        res = x - est_total
        sp = speech_mask(spec["words"], spec.get("words_offset", 0.0), a, b, sr)
        active = np.abs(est_total).sum(1) > 0
        quiet = active & ~sp
        if quiet.sum() > sr:
            print(f"{job['name']}: вне речи микс {db(x[quiet]):.1f} дБ → остаток {db(res[quiet]):.1f} дБ")
        if args.check:
            continue

        new = decode(job["new"], job.get("new_start", 0.0), (b - a) + 0.5, sr)
        if len(new) < n:
            raise SystemExit(f"{job['name']}: новый трек короче места ({len(new) / sr:.1f} с из {n / sr:.1f} с)")
        new = new[:n]
        old_level = db(est_total[active]) if active.any() else -40.0
        loud = np.abs(new).sum(1) > 1e-4
        scale = 10 ** ((old_level + job.get("level_db", 0.0) - db(new[loud])) / 20)
        lift = 10 ** (job.get("lift_db", 4.0) / 20)
        env = np.where(sp, 1.0, lift).astype(np.float32)
        for m0, m1 in job.get("mute", []):
            env[max(0, int((m0 - a) * sr)): max(0, int((m1 - a) * sr))] = 0.0
        keep = np.ones(n, dtype=np.float32)
        for s0, s1 in job.get("solo", []):
            j0, j1 = max(0, int((s0 - a) * sr)), max(0, int((s1 - a) * sr))
            keep[j0:j1] = 0.0
            env[j0:j1] = lift
        keep = smooth(keep, sr, 0.5)
        res = res * keep[:, None]
        env = smooth(env, sr, 0.8)
        edge = min(int(1.5 * sr), n // 4)
        env[:edge] *= np.linspace(0, 1, edge, dtype=np.float32)
        env[-edge:] *= np.linspace(1, 0, edge, dtype=np.float32)
        out = res + new * (scale * env)[:, None]
        dst.seek(i0)
        dst.write(out)
        print(f"{job['name']}: новая музыка {job['new'].split('/')[-1]} на уровне {old_level + job.get('level_db', 0.0):.1f} дБ "
              f"под речью, +{job.get('lift_db', 4.0)} дБ в паузах")
    if not args.check:
        dst.close()
        print("записано:", spec["out"])


if __name__ == "__main__":
    main()
