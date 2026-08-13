import fs from 'fs'
import path from 'path'

export const canonicalDeployPath = path.resolve(process.cwd(), 'build-prod.sh')
export const recoveryDeployPath = path.resolve(
  process.cwd(),
  'scripts/fix-prod.sh',
)

export const stagingCleanupFailureContract = [
  'if [ -e dist ]; then',
  '  echo "❌ Failed to remove upload staging directory: dist"',
  '  exit 1',
  'fi',
].join('\n')

export function readCanonicalDeploy(): string {
  return fs.readFileSync(canonicalDeployPath, 'utf8')
}

export function readRecoveryDeploy(): string {
  return fs.readFileSync(recoveryDeployPath, 'utf8')
}

// The heredoc opener line carries trailing redirections (| tee "$REMOTE_LOG"),
// so only the heredoc word itself is anchored, not the end of the line.
export function extractRemoteDeploy(source = readCanonicalDeploy()): string {
  const match = source.match(
    /<<'REMOTE_DEPLOY_SCRIPT'[^\n]*\n([\s\S]*?)\nREMOTE_DEPLOY_SCRIPT/,
  )

  if (!match) {
    throw new Error('canonical remote deploy payload was not found')
  }

  return match[1]
}
