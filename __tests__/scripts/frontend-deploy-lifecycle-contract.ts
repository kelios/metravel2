export type FrontendDeployLifecycleViolation = {
  command: string
  line: number
  source: string
}

const FORBIDDEN_DIRECT_COMMANDS = new Set([
  'create',
  'kill',
  'pause',
  'restart',
  'rm',
  'run',
  'start',
  'stop',
  'unpause',
])
const FORBIDDEN_COMPOSE_COMMANDS = new Set([
  'create',
  'down',
  'kill',
  'pause',
  'restart',
  'rm',
  'run',
  'start',
  'stop',
  'unpause',
  'up',
])
const COMPOSE_COMMANDS = new Set([
  'build',
  'config',
  'cp',
  'create',
  'down',
  'events',
  'exec',
  'images',
  'kill',
  'logs',
  'ls',
  'pause',
  'port',
  'ps',
  'pull',
  'push',
  'restart',
  'rm',
  'run',
  'start',
  'stop',
  'top',
  'unpause',
  'up',
  'version',
  'wait',
  'watch',
])
const DOCKER_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '--config',
  '--context',
  '--host',
  '--log-level',
  '--tlscacert',
  '--tlscert',
  '--tlskey',
  '-H',
  '-c',
  '-l',
])
const COMPOSE_OPTIONS_WITH_VALUE = new Set([
  '--ansi',
  '--env-file',
  '--file',
  '--parallel',
  '--profile',
  '--progress',
  '--project-directory',
  '--project-name',
  '-f',
  '-p',
])

function shellWords(source: string): string[] {
  return (
    source.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s;|&(){}]+/g) ?? []
  ).map((word) => word.replace(/^[\\"']+|[\\"']+$/g, ''))
}

function commandAfterOptions(
  words: string[],
  startIndex: number,
  optionsWithValue: Set<string>,
): { command: string; index: number } | null {
  let index = startIndex

  while (index < words.length) {
    const word = words[index]

    if (word === '--') {
      index += 1
      break
    }
    if (!word.startsWith('-')) {
      break
    }

    const option = word.split('=', 1)[0]
    index += optionsWithValue.has(option) && !word.includes('=') ? 2 : 1
  }

  return index < words.length ? { command: words[index], index } : null
}

function findComposeCommand(words: string[], startIndex: number): string | null {
  const result = commandAfterOptions(
    words,
    startIndex,
    COMPOSE_OPTIONS_WITH_VALUE,
  )

  return result && COMPOSE_COMMANDS.has(result.command)
    ? result.command
    : null
}

function logicalLines(source: string): Array<{ line: number; source: string }> {
  const lines = source.split('\n')
  const result: Array<{ line: number; source: string }> = []
  let logicalLine = ''
  let startLine = 1

  lines.forEach((line, index) => {
    if (logicalLine.length === 0) {
      startLine = index + 1
    }

    const continued = /\\\s*$/.test(line)
    const segment = line.replace(/\\\s*$/, '')
    logicalLine +=
      logicalLine.length > 0 ? ` ${segment.trimStart()}` : segment

    if (!continued) {
      result.push({ line: startLine, source: logicalLine })
      logicalLine = ''
    }
  })

  if (logicalLine.length > 0) {
    result.push({ line: startLine, source: logicalLine })
  }

  return result
}

function findForbiddenCommand(source: string): string | null {
  const words = shellWords(source)
  const executable = words[0]

  if (executable === 'docker-compose') {
    const command = findComposeCommand(words, 1)
    return command && FORBIDDEN_COMPOSE_COMMANDS.has(command) ? command : null
  }

  if (executable !== 'docker') {
    return null
  }

  const dockerCommand = commandAfterOptions(
    words,
    1,
    DOCKER_GLOBAL_OPTIONS_WITH_VALUE,
  )
  if (!dockerCommand) {
    return null
  }

  if (dockerCommand.command === 'compose') {
    const command = findComposeCommand(words, dockerCommand.index + 1)
    return command && FORBIDDEN_COMPOSE_COMMANDS.has(command) ? command : null
  }

  const directCommand =
    dockerCommand.command === 'container'
      ? commandAfterOptions(
          words,
          dockerCommand.index + 1,
          new Set<string>(),
        )?.command
      : dockerCommand.command
  return directCommand && FORBIDDEN_DIRECT_COMMANDS.has(directCommand)
    ? directCommand
    : null
}

export function findFrontendDeployLifecycleViolations(
  source: string,
): FrontendDeployLifecycleViolation[] {
  const violations: FrontendDeployLifecycleViolation[] = []

  logicalLines(source).forEach(({ line, source: logicalLine }) => {
    if (logicalLine.trimStart().startsWith('#')) {
      return
    }

    for (const match of logicalLine.matchAll(/\bdocker(?:-compose)?\b/g)) {
      const candidate = logicalLine.slice(match.index)
      const command = findForbiddenCommand(candidate)

      if (command) {
        violations.push({ command, line, source: logicalLine.trim() })
      }
    }
  })

  return violations
}
