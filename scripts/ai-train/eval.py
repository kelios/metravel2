#!/usr/bin/env python3
"""Side-by-side evaluation of the base model and a LoRA adapter on the fixed
prompt set (eval_prompts.jsonl): generates both answers for every prompt and
checks them automatically against the exported corpus.

Usage (inside the training folder's venv, model/adapter paths relative to it):
    AI_HOME=~/metravel-ai $AI_HOME/venv/bin/python scripts/ai-train/eval.py \
        --adapter adapters/metravel-llm-v0 --out logs/eval-v0

Automatic checks per answer:
  * urls_ok      — every metravel.by URL in the answer exists in data/raw
                   (article slug, quest URL or the two catalogue pages);
  * urls_unknown — links to metravel.by pages that do not exist (made up);
  * external     — links to other sites (forbidden by the system prompt);
  * refused      — the answer says the site has no material on the topic.
A prompt with expect=answer passes when there is at least one known URL,
no unknown and no external link; expect=refuse passes when the model refuses
and invents no URL. Language, factual accuracy and tone are still read by a
human — the report leaves a column for that.

Output: <out>/results.jsonl (both answers + checks) and <out>/report.md.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from build_dataset import SITE, SYSTEM  # noqa: E402

URL_RE = re.compile(r"https?://[^\s)\]>»\"']+")
REFUSE_RE = re.compile(r"(пока\s+)?нет\s+(материал|стат|квест|ничего)|не\s+нашл|нет\s+информации|brak\s+materia|nie\s+ma(my)?\s+(materia|artyku)", re.I)
THINK_RE = re.compile(r"<think>.*?</think>\s*", re.S)


def known_urls(raw: Path) -> set[str]:
    urls = {f"{SITE}/travels", f"{SITE}/quests", f"{SITE}/travels/", f"{SITE}/quests/", SITE, SITE + "/"}
    for line in (raw / "travels.jsonl").open(encoding="utf-8"):
        t = json.loads(line)
        urls.add(f"{SITE}/travels/{t['slug']}")
    qf = raw / "quests.jsonl"
    if qf.exists():
        for line in qf.open(encoding="utf-8"):
            q = json.loads(line)
            if q.get("url"):
                urls.add(q["url"].rstrip("/"))
    return urls


def check(answer: str, known: set[str]) -> dict:
    found = [u.rstrip(".,;:/") for u in URL_RE.findall(answer)]
    ours = [u for u in found if u.startswith(SITE)]
    external = [u for u in found if not u.startswith(SITE)]
    unknown = [u for u in ours if u not in known]
    return {
        "urls": found,
        "urls_ok": len(ours) - len(unknown),
        "urls_unknown": unknown,
        "external": external,
        "refused": bool(REFUSE_RE.search(answer)),
    }


def verdict(expect: str, c: dict) -> bool:
    if c["external"] or c["urls_unknown"]:
        return False
    if expect == "refuse":
        return c["refused"]
    return c["urls_ok"] > 0


def generate_all(model_path: str, adapter: str | None, prompts: list[dict], max_tokens: int) -> tuple[list[str], float]:
    from mlx_lm import load, generate
    from mlx_lm.sample_utils import make_sampler

    model, tokenizer = load(model_path, adapter_path=adapter)
    sampler = make_sampler(temp=0.0)
    out, toks, secs = [], 0, 0.0
    for i, p in enumerate(prompts, 1):
        msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": p["prompt"]}]
        text = tokenizer.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False, enable_thinking=False)
        t0 = time.time()
        ans = generate(model, tokenizer, prompt=text, max_tokens=max_tokens, sampler=sampler, verbose=False)
        secs += time.time() - t0
        toks += len(tokenizer.encode(ans))
        ans = THINK_RE.sub("", ans).strip()
        out.append(ans)
        print(f"  [{i}/{len(prompts)}] {p['id']} {len(ans)} chars", file=sys.stderr)
    return out, (toks / secs if secs else 0.0)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ai-home", default=None, help="training folder (default: $AI_HOME)")
    ap.add_argument("--model", default="models/Qwen3.5-4B-MLX-4bit")
    ap.add_argument("--adapter", default="adapters/metravel-llm-v0")
    ap.add_argument("--prompts", default=str(HERE / "eval_prompts.jsonl"))
    ap.add_argument("--out", default="logs/eval")
    ap.add_argument("--max-tokens", type=int, default=500)
    ap.add_argument("--skip-base", action="store_true", help="reuse base answers from <out>/base.json")
    args = ap.parse_args()
    import os
    home = Path(args.ai_home or os.environ.get("AI_HOME") or ".").expanduser()
    out = home / args.out
    out.mkdir(parents=True, exist_ok=True)
    prompts = [json.loads(l) for l in Path(args.prompts).open(encoding="utf-8") if l.strip()]
    known = known_urls(home / "data" / "raw")

    base_file = out / "base.json"
    if args.skip_base and base_file.exists():
        base = json.loads(base_file.read_text(encoding="utf-8"))
        base_ans, base_tps = base["answers"], base["tps"]
    else:
        print("== base", file=sys.stderr)
        base_ans, base_tps = generate_all(str(home / args.model), None, prompts, args.max_tokens)
        base_file.write_text(json.dumps({"answers": base_ans, "tps": base_tps}, ensure_ascii=False), encoding="utf-8")
    print("== adapter", args.adapter, file=sys.stderr)
    ad_ans, ad_tps = generate_all(str(home / args.model), str(home / args.adapter), prompts, args.max_tokens)

    rows, totals = [], {"base": {}, "v": {}}
    with (out / "results.jsonl").open("w", encoding="utf-8") as fh:
        for p, b, a in zip(prompts, base_ans, ad_ans):
            cb, ca = check(b, known), check(a, known)
            row = {**p, "base": {"answer": b, **cb, "pass": verdict(p["expect"], cb)}, "adapter": {"answer": a, **ca, "pass": verdict(p["expect"], ca)}}
            rows.append(row)
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            for side, key in (("base", "base"), ("v", "adapter")):
                g = totals[side].setdefault(p["group"], [0, 0])
                g[0] += int(row[key]["pass"])
                g[1] += 1

    def cell(r: dict) -> str:
        flags = []
        if r["urls_ok"]:
            flags.append(f"{r['urls_ok']} наших URL")
        if r["urls_unknown"]:
            flags.append(f"{len(r['urls_unknown'])} выдуманных")
        if r["external"]:
            flags.append(f"{len(r['external'])} чужих")
        if r["refused"]:
            flags.append("отказ")
        return ("✅" if r["pass"] else "❌") + " " + (", ".join(flags) or "без ссылок")

    md = [f"# Оценка {args.adapter} против базы", "", f"База: {base_tps:.1f} ток/с, адаптер: {ad_tps:.1f} ток/с (генерация, greedy, max {args.max_tokens}).", ""]
    md.append("| группа | база | адаптер |")
    md.append("| --- | --- | --- |")
    for g in totals["v"]:
        md.append(f"| {g} | {totals['base'][g][0]}/{totals['base'][g][1]} | {totals['v'][g][0]}/{totals['v'][g][1]} |")
    md += ["", "| id | группа | вопрос | ожидание | база | адаптер | ручная оценка |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for r in rows:
        md.append(f"| {r['id']} | {r['group']} | {r['prompt']} | {r['expect']} | {cell(r['base'])} | {cell(r['adapter'])} |  |")
    md += ["", "## Ответы", ""]
    for r in rows:
        md += [f"### {r['id']} — {r['prompt']}", "", "**База:**", "", r["base"]["answer"] or "_(пусто)_", "", f"**{args.adapter}:**", "", r["adapter"]["answer"] or "_(пусто)_", ""]
    (out / "report.md").write_text("\n".join(md), encoding="utf-8")
    print(json.dumps({"base_tps": round(base_tps, 1), "adapter_tps": round(ad_tps, 1), "totals": totals}, ensure_ascii=False), file=sys.stderr)
    print(out / "report.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
