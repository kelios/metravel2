#!/usr/bin/env node
'use strict'

/**
 * Скрипты travel-фильма (.claude/skills/metravel-travel-film/scripts и зеркало .agents/) запускаются
 * системным `python3` — на маке это /usr/bin/python3 3.9. 23.11.2026 render_plan.py после crop_band
 * (1e43786d5) не компилировался на 3.9: вложенные кавычки в f-строке — синтаксис 3.12; рендер падал
 * у всех сборщиков серий (нашла серия 5, исправление 4c4f90324).
 *
 * Страж разбирает (ast.parse, без запуска) каждый .py скилла тем python3, что лежит в /usr/bin.
 * Нет /usr/bin/python3 (не мак, CI) — пропуск с пометкой.
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DIRS = [
  '.claude/skills/metravel-travel-film/scripts',
  '.agents/skills/metravel-travel-film/scripts',
]
const PY = process.env.FILM_SCRIPTS_PYTHON || '/usr/bin/python3'

function main() {
  if (!fs.existsSync(PY)) {
    console.log(`guard-film-scripts-py39: пропуск — нет ${PY}`)
    return 0
  }
  const files = DIRS.flatMap((d) => {
    const abs = path.join(ROOT, d)
    return fs.existsSync(abs)
      ? fs.readdirSync(abs).filter((f) => f.endsWith('.py') && !f.startsWith('._')).map((f) => path.join(abs, f))
      : []
  })
  if (!files.length) {
    console.log('guard-film-scripts-py39: ok (скриптов нет)')
    return 0
  }
  const code = [
    'import ast, sys',
    'bad = 0',
    'for p in sys.argv[1:]:',
    '    try:',
    '        ast.parse(open(p, encoding="utf-8").read(), p)',
    '    except SyntaxError as e:',
    '        bad += 1; print(f"{p}:{e.lineno}: {e.msg}")',
    'sys.exit(1 if bad else 0)',
  ].join('\n')
  const r = spawnSync(PY, ['-c', code, ...files], { encoding: 'utf-8' })
  const ver = spawnSync(PY, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf-8' }).stdout.trim()
  if (r.status !== 0) {
    process.stderr.write(r.stdout + r.stderr)
    console.error(
      `guard-film-scripts-py39: скрипты фильма не разбираются системным python ${ver} (${PY}). ` +
        'Сборщики серий запускают их им: перепишите конструкцию под 3.9 (f-строки без вложенных одинаковых кавычек, без match и т. п.).'
    )
    return 1
  }
  console.log(`guard-film-scripts-py39: ok (${files.length} файлов, python ${ver})`)
  return 0
}

process.exit(main())
