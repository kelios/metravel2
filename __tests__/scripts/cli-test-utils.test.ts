import { DEFAULT_CLI_TIMEOUT_MS, runCli, runNodeCli } from './cli-test-utils';

// Реальные дочерние процессы, без моков дочернего запуска: проверяется именно то, что
// висящий CLI роняет свой тест, а не замораживает прогон (#2839).
const HANG = ['-e', 'setInterval(() => {}, 1000)'];

describe('runCli', () => {
  it('убивает висящий CLI по таймауту и называет причину в stderr', () => {
    const started = Date.now();
    const result = runCli(process.execPath, HANG, { timeoutMs: 200 });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/убит по таймауту 200 мс \(ETIMEDOUT\)/);
  });

  it('добивает процесс, который перехватил SIGTERM', () => {
    const started = Date.now();
    const result = runCli(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { timeoutMs: 200 });
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.stderr).toMatch(/ETIMEDOUT/);
  });

  it('держит потолок и на ветке runNodeCli с локальным API', () => {
    const result = runNodeCli(HANG, { METRAVEL_API: 'http://127.0.0.1:9' }, { timeoutMs: 200 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ETIMEDOUT/);
  });

  it('не трогает вывод успешного запуска и называет причину незапуска', () => {
    const ok = runCli(process.execPath, ['-e', 'process.stderr.write("progress"); console.log("done")'], { input: '' });
    expect(ok).toEqual({ status: 0, stdout: 'done\n', stderr: 'progress' });
    const missing = runCli('metravel-no-such-binary-2839', []);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/не запустился: .*ENOENT/);
  });

  it('доставляет большой stdin целиком', () => {
    // Больше буфера unix-сокета: через опцию `input` синхронного запуска такой ввод на
    // macOS изредка не доходит до ребёнка, и запуск висит (#2839).
    const input = 'ж'.repeat(200_000);
    const result = runCli(process.execPath, ['-e', 'process.stdout.write(String(require("fs").readFileSync(0, "utf8").length))'], { input });
    expect(result).toEqual({ status: 0, stdout: '200000', stderr: '' });
    const streamed = runCli(process.execPath, ['-e', 'let n = 0; process.stdin.setEncoding("utf8").on("data", (c) => { n += c.length; }).on("end", () => process.stdout.write(String(n)))'], { input });
    expect(streamed.stdout).toBe('200000');
  });

  it('по умолчанию ограничен конечным потолком', () => {
    expect(Number.isFinite(DEFAULT_CLI_TIMEOUT_MS)).toBe(true);
    expect(DEFAULT_CLI_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
