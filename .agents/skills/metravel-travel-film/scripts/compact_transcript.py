#!/usr/bin/env python3
"""Печатает расшифровку mlx_whisper (JSON) компактно: таймкод и фраза, повторы свёрнуты.

Запуск: python3 compact_transcript.py <tr/audio16k.json> [начало_сек] [конец_сек]
Подозрительные места (бред на музыке) помечаются «?»: низкая уверенность или высокая вероятность тишины.
"""
import json
import sys


def main() -> None:
    data = json.load(open(sys.argv[1]))
    t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    t1 = float(sys.argv[3]) if len(sys.argv) > 3 else 1e12
    prev, rep, out = None, 0, []
    for seg in data["segments"]:
        a, text = seg["start"], seg["text"].strip()
        if a < t0 or a > t1 or not text:
            continue
        if text == prev:
            rep += 1
            continue
        if rep:
            out[-1] += f" (x{rep + 1})"
        prev, rep = text, 0
        doubt = "?" if seg.get("no_speech_prob", 0) > 0.5 or seg.get("avg_logprob", 0) < -0.9 else " "
        out.append(f"{int(a // 60):02d}:{a % 60:04.1f}{doubt}{text}")
    if rep:
        out[-1] += f" (x{rep + 1})"
    print("\n".join(out))


if __name__ == "__main__":
    main()
