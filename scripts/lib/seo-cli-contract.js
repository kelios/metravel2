'use strict'

/**
 * Shared CLI contract for the SEO ops scripts — #1391.
 *
 * Four incidents in one family (`SEO-OPS-001`: #1107, #1325, #1389, #1390) broke
 * the same invariant: a script fed an undefined or unsupported input did
 * something wide, or reported success, instead of failing where you can see it.
 * The common surface was hand-rolled argument reading — `argv.includes('--all')`,
 * `args.indexOf('--limit')`, a chain of `arg === '--json'` — and every one of
 * those shapes ignores a typo and keeps going with the default.
 *
 * So the parse lives here once, and `scripts/guard-seo-cli-contract.js` fails CI
 * when a SEO script stops going through it:
 *   - an unknown or mistyped argument is a `UsageError`, never a default;
 *   - a script that declares `modes` refuses to run until exactly one is named;
 *   - a flag that needs a value never swallows the next flag as that value;
 *   - an empty selection goes through `requireNonEmptySelection`, i.e. a
 *     non-zero exit, never a green "0 checked" report.
 *
 * Deliberately not an options library: no positionals, no `-x` short flags
 * besides `-h`, no "guess the type". Anything this parser cannot express should
 * become an explicit flag, not a fallback.
 */

const FLAG_TYPES = new Set(['boolean', 'string', 'int'])
const DEFAULT_VALUE_NAMES = { string: 'a value', int: 'an integer' }
const FLAG_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Bad invocation, as opposed to a run that failed on its way to the network. */
class UsageError extends Error {}

/**
 * `--help` was asked for. Thrown rather than returned as a flag on purpose: a
 * caller that forgets `if (args.help) return` would otherwise run the script for
 * real — in seo-fix-links that meant `--help` rewriting every published body,
 * because "no mode" reads as "not a dry run". `runSeoCli` prints the usage and
 * ends the run, so forgetting it is not possible.
 */
class HelpRequested extends Error {}

/** The run selected nothing to work on — a failure, not a clean report. */
class EmptySelectionError extends Error {}

/**
 * The check ran, worked correctly and found something bad — "4 URLs in the queue
 * answer 301", "9 pages have no canonical". A reported outcome, not a crash: the
 * detail is already in the report above, so the exit line stays one line.
 */
class ExpectedFailureError extends Error {}

const toCamelCase = (name) => name.replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase())

const formatFlagList = (names) => {
  const flags = names.map((name) => `--${name}`)
  if (flags.length <= 1) return flags.join('')
  return `${flags.slice(0, -1).join(', ')} or ${flags[flags.length - 1]}`
}

/**
 * Spec mistakes are programmer errors, not user errors: they throw plain `Error`
 * at startup so they can never be reported as "bad input" to the operator.
 */
function normalizeSpec(spec) {
  const name = spec && spec.name
  const usage = spec && spec.usage
  if (typeof name !== 'string' || !name) throw new Error('seo-cli-contract: spec.name is required')
  if (typeof usage !== 'string' || !usage) throw new Error('seo-cli-contract: spec.usage is required')

  const rawFlags = (spec && spec.flags) || {}
  const modes = (spec && spec.modes) || null
  const flags = new Map()

  for (const [flagName, rawFlag] of Object.entries(rawFlags)) {
    if (!FLAG_NAME_PATTERN.test(flagName)) {
      throw new Error(`seo-cli-contract: ${name}: bad flag name "${flagName}" (expected kebab-case)`)
    }
    if (flagName === 'help') throw new Error(`seo-cli-contract: ${name}: --help is built in`)
    const type = rawFlag.type
    if (!FLAG_TYPES.has(type)) {
      throw new Error(`seo-cli-contract: ${name}: --${flagName} has unknown type "${type}"`)
    }
    flags.set(flagName, {
      name: flagName,
      key: rawFlag.key || toCamelCase(flagName),
      type,
      valueName: rawFlag.valueName || DEFAULT_VALUE_NAMES[type],
      min: rawFlag.min,
      // Free text can legitimately start with `-` («-30 % на жильё»). Paths and
      // numbers cannot, so for them a leading `-` stays a mistyped flag.
      allowLeadingDash: Boolean(rawFlag.allowLeadingDash),
      required: Boolean(rawFlag.required),
      requiresMode: rawFlag.requiresMode || null,
      forbiddenModes: Array.isArray(rawFlag.forbiddenModes) ? rawFlag.forbiddenModes : [],
      reason: rawFlag.reason || '',
      stripTrailingSlash: Boolean(rawFlag.stripTrailingSlash),
      default: Object.prototype.hasOwnProperty.call(rawFlag, 'default')
        ? rawFlag.default
        : type === 'boolean'
          ? false
          : null,
    })
  }

  if (modes) {
    if (!Array.isArray(modes.flags) || modes.flags.length < 2) {
      throw new Error(`seo-cli-contract: ${name}: modes.flags needs at least two flag names`)
    }
    for (const modeName of modes.flags) {
      if (!flags.has(modeName)) {
        throw new Error(`seo-cli-contract: ${name}: mode --${modeName} is not declared in flags`)
      }
    }
  }

  return { name, usage, flags, modes }
}

const applyDefaults = (flags) => {
  const values = {}
  for (const flag of flags.values()) values[flag.key] = flag.default
  return values
}

