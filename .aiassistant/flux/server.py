"""Constrained, offline FLUX image tool for PhpStorm AI Chat (MCP stdio)."""
import asyncio
import fcntl
import json
import os
from pathlib import Path
import signal
import time
import uuid

import anyio
from mcp.server.fastmcp import FastMCP, Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / '.codex-temp' / 'flux-images'
BINARY = Path('/Users/juliasavran/metravel-ai/tools/mflux-venv/bin/mflux-generate-flux2')
MODEL = Path('/Users/juliasavran/metravel-ai/models/images/flux2-klein-4b-mflux-q4')
SERVER = FastMCP('Local FLUX for MeTravel')


async def run_with_shutdown(main):
    """Cancel the serving task on OS shutdown so active renderers are reaped."""
    loop = asyncio.get_running_loop()
    task = asyncio.current_task()
    stopping = False
    previous = {}

    def request_shutdown():
        nonlocal stopping
        if not stopping:
            stopping = True
            task.cancel()

    try:
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous[signum] = signal.getsignal(signum)
            loop.add_signal_handler(signum, request_shutdown)
        try:
            return await main
        except asyncio.CancelledError:
            if not stopping:
                raise
    finally:
        for signum, handler in previous.items():
            loop.remove_signal_handler(signum)
            signal.signal(signum, handler)


@SERVER.tool(structured_output=False)
async def generate_flux_image(prompt: str, width: int = 768, height: int = 768, seed: int = 42):
    """Generate ONE image locally with installed FLUX. First compose a detailed English
    visual prompt from the user's request, then call this tool. Returns the actual PNG
    and its saved path. No upload/publication. Dimensions: 512..1024, multiples of64.
    Usually takes 15-90 seconds. Use only when the user requests image generation.
    """
    if not isinstance(prompt, str) or not 10 <= len(prompt.strip()) <= 4000:
        raise ValueError('Prompt must contain 10..4000 characters.')
    if any(type(x) is not int or x < 512 or x > 1024 or x % 64 for x in (width, height)):
        raise ValueError('Width and height must be integers 512..1024, multiples of64.')
    if type(seed) is not int or not 0 <= seed <= 2147483647:
        raise ValueError('Seed must be an integer 0..2147483647.')
    if not BINARY.is_file() or not MODEL.is_dir():
        raise RuntimeError('Installed local FLUX executable or weights are missing.')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with (OUTPUT / '.generation.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('FLUX is already generating an image. Do not start another generation.') from None
        job = OUTPUT / uuid.uuid4().hex
        job.mkdir()
        image = job / 'image.png'
        prompt_path = job / 'prompt.txt'
        prompt_path.write_text(prompt.strip())
        env = os.environ.copy()
        env.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1',
                   HF_HOME='/Users/juliasavran/metravel-ai/models/huggingface',
                   TOKENIZERS_PARALLELISM='false')
        command = [str(BINARY), '--model', str(MODEL), '--base-model', 'flux2-klein-4b',
                   '--prompt-file', str(prompt_path), '--width', str(width), '--height', str(height),
                   '--steps', '4', '--seed', str(seed), '--low-ram', '--output', str(image)]
        started = time.monotonic()
        with (job / 'generation.log').open('wb') as log:
            process = await asyncio.create_subprocess_exec(*command, env=env, cwd=ROOT,
                stdout=log, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
            try:
                await asyncio.wait_for(process.wait(), timeout=180)
            finally:
                # MCP's AnyIO task group may already be cancelled. Shield the
                # wait so shutdown still reaps the separately grouped renderer.
                with anyio.CancelScope(shield=True):
                    if process.returncode is None:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        await process.wait()
        if process.returncode != 0 or not image.is_file():
            raise RuntimeError(f'FLUX failed (exit {process.returncode}); diagnostic log: {job / "generation.log"}')
        elapsed = round(time.monotonic() - started, 1)
        metadata = dict(prompt=prompt.strip(), width=width, height=height, seed=seed,
                        model='FLUX.2-klein-4B-Q4', seconds=elapsed, image=str(image))
        (job / 'result.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        result = [f'Generated locally in {elapsed}s. Saved PNG: {image}\nPrompt: {prompt_path}']
        if os.environ.get('METRAVEL_FLUX_TEXT_ONLY') == '1':
            result[0] += f'\n[Открыть PNG]({image.as_uri()})'
        else:
            result.append(Image(path=str(image)))
        return result


if __name__ == '__main__':
    asyncio.run(run_with_shutdown(SERVER.run_stdio_async()))
