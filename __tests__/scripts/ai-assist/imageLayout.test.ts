/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli } from '../cli-test-utils'

// #3276: образ службы metravel-assist собирается из перечня COPY в `services/ai-assist/Dockerfile`
// с `type=module`. Общий с экраном модуль, который тянет файл вне этого перечня или CommonJS-файл,
// проходит jest (тот резолвит пути по-своему), а контейнер падает на старте: ERR_MODULE_NOT_FOUND
// либо «does not provide an export named…». Проба грузит службу в раскладке образа.
const ROOT = process.cwd()
const DOCKERFILE = path.join(ROOT, 'services/ai-assist/Dockerfile')

/** Пути репозитория из строк `COPY <источник> <назначение>` стадии сборки (без `--from` и `.npmrc`). */
const copiedPaths = (): string[] =>
  fs
    .readFileSync(DOCKERFILE, 'utf8')
    .split('\n')
    .map((line) => /^COPY\s+(?!--from)(\S+)\s+\S+\s*$/.exec(line)?.[1])
    .filter((source): source is string => Boolean(source) && source !== '.npmrc')

describe('metravel-assist: раскладка Docker-образа', () => {
  let image: string

  beforeAll(() => {
    image = makeTempDir('ai-assist-image-')
    fs.writeFileSync(path.join(image, 'package.json'), JSON.stringify({ name: 'metravel-assist', private: true, type: 'module' }))
    for (const source of copiedPaths()) fs.cpSync(path.join(ROOT, source), path.join(image, source), { recursive: true })
  })
  afterAll(() => removeDir(image))

  it('Dockerfile копирует код службы, индекса и общие модули ассистента', () => {
    expect(copiedPaths()).toEqual(expect.arrayContaining(['scripts/ai-index/', 'scripts/ai-assist/', 'api/aiAssist/', 'constants/aiFormPolicy.ts']))
  })

  it('служба грузится из файлов образа: общие модули не тянут файлы вне перечня COPY и CommonJS', () => {
    const run = runCli(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', "const app = await import('./scripts/ai-assist/app.ts'); console.log(typeof app.createApp)"],
      { cwd: image },
    )
    expect(run.stderr).toBe('')
    expect(run.stdout.trim()).toBe('function')
    expect(run.status).toBe(0)
  })
})