function readFlagValue(flag, token, rawValue) {
  // A leading `-` is a mistyped flag, not a value: `--urls-file -h` has to say so
  // here instead of failing later on ENOENT '-h'. Flags that carry free text opt
  // out with `allowLeadingDash`, otherwise a title like "-40 °C" is unpassable.
  const looksLikeFlag = rawValue !== undefined && rawValue.startsWith('-') && !flag.allowLeadingDash
  if (rawValue === undefined || looksLikeFlag) {
    throw new UsageError(`${token} expects ${flag.valueName}`)
  }
  if (flag.type === 'int') {
    // Digits only, deliberately: `Number()` would read `1e3` as 1000 and `0x10`
    // as 16, so `--limit 1e3` (a typo for 1000? for 13?) must not quietly become
    // a run over a different set than the operator meant.
    const parsed = /^\d+$/.test(rawValue) ? Number(rawValue) : NaN
    const tooSmall = typeof flag.min === 'number' && parsed < flag.min
    if (!Number.isInteger(parsed) || tooSmall) throw new UsageError(`${token} expects ${flag.valueName}`)
    return parsed
  }
  return flag.stripTrailingSlash ? rawValue.replace(/\/+$/, '') : rawValue
}

/**
 * @param {string[]} argv full `process.argv` — the first two entries are skipped
 * @param {object} spec `{ name, usage, flags, modes }`
 * @returns {object} `{ help, mode, ...values }` with one camelCase key per flag
 */
function parseCliArgs(argv, spec) {
  const { flags, modes } = normalizeSpec(spec)
  const values = applyDefaults(flags)
  const tokens = Array.isArray(argv) ? argv.slice(2) : []
  const seen = new Set()
  let mode = null
  let help = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--help' || token === '-h') {
      help = true
      continue
    }
    if (!token.startsWith('--')) {
      throw new UsageError(`Unexpected argument: ${token} — every option is named, e.g. --dry-run`)
    }

    const flag = flags.get(token.slice(2))
    if (!flag) throw new UsageError(`Unknown argument: ${token}`)
    if (seen.has(flag.name)) throw new UsageError(`${token} given twice — pass it once`)
    seen.add(flag.name)

    if (flag.type === 'boolean') {
      values[flag.key] = true
    } else {
      values[flag.key] = readFlagValue(flag, token, tokens[i + 1])
      i++
    }

    if (modes && modes.flags.includes(flag.name)) {
      if (mode && mode !== flag.name) {
        throw new UsageError(
          `--${mode} and ${token} pick different ${modes.label || 'modes'} — choose one`,
        )
      }
      mode = flag.name
    }
  }

  // `--help` short-circuits every requirement: asking what the flags are must
  // never be answered with "you did not pass the right flags".
  if (help) throw new HelpRequested()

  if (modes && !mode) {
    throw new UsageError(
      modes.missing || `No mode given: pass ${formatFlagList(modes.flags)} explicitly`,
    )
  }
  for (const flag of flags.values()) {
    if (flag.required && !seen.has(flag.name)) throw new UsageError(`--${flag.name} is required`)
    if (!seen.has(flag.name)) continue
    const because = flag.reason ? ` because ${flag.reason}` : ''
    if (flag.requiresMode && mode !== flag.requiresMode) {
      throw new UsageError(`--${flag.name} requires --${flag.requiresMode}${because}`)
    }
    // A flag that the chosen mode would ignore is refused, not dropped: a
    // swallowed `--dry-run` is how a rehearsal becomes a live write (#1391).
    if (flag.forbiddenModes.includes(mode)) {
      throw new UsageError(`--${flag.name} cannot be combined with --${mode}${because}`)
    }
  }

  // No `help` key on purpose: `--help` never reaches here, so a `false` field
  // would only invite `if (args.help)` branches back into the callers.
  return { ...values, mode }
}

/**
 * "Nothing selected" is the shape #1325 shipped for months: the monitor read the
 * wrong envelope key, found no articles and printed a green "0 checked". An empty
 * selection is an environment or contract failure and has to reach the exit code.
 */
function requireNonEmptySelection(items, { what, source, hint, message } = {}) {
  const list = Array.isArray(items) ? items : []
  if (list.length > 0) return list
  const context = hint ? ` (${hint})` : ''
  throw new EmptySelectionError(
    message || `${source || 'selection'} returned 0 ${what || 'items'} — refusing to report success${context}`,
  )
}

/**
 * One exit-code contract for every SEO CLI: 2 = you called it wrong (usage is
 * printed), 1 = the run failed or the check found something, 0 = it actually did
 * the work and found nothing wrong. Throw `ExpectedFailureError` for the second
 * case so the operator gets the verdict, not a stack over their own report.
 */
function runSeoCli(main, { name, usage }) {
  return Promise.resolve()
    .then(() => main())
    .catch((error) => {
      if (error instanceof HelpRequested) {
        console.log(usage)
        return
      }
      if (error instanceof UsageError) {
        console.error(`[${name}] ${error.message}\n`)
        console.error(usage)
        process.exit(2)
      }
      // A reported outcome — an empty selection, or a check that found what it
      // was looking for — already explains itself above, so it stays a one-liner.
      // For anything unexpected the stack goes out: these scripts write to
      // production halfway through a batch, and "which line died on article 180
      // of 306" is the whole question when the run is half applied.
      const reported = error instanceof EmptySelectionError || error instanceof ExpectedFailureError
      const detail = reported
        ? error.message
        : (error && (error.stack || error.message)) || error
      console.error(`[${name}] ${detail}`)
      process.exit(1)
    })
}

module.exports = {
  EmptySelectionError,
  ExpectedFailureError,
  HelpRequested,
  UsageError,
  formatFlagList,
  normalizeSpec,
  parseCliArgs,
  requireNonEmptySelection,
  runSeoCli,
  toCamelCase,
}
