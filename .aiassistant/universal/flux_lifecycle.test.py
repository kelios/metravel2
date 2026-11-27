"""Real process shutdown checks with a fake renderer; no weights or network."""
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

sys.dont_write_bytecode = True
SERVER = Path(__file__).resolve().parents[1] / 'flux/server.py'


def alive(pid):
    probe = subprocess.run(['ps', '-p', str(pid), '-o', 'stat='], capture_output=True, text=True)
    return bool(probe.stdout.strip() and not probe.stdout.strip().startswith('Z'))


class FluxLifecycleTests(unittest.TestCase):
    def test_shutdown_reaps_its_detached_renderer_and_preserves_an_unrelated_process(self):
        for signum in (signal.SIGTERM, signal.SIGINT):
            with self.subTest(signal=signum), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                receipt = root / 'renderer.json'
                leaked = root / 'leaked-child'
                renderer = root / 'renderer.py'
                descendant = ("import signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);"
                              f"time.sleep(0.9);pathlib.Path({str(leaked)!r}).write_text('orphan');time.sleep(30)")
                renderer.write_text(f'''#!{sys.executable}
import json,os,pathlib,signal,subprocess,sys,time
signal.signal(signal.SIGTERM,signal.SIG_IGN)
child=subprocess.Popen([sys.executable,'-c',{descendant!r}])
pathlib.Path({str(receipt)!r}).write_text(json.dumps({{'renderer':os.getpid(),'pgid':os.getpgrp(),'child':child.pid}}))
time.sleep(30)
''')
                renderer.chmod(0o700)
                runner = root / 'mcp-owner.py'
                runner.write_text(f'''
import pathlib,runpy,anyio
from mcp.server.fastmcp import FastMCP
async def serve(server):
    generate=server._tool_manager.get_tool('generate_flux_image').fn
    generate.__globals__.update(BINARY=pathlib.Path({str(renderer)!r}),
        MODEL=pathlib.Path({str(root)!r}),OUTPUT=pathlib.Path({str(root/'images')!r}))
    # Match the request task cancellation boundary used by MCP's AnyIO server.
    async with anyio.create_task_group() as tasks:
        tasks.start_soon(generate,'Original friendly forest quest cover',512,512)
        await anyio.sleep_forever()
FastMCP.run_stdio_async=serve
# Exercise the real server entrypoint; replace only transport and rendering.
runpy.run_path({str(SERVER)!r},run_name='__main__')
''')
                unrelated = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(30)'])
                owner = subprocess.Popen([sys.executable, str(runner)], start_new_session=True,
                                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                info = None
                try:
                    deadline = time.monotonic() + 4
                    while not receipt.exists() and time.monotonic() < deadline and owner.poll() is None:
                        time.sleep(0.02)
                    self.assertTrue(receipt.exists(), 'fake detached renderer did not start')
                    info = json.loads(receipt.read_text())
                    self.assertNotEqual(info['pgid'], os.getpgid(owner.pid))
                    os.killpg(owner.pid, signum)
                    output, error = owner.communicate(timeout=4)
                    self.assertEqual(owner.returncode, 0, error)
                    self.assertEqual(output, '')
                    self.assertFalse(alive(info['renderer']), 'detached renderer survived owner shutdown')
                    self.assertFalse(alive(info['child']), 'renderer descendant survived owner shutdown')
                    self.assertIsNone(unrelated.poll(), 'unrelated model/service process was stopped')
                    self.assertFalse(list((root / 'images').glob('*/result.json')), 'cancelled generation claimed success')
                    time.sleep(0.95)
                    self.assertFalse(leaked.exists())
                finally:
                    if owner.poll() is None:
                        os.killpg(owner.pid, signal.SIGKILL)
                    owner.communicate(timeout=3)
                    if info:
                        try:
                            os.killpg(info['pgid'], signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                    unrelated.terminate()
                    unrelated.wait(timeout=3)


class AsyncCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_non_signal_cancellation_is_not_reported_as_normal_shutdown(self):
        spec = importlib.util.spec_from_file_location('flux_server', SERVER)
        server = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(server)
        task = asyncio.create_task(server.run_with_shutdown(asyncio.sleep(30)))
        await asyncio.sleep(0)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task


if __name__ == '__main__':
    unittest.main(verbosity=2)
