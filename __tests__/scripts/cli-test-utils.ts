import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn } from 'child_process';

export type CliRunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export const runNodeCli = (
  args: string[],
  env: Record<string, string> = {},
  options: { cwd?: string; input?: string } = {},
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

export const runCli = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; input?: string } = {},
): CliRunResult => {
  if (command === process.execPath && !args.includes('--require') && options.env?.METRAVEL_API && /^http:\/\/(?:127\.0\.0\.1|localhost):\d+/.test(options.env.METRAVEL_API)) {
    return runNodeCli(args, options.env, { cwd: options.cwd, input: options.input });
  }
  try {
    const stdout = execFileSync(command, args, {
      encoding: 'utf8',
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: 'pipe',
      input: options.input,
    });
    return {
      status: 0,
      stdout: String(stdout),
      stderr: '',
    };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failed.status ?? 1,
      stdout: String(failed.stdout ?? ''),
      stderr: String(failed.stderr ?? ''),
    };
  }
};

export const writeJsonFile = (filePath: string, payload: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
};

export const writeTextFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

export const makeTempDir = (prefix: string) => {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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
 * `execFileSync` и блокирует event loop, поэтому сервер внутри Jest не успел бы
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
