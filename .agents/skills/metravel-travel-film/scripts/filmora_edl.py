#!/usr/bin/env python3
"""Читает проект Filmora (.wfp) и печатает монтажную раскладку главного таймлайна.

Запуск: python3 filmora_edl.py <project.wfp> [--offset СЕК] [--json out.json]
Проект только читается: архив не распаковывается на диск и не меняется.
Единицы времени в проекте — 100 нс; в выводе — секунды и таймкод.
--offset сдвигает таймкоды (позиция части внутри склеенного фильма).
"""
import argparse
import json
import os
import zipfile
from urllib.parse import unquote

U = 1e7
KIND = {1: "video", 2: "audio"}


def tc(sec: float) -> str:
    m, s = divmod(sec, 60)
    return f"{int(m):02d}:{s:05.2f}"


def load_timeline(path: str) -> dict:
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.endswith("timeline.wesproj")]
        if not names:
            raise SystemExit("в проекте нет timeline.wesproj")
        # основной таймлайн — самый крупный файл
        name = max(names, key=lambda n: z.getinfo(n).file_size)
        return json.loads(z.read(name))


def clip_row(c: dict, offset: float) -> dict:
    fn = c.get("filename") or ""
    base = os.path.basename(unquote(fn)) if fn else (c.get("display") or c.get("name") or f"type{c.get('type')}")
    row = {
        "tl_in": c.get("tlBegin", 0) / U + offset,
        "tl_out": c.get("tlEnd", 0) / U + offset,
        "src": base,
        "path": unquote(fn).replace("file:/", "/", 1) if fn else "",
        "src_in": c.get("inPoint", 0) / U,
        "src_out": c.get("outPoint", 0) / U,
        "type": c.get("type"),
    }
    row["dur"] = row["tl_out"] - row["tl_in"]
    src_dur = row["src_out"] - row["src_in"]
    row["speed"] = round(src_dur / row["dur"], 3) if row["dur"] > 0 and src_dur > 0 else 1.0
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--json")
    args = ap.parse_args()

    d = load_timeline(args.project)
    cur = d.get("currentTimelineId")
    tls = d["timelineInfos"]
    main_tl = next((t for t in tls if t["timelineId"] == cur), tls[0])
    out = []
    for i, tr in enumerate(main_tl["trackInfos"]):
        clips = sorted((clip_row(c, args.offset) for c in tr.get("clipList", [])), key=lambda r: r["tl_in"])
        if not clips:
            continue
        kind = KIND.get(tr.get("trackType"), str(tr.get("trackType")))
        print(f"\n# дорожка {i} ({kind}), клипов {len(clips)}")
        for r in clips:
            sp = f" x{r['speed']}" if abs(r["speed"] - 1) > 0.01 else ""
            print(f"{tc(r['tl_in'])}-{tc(r['tl_out'])} {r['dur']:6.2f}s  {r['src']}  [{r['src_in']:.2f}-{r['src_out']:.2f}]{sp}")
        out.append({"track": i, "kind": kind, "clips": clips})
    if args.json:
        with open(args.json, "w") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
