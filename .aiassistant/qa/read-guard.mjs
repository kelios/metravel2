import {realpath} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const inside = (root, target) => target === root || target.startsWith(root + path.sep);

// OpenCode's native Read permissions use the requested path, before resolving symlinks.
export default async function QaReadGuard({directory}, {outputDirectory = process.env.LOCAL_QA_OUTPUT} = {}) {
  const expected = path.join(await realpath(ROOT), '.codex-temp/local-web-qa');
  const allowed = await realpath(expected);
  if (allowed !== expected) throw new Error('QA artifact root cannot use symlink aliases.');
  if (!outputDirectory) throw new Error('QA batch output is required for native Read.');
  const output = await realpath(outputDirectory);
  if (!inside(allowed, output) || output === allowed || output !== path.resolve(outputDirectory)) {
    throw new Error('Invalid QA batch Read root.');
  }
  return {
    'tool.execute.before': async (input, result) => {
      if (input.tool === 'browser_browser_navigate') {
        let url;
        try {
          url = new URL(result.args?.url);
        } catch {
          throw new Error('QA navigation requires an owned HTTPS page.');
        }
        if (!['https://metravel.by', 'https://www.metravel.by'].includes(url.origin) || url.username || url.password) {
          throw new Error('QA navigation requires an owned HTTPS page.');
        }
      }
      if (input.tool !== 'read') return;
      const requested = result.args?.filePath;
      if (typeof requested !== 'string') throw new Error('QA Read requires a batch artifact path.');
      let target;
      try {
        target = await realpath(path.resolve(directory, requested));
      } catch {
        throw new Error('QA Read artifact is unavailable.');
      }
      if (!inside(output, target)) throw new Error('QA Read cannot leave its batch, including through symlinks.');
    },
  };
}
