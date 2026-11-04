const assert = require('node:assert/strict')
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..')

test('MCP clients share the launcher across the primary checkout and a linked worktree', (t) => {
  const scratch = path.join(root, '.codex-temp')
  fs.mkdirSync(scratch, { recursive: true })
  const temp = fs.mkdtempSync(path.join(scratch, 'mcp-launcher-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const primary = path.join(temp, 'primary frontend')
  const linked = path.join(temp, 'nested', 'agent worktree')
  const launcher = 'scripts/launch-task-board-mcp.sh'
  fs.mkdirSync(path.join(primary, 'scripts'), { recursive: true })
  fs.copyFileSync(path.join(root, launcher), path.join(primary, launcher))

  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  env.GIT_CONFIG_NOSYSTEM = '1'
  env.GIT_CONFIG_GLOBAL = '/dev/null'
  delete env.CLAUDE_PROJECT_DIR
  delete env.GROK_WORKSPACE_ROOT
  delete env.METRAVEL_TASK_BOARD_BACKEND_DIR
  const git = (...args) => execFileSync('git', args, { cwd: primary, env, stdio: 'pipe' })
  git('init', '-q')
  git('add', launcher)
  git('-c', 'user.name=MCP fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  fs.mkdirSync(path.dirname(linked))
  git('worktree', 'add', '--detach', linked, 'HEAD')

  const run = (args, cwd = primary, overrides = {}) =>
    spawnSync('sh', args, { cwd, env: { ...env, ...overrides }, encoding: 'utf8' })

  const envDir = path.join(primary, '.secrets')
  fs.mkdirSync(envDir)
  const envFile = path.join(envDir, 'metravel-task-board.env')
  const config = 'METRAVEL_TASK_BOARD_API_TOKEN=fixture-token\nMETRAVEL_TASK_BOARD_BASE_URL=https://fixture.example.invalid\n'
  const backend = path.join(temp, 'metravel-backend')
  const moduleDir = path.join(backend, 'tools/mcp_server')
  const check = [launcher, '--check']
  assert.match(run(check).stderr, /env is missing/)
  fs.writeFileSync(envFile, 'MCP_FIXTURE=primary\n')
  assert.match(run(check).stderr, /MCP module missing/)
  fs.mkdirSync(moduleDir, { recursive: true })
  fs.writeFileSync(path.join(moduleDir, '__main__.py'), 'import os\nprint(os.environ["MCP_FIXTURE"])\n')
  const checked = run(check, linked)
  assert.equal(checked.status, 0, checked.stderr)
  assert.equal(checked.stdout, '')
  const inherited = run([launcher], linked, {
    METRAVEL_TASK_BOARD_API_TOKEN: 'inherited-token',
    METRAVEL_TASK_BOARD_BASE_URL: 'https://inherited.example.invalid',
  })
  assert.equal(inherited.status, 1)
  assert.match(inherited.stderr, /token and base URL must both be set/)
  assert.equal(inherited.stdout, '')
  fs.appendFileSync(envFile, config)

  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
  const claude = JSON.parse(read('.mcp.json')).mcpServers['metravel-task-board'].args
  const argsFor = (file) => JSON.parse(read(file).match(/^args = (\[.*\])$/m)[1])
  const clients = [
    [claude, temp, { CLAUDE_PROJECT_DIR: linked }],
    [argsFor('.codex/config.toml'), path.join(linked, 'scripts'), {}],
    [argsFor('.grok/config.toml'), temp, { GROK_WORKSPACE_ROOT: linked }],
  ]
  for (const [args, cwd, overrides] of clients) {
    const result = run(args, cwd, overrides)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, 'primary\n')
  }

  fs.mkdirSync(path.join(linked, '.secrets'))
  fs.writeFileSync(path.join(linked, '.secrets', path.basename(envFile)), `MCP_FIXTURE=linked\n${config}`)
  const linkedResult = run([launcher], linked)
  assert.equal(linkedResult.status, 0, linkedResult.stderr)
  assert.equal(linkedResult.stdout, 'linked\n')
  assert.equal(run(check, linked, { METRAVEL_TASK_BOARD_BACKEND_DIR: temp }).status, 1)
  const customBackend = path.join(temp, 'custom backend checkout')
  fs.renameSync(backend, customBackend)
  const overridden = run([launcher], linked, { METRAVEL_TASK_BOARD_BACKEND_DIR: customBackend })
  assert.equal(overridden.status, 0, overridden.stderr)
  assert.equal(overridden.stdout, 'linked\n')
})
