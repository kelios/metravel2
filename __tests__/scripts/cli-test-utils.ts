import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export type CliRunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

export const runNodeCli = (
  args: string[],
  env: Record<string, string> = {},
): CliRunResult => {
  try {
    const stdout = execFileSync(process.execPath, args, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
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
