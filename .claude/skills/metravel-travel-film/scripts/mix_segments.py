#!/usr/bin/env python3
"""Сводит звук отрезков в одну дорожку с кроссфейдом на стыках.

Запуск: uv run --with numpy --with soundfile mix_segments.py manifest.json out.wav
manifest — список {"file", "pre", "post", "dur"}: звук отрезка записан с запасом
pre секунд до начала и post секунд после конца. На стыке хвост предыдущего
отрезка линейно затухает, а начало следующего нарастает; сумма весов равна 1,
поэтому непрерывный материал восстанавливается без провала. Длительность
результата равна сумме dur — синхрон с видео сохраняется.
"""
import json
import sys

import numpy as np
import soundfile as sf


def main() -> None:
    segs = json.load(open(sys.argv[1]))
    sr = sf.info(segs[0]["file"]).samplerate
    total = int(round(sum(s["dur"] for s in segs) * sr))
    out = np.zeros((total, 2), dtype=np.float32)
    pos = 0.0
    for i, s in enumerate(segs):
        data, r = sf.read(s["file"], dtype="float32", always_2d=True)
        assert r == sr, "частоты дискретизации отрезков различаются"
        pre, post = int(round(s["pre"] * sr)), int(round(s["post"] * sr))
        body = int(round(s["dur"] * sr))
        data = data[: pre + body + post]
        w = np.ones(len(data), dtype=np.float32)
        prev_post = int(round(segs[i - 1]["post"] * sr)) if i > 0 else 0
        nxt_pre = int(round(segs[i + 1]["pre"] * sr)) if i + 1 < len(segs) else 0
        # нарастание: от -x до +x вокруг начала тела, где x ограничен запасами обеих сторон
        x_in = min(pre, prev_post) if i > 0 else 0
        if i == 0:
            w[:pre] = 0.0
        else:
            w[: pre - x_in] = 0.0
            if x_in:
                w[pre - x_in: pre + x_in] = np.linspace(0, 1, 2 * x_in, endpoint=False, dtype=np.float32)
        x_out = min(post, nxt_pre) if i + 1 < len(segs) else 0
        end = pre + body
        if i + 1 == len(segs):
            w[end:] = 0.0
        else:
            w[end + x_out:] = 0.0
            if x_out:
                w[end - x_out: end + x_out] = np.linspace(1, 0, 2 * x_out, endpoint=False, dtype=np.float32)
        start = int(round(pos * sr)) - pre
        a, b = max(0, start), min(total, start + len(data))
        out[a:b] += (data * w[:, None])[a - start: b - start]
        pos += s["dur"]
    sf.write(sys.argv[2], out, sr, subtype="FLOAT")
    print(f"сведено отрезков: {len(segs)}, длительность {total / sr:.2f} с")


if __name__ == "__main__":
    main()
