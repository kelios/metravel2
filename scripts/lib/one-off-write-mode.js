'use strict'

/**
 * Режим записи разовых скриптов, пишущих на прод, — #3211, #3304.
 *
 * `migrate-<город>-quest.js` и `reorder-quest-steps-prod.js` читали аргументы
 * руками: `args.includes('--dry-run')`. Запуск без флагов писал на прод, а
 * опечатка `--dryrun` молча означала ту же боевую запись — тот же инвариант,
 * что #1934 закрыл для общих квестовых CLI, в семействе, которое guard
 * `cli-contract` сознательно не покрывает (это копии одного шаблона, не CLI).
 *
 * Разбор — общий `cli-contract`, здесь только правило режима:
 *   - без флага режима — пробный прогон, на прод ничего не уходит;
 *   - боевая запись — только явный `--apply`;
 *   - неизвестный или недописанный аргумент — отказ с кодом 2 до первого запроса.
 *
 * #3304 распространил то же правило на остальные разовые скрипты (`create-*-guide`,
 * `upload-quest-*`, `fix-*` и подобные): у них есть собственные переключатели без
 * значения (`--publish`, `--posters-only`), поэтому помощник принимает и
 * `booleanFlags`. Перечень пишущих скриптов и их способ выбора режима держит
 * `scripts/guard-prod-write-mode.js`.
 */

const path = require('node:path')

const { HelpRequested, UsageError, parseCliTokens } = require('./cli-contract')

function resolveOneOffWriteMode(tokens, { script, valueFlags = [], booleanFlags = [] }) {
  const name = path.basename(script, '.js')
  const usage = `Usage: node scripts/${name}.js [--dry-run | --apply]${booleanFlags.map((flag) => ` [--${flag}]`).join('')}${valueFlags.map((flag) => ` [--${flag}=<value>]`).join('')}

  --dry-run   пробный прогон (режим по умолчанию): на прод ничего не пишется
  --apply     боевая запись на прод`
  const spec = {
    name,
    usage,
    selection: 'none',
    flags: {
      'dry-run': { type: 'boolean' },
      apply: { type: 'boolean' },
      ...Object.fromEntries(booleanFlags.map((flag) => [flag, { type: 'boolean' }])),
      ...Object.fromEntries(valueFlags.map((flag) => [flag, { type: 'string', allowLeadingDash: true }])),
    },
  }

  try {
    // Скрипты читают значения только в виде `--flag=value`; раздельная запись
    // прошла бы разбор, но значение потерялось бы — отказ, а не тихий дефолт.
    const detached = tokens.find((token) => valueFlags.some((flag) => token === `--${flag}`))
    if (detached) throw new UsageError(`${detached} expects ${detached}=<value>`)
    const parsed = parseCliTokens(tokens, spec)
    if (parsed.dryRun && parsed.apply) throw new UsageError('--dry-run and --apply pick different modes — choose one')
    if (!parsed.apply && !parsed.dryRun) {
      const notice = `[${name}] режим не указан — пробный прогон, на прод ничего не пишется; боевая запись: --apply`
      console.error(notice)
      // Скрипты печатают «✅ … готов» и в пробном прогоне: последней строкой запуска
      // без флага остаётся напоминание, что записи не было.
      if (require.main && path.resolve(require.main.filename) === path.resolve(script)) {
        process.on('exit', () => console.error(notice))
      }
    }
    return { isDryRun: !parsed.apply }
  } catch (error) {
    if (error instanceof HelpRequested) {
      console.log(usage)
      process.exit(0)
    }
    if (error instanceof UsageError) {
      console.error(`[${name}] ${error.message}\n\n${usage}`)
      process.exit(2)
    }
    throw error
  }
}

module.exports = { resolveOneOffWriteMode }
