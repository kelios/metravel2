import fs from 'fs'
import path from 'path'

export const canonicalDeployPath = path.resolve(process.cwd(), 'build-prod.sh')
export function readCanonicalDeploy(): string {
  return fs.readFileSync(canonicalDeployPath, 'utf8')
}

// #3207: the deploy gate reads the live revision from
// `$VERIFY_LIVE_ORIGIN/.build-source.json`. A `file://` origin stands in for
// production, so the gate, its curl call and the real `git merge-base` all run.
// A missing sha leaves the origin without a marker ("production did not answer").
export function liveOriginEnv(root: string, sha?: string): Record<string, string> {
  const dir = path.join(fs.realpathSync(root), 'live-origin')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  if (sha) {
    fs.writeFileSync(
      path.join(dir, '.build-source.json'),
      `${JSON.stringify({ sha, dirty: false, deploy: true, ok: true })}\n`,
    )
  }
  return { VERIFY_LIVE_ORIGIN: `file://${dir}`, VERIFY_LIVE_ATTEMPTS: '1', ALLOW_DOWNGRADE: '' }
}
