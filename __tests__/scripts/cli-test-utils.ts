import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

export type CliRunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export const runNodeCli = (
  args: string[],
  env: Record<string, string> = {},
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): CliRunResult => {
  // Legacy CLI regression servers use ephemeral loopback ports. Inject the
  // explicit isolated token fixture through a test-only preload; production
  // binaries keep their exact origin allowlist and never consume this hook.
  const target = args.map((arg, index) => arg.startsWith('--api-url=') ? arg.slice(10) : arg === '--api-url' ? args[index + 1] : '').find(Boolean) || env.METRAVEL_API;
  if (!target || !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/api)?\/?$/.test(target)) {
    return runCli(process.execPath, args, { env, ...options });
  }
  const homeDir = makeTempDir('metravel-cli-auth-fixture-');
  const preload = path.join(homeDir, 'token-fixture.cjs');
  const helper = path.resolve(process.cwd(), 'scripts/lib/metravel-tool-session.js');
  const kernel = path.resolve(process.cwd(), 'scripts/lib/metravel-token.js');
  const transport = path.resolve(process.cwd(), 'scripts/lib/metravel-token-transport.js');
  writeTextFile(preload, `
    process.env.NODE_ENV = 'test';
    const helper = require(${JSON.stringify(helper)});
    const {createTokenSession} = require(${JSON.stringify(kernel)});
    const {trustedRequest} = require(${JSON.stringify(transport)});
    const homeDir = ${JSON.stringify(homeDir)};
    const declared = new URL(${JSON.stringify(target)}).origin;
    helper.createToolSession = (options = {}) => {
      const origin = new URL(options.origin || declared).origin;
      if (origin !== declared) throw new Error('fixture target mismatch');
      const profile = options.profile || 'qa104', expectedUserId = options.expectedUserId || 104;
      const fixture = {origin, homeDir, fetchImpl: async (url, init) =>
        new URL(url).pathname === '/api/user/me/'
          ? new Response(JSON.stringify({id: expectedUserId}), {status: 200})
          : fetch(url, init)};
      return createTokenSession({...options, origin, profile, expectedUserId, homeDir, fixture,
        sources: [{kind:'value', value: options.explicit || process.env.METRAVEL_TOKEN || 'test'}], refreshPolicy: 'never'});
    };
    helper.bodyMaintenanceSession = (options = {}) => helper.createToolSession({...options, profile:'owner', expectedUserId:1});
    helper.publicRequest = (base, endpoint, init) => trustedRequest(declared, endpoint, init, {fixture: {origin:declared, homeDir, fetchImpl:fetch}, allowRedirectStatus:true});
  `);
  try {
    return runCli(process.execPath, ['--require', preload, ...args], { env, ...options });
  } finally { removeDir(homeDir); }
};

// Без потолка висящий дочерний CLI стоит вечно при 0% CPU, а `--runInBand`
// замораживает вместе с ним весь test:run: spawnSync блокирует event loop, и
// jest-таймаут теста сработать не может. Долгие CLI передают свой `timeoutMs`.
export const DEFAULT_CLI_TIMEOUT_MS = 120_000;

