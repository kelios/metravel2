const path = require('path')
const {
  ROOT,
  GIT_DIR,
  HOOKS_DIR,
  ensureGitRepository,
  ensureHooksDir,
} = require('@/scripts/install-git-hooks')

describe('install-git-hooks', () => {
  it('resolves paths from repository root', () => {
    expect(ROOT).toBe(process.cwd())
    expect(GIT_DIR).toBe(path.join(process.cwd(), '.git'))
    expect(HOOKS_DIR).toBe(path.join(process.cwd(), 'githooks'))
  })

  it('validates repository and tracked hooks directory presence', () => {
    expect(() => ensureGitRepository()).not.toThrow()
    expect(() => ensureHooksDir()).not.toThrow()
  })
})
