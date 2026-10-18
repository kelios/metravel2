#!/usr/bin/env python3
"""Load/latency probe of a llama-server for the metravel-llm sizing table
(#2463 → numbers for #2457 compose limits and #2458 server choice).

Measures, against an OpenAI-compatible llama-server:
  * ttft_short_s   — time to first token, short prompt (~150 tokens);
  * ttft_long_s    — time to first token with ~3k tokens of context (the
                     assistant sends up to 8 cards + history);
  * gen_tok_s      — generation speed on a 300-token answer;
  * parallel       — two simultaneous 300-token requests: wall time, per-request
                     tok/s, both finished;
  * rss_mb         — resident memory of the server process (ps), before/after.

Usage:
    python3 scripts/ai-train/bench_server.py --url http://127.0.0.1:8082 --pid <llama-server pid> --label "cpu, 4 threads"
Prints a JSON line and a Markdown row; append rows to the card / README.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import subprocess
import sys
import time
import urllib.request

SYSTEM = "Ты — помощник сайта metravel.by. Отвечай кратко и только по материалам сайта."
FILLER = (
    "Карточка: статья «Один день в Ойцувском национальном парке» — https://metravel.by/travels/ojcow. "
    "Коротко: замок Пескова Скала, Краковские ворота, скала Мачуга Геркулеса, маршрут 12 км, парковка у входа. "
)


def rss_mb(pid: int | None) -> float | None:
    if not pid:
        return None
    out = subprocess.run(["ps", "-o", "rss=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return round(int(out) / 1024, 1) if out else None


def stream(url: str, user: str, max_tokens: int, context_chars: int = 0) -> dict:
    system = SYSTEM + ("\n\nДанные:\n" + (FILLER * (context_chars // len(FILLER) + 1))[:context_chars] if context_chars else "")
    body = {
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
        "stream": True,
        "stream_options": {"include_usage": True},
        "chat_template_kwargs": {"enable_thinking": False},
        "cache_prompt": False,
    }
    req = urllib.request.Request(url.rstrip("/") + "/v1/chat/completions", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    t0 = time.time()
    first, usage, n_chunks = None, None, 0
    with urllib.request.urlopen(req, timeout=900) as resp:
        for raw in resp:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()  # «data: [DONE]» и пустые кадры — не JSON
            if not payload or payload == "[DONE]":
                continue
            ev = json.loads(payload)
            if ev.get("usage"):
                usage = ev["usage"]
            delta = (ev.get("choices") or [{}])[0].get("delta", {}).get("content")
            if delta:
                n_chunks += 1
                if first is None:
                    first = time.time() - t0
    total = time.time() - t0
    comp = int((usage or {}).get("completion_tokens") or n_chunks)
    prompt_tokens = int((usage or {}).get("prompt_tokens") or 0)
    gen = comp / (total - (first or 0)) if comp and total > (first or 0) else 0.0
    return {"ttft_s": round(first or total, 2), "total_s": round(total, 2), "completion_tokens": comp, "prompt_tokens": prompt_tokens, "gen_tok_s": round(gen, 1)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://127.0.0.1:8080")
    ap.add_argument("--pid", type=int, default=None, help="llama-server pid for RSS")
    ap.add_argument("--label", default="")
    ap.add_argument("--tokens", type=int, default=300)
    ap.add_argument("--context-chars", type=int, default=9000, help="~3k tokens of Russian text for the long-context probe")
    args = ap.parse_args()

    q = "Куда поехать на выходные под Краковом с детьми? Ответь подробно, с советами по маршруту, парковке и еде."
    res: dict = {"label": args.label, "rss_mb_before": rss_mb(args.pid)}
    stream(args.url, "Привет", 8)  # load kernels
    short = stream(args.url, q, args.tokens)
    res.update({"ttft_short_s": short["ttft_s"], "gen_tok_s": short["gen_tok_s"], "completion_tokens": short["completion_tokens"]})
    long_ = stream(args.url, q, 32, context_chars=args.context_chars)
    res.update({"ttft_long_s": long_["ttft_s"], "long_prompt_tokens": long_["prompt_tokens"],
                "prompt_tok_s": round(long_["prompt_tokens"] / long_["ttft_s"], 1) if long_["ttft_s"] else None})
    t0 = time.time()
    with cf.ThreadPoolExecutor(2) as ex:
        both = list(ex.map(lambda _: stream(args.url, q, args.tokens), range(2)))
    res.update({"parallel2_wall_s": round(time.time() - t0, 2), "parallel2_gen_tok_s_each": [b["gen_tok_s"] for b in both],
                "parallel2_ttft_s": [b["ttft_s"] for b in both], "parallel2_ok": all(b["completion_tokens"] > 0 for b in both)})
    res["rss_mb_after"] = rss_mb(args.pid)
    print(json.dumps(res, ensure_ascii=False))
    print(f"| {args.label} | {res['ttft_short_s']} | {res['ttft_long_s']} ({res['long_prompt_tokens']} ток, {res['prompt_tok_s']} ток/с) | "
          f"{res['gen_tok_s']} | {res['parallel2_wall_s']} с, {res['parallel2_gen_tok_s_each']} | {res['rss_mb_after']} |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