export const runCli = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; input?: string; timeoutMs?: number } = {},
): CliRunResult => {
  if (command === process.execPath && !args.includes('--require') && options.env?.METRAVEL_API && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+/.test(options.env.METRAVEL_API)) {
    return runNodeCli(args, options.env, { cwd: options.cwd, input: options.input, timeoutMs: options.timeoutMs });
  }
  // stdin — из временного файла, а не `spawnSync({ input })`: на macOS ввод
  // больше буфера unix-сокета (тест board-compact шлёт ~20 КБ) в ~0,75% запусков
  // не дописывается — родитель ждёт в kevent, ребёнок в read(), оба при 0% CPU
  // (#2839, 9 зависаний из 1200; из файла — 0 из 1200).
  const inputDir = options.input === undefined ? null : makeTempDir('metravel-cli-stdin-');
  let stdin: number | 'pipe' = 'pipe';
  if (inputDir) {
    const inputFile = path.join(inputDir, 'stdin');
    fs.writeFileSync(inputFile, options.input ?? '', 'utf8');
    stdin = fs.openSync(inputFile, 'r');
  }
  let result: ReturnType<typeof spawnSync>;
  try {
    // spawnSync, not execFileSync: a successful run keeps its real stderr, so
    // tests can assert on progress/summary lines a CLI prints there.
    result = spawnSync(command, args, {
      encoding: 'utf8',
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: [stdin, 'pipe', 'pipe'],
      timeout: options.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS,
      // SIGKILL: процесс, перехвативший SIGTERM, иначе пережил бы таймаут.
      killSignal: 'SIGKILL',
    });
  } finally {
    if (typeof stdin === 'number') fs.closeSync(stdin);
    if (inputDir) removeDir(inputDir);
  }
  const stderr = String(result.stderr ?? '');
  // Причина падения самого запуска (ETIMEDOUT, ENOENT) — в stderr, иначе тест
  // видит только status 1 без объяснения.
  const failure = result.error as NodeJS.ErrnoException | undefined;
  const reason = failure?.code === 'ETIMEDOUT'
    ? `runCli: ${command} убит по таймауту ${options.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS} мс (ETIMEDOUT)`
    : failure ? `runCli: ${command} не запустился: ${failure.message}` : '';
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? ''),
    stderr: reason ? `${stderr}${stderr && !stderr.endsWith('\n') ? '\n' : ''}${reason}\n` : stderr,
  };
};

export const writeJsonFile = (filePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
};

export const writeTextFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

export const makeTempDir = (prefix: string, options: { root?: string } = {}) => {
  const root = options.root ?? os.tmpdir();
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
};

export const removeDir = (dirPath: string) => {
  fs.rmSync(dirPath, { recursive: true, force: true });
};

export type StubServer = {
  origin: string;
  stop: () => void;
};

/**
 * Поднимает HTTP-стаб отдельным процессом и ждёт от него строку `PORT=<порт>`
 * в stdout.
 *
 * Отдельный процесс здесь обязателен: CLI в этих тестах запускается через
 * `spawnSync` и блокирует event loop, поэтому сервер внутри Jest не успел бы
 * ответить ни на один запрос.
 *
 * stderr стаба копится и попадает в текст ошибки: без него падение самого
 * сервера (синтаксис в источнике, занятый порт) выглядит как молчаливый
 * таймаут без причины.
 */
export const startStubServer = async (
  source: string,
  dir: string,
  options: { timeoutMs?: number } = {},
): Promise<StubServer> => {
  // Меньше 5000: столько jest по умолчанию отводит хуку (`testTimeout` не задан
  // ни в jest.config.js, ни в пресете jest-expo). С бОльшим значением хук
  // умирал бы первым — по своему безличному сообщению, а собранный тут stderr
  // сервера в отчёт не попадал бы вовсе.
  const timeoutMs = options.timeoutMs ?? 4000;
  const serverFile = path.join(dir, 'server.js');
  writeTextFile(serverFile, source);

  const server = spawn(process.execPath, [serverFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  server.stderr.setEncoding('utf8');
  server.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  const failure = (reason: string) => {
    const details = stderr.trim();
    return new Error(`тестовый сервер не поднялся: ${reason}${details ? `\n${details}` : ''}`);
  };

  try {
    const port = await new Promise<string>((resolve, reject) => {
      // Порт печатается одной строкой, но stdout приходит чанками: копим весь
      // вывод, иначе `PORT=` может разъехаться по границе чанка.
      let stdout = '';
      const timer = setTimeout(() => reject(failure(`нет строки PORT= за ${timeoutMs} мс`)), timeoutMs);
      const settle = (finish: () => void) => {
        clearTimeout(timer);
        finish();
      };

      server.stdout.setEncoding('utf8');
      server.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        const match = /PORT=(\d+)/.exec(stdout);
        if (!match) return;
        settle(() => resolve(match[1]));
      });
      server.on('error', (error) => settle(() => reject(error)));
      // Процесс, умерший до `PORT=`, — это ошибка сразу, а не через таймаут.
      // `close` вместо `exit`: к нему stderr уже дочитан целиком.
      server.on('close', (code) => settle(() => reject(failure(`процесс завершился с кодом ${code}`))));
    });

    return {
      origin: `http://127.0.0.1:${port}`,
      stop: () => {
        server.kill();
      },
    };
  } catch (error) {
    server.kill();
    throw error;
  }
};
