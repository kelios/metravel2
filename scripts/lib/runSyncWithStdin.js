'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

// Large input through Node's synchronous pipe can deadlock on macOS (#2844).
// Both adapters use the same file lifecycle, preserving the underlying API.
function withFileStdin(options, run) {
  const { input, ...rest } = options;
  if (input === undefined) return run(rest);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-sync-stdin-'));
  let fd;
  try {
    const file = path.join(dir, 'stdin');
    fs.writeFileSync(file, input, {
      encoding: rest.encoding && rest.encoding !== 'buffer' ? rest.encoding : 'utf8',
      mode: 0o600,
    });
    fd = fs.openSync(file, 'r');
    const stdio = Array.isArray(rest.stdio)
      ? [...rest.stdio]
      : ['pipe', rest.stdio || 'pipe', rest.stdio || 'pipe'];
    stdio[0] = fd;
    return run({ ...rest, stdio });
  } finally {
    try {
      if (fd !== undefined) fs.closeSync(fd);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

function spawnSyncWithStdin(command, args, options = {}) {
  return withFileStdin(options, (prepared) => spawnSync(command, args, prepared));
}

function execFileSyncWithStdin(command, args, options = {}) {
  // With explicit stdio, Node already preserves the full execFileSync contract.
  if (options.input === undefined || options.stdio) {
    return withFileStdin(options, (prepared) => execFileSync(command, args, prepared));
  }
  // Passing a stdin fd requires explicit stdio, which disables execFileSync's
  // automatic stderr forwarding. Keep that default and its captured error data.
  const result = spawnSyncWithStdin(command, args, options);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw Object.assign(result.error, result);
  if (result.status !== 0) {
    const stderr = result.stderr?.length ? `\n${result.stderr.toString()}` : '';
    throw Object.assign(new Error(`Command failed: ${[options.argv0 || command, ...args].join(' ')}${stderr}`), result);
  }
  return result.stdout;
}

module.exports = { spawnSyncWithStdin, execFileSyncWithStdin };
