import fs from 'fs'
import path from 'path'

export const canonicalDeployPath = path.resolve(process.cwd(), 'build-prod.sh')
export const recoveryDeployPath = path.resolve(
  process.cwd(),
  'scripts/fix-prod.sh',
)

export function readCanonicalDeploy(): string {
  return fs.readFileSync(canonicalDeployPath, 'utf8')
}

export function readRecoveryDeploy(): string {
  return fs.readFileSync(recoveryDeployPath, 'utf8')
}
