// #2119: сравнение с эталонным файлом. В отличие от jest-снапшота эталон — обычный
// файл, поэтому один и тот же эталон читают тесты разных окружений (jsdom и node),
// а «эталон не изменился» проверяется `git diff --exit-code` по каталогу.
//
// Перезапись — только явной командой: `UPDATE_PDF_BOOK_GOLDEN=1 npx jest <тест>`.
import fs from 'fs'
import path from 'path'

export const GOLDEN_UPDATE_ENV = 'UPDATE_PDF_BOOK_GOLDEN'

const isUpdateRun = (): boolean => process.env[GOLDEN_UPDATE_ENV] === '1'

const CONTEXT = 160

function describeFirstDifference(actual: string, expected: string): string {
  const limit = Math.min(actual.length, expected.length)
  let index = 0
  while (index < limit && actual[index] === expected[index]) index += 1
  const from = Math.max(0, index - CONTEXT)
  const line = expected.slice(0, index).split('\n').length
  return [
    `первое расхождение на позиции ${index} (строка эталона ${line}); длина: получено ${actual.length}, эталон ${expected.length}`,
    `эталон:   …${JSON.stringify(expected.slice(from, index + CONTEXT))}…`,
    `получено: …${JSON.stringify(actual.slice(from, index + CONTEXT))}…`,
  ].join('\n')
}

/**
 * Побайтное сравнение двух больших строк. Сообщение об ошибке показывает первое
 * расхождение с контекстом, а не дифф двух мегабайтных строк.
 */
export function expectSameText(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`Результат разошёлся с эталоном ${label}\n${describeFirstDifference(actual, expected)}`)
  }
}

export function readGoldenFile(goldenPath: string): string {
  if (!fs.existsSync(goldenPath)) {
    throw new Error(
      `Нет эталонного файла ${goldenPath}. Эталон снимается явной командой: ${GOLDEN_UPDATE_ENV}=1 npx jest <web-тест эталонов>`
    )
  }
  return fs.readFileSync(goldenPath, 'utf8')
}

/** Сверяет строку с эталонным файлом побайтно; в режиме перезаписи — записывает эталон. */
export function expectToMatchGoldenFile(actual: string, goldenPath: string): void {
  if (isUpdateRun()) {
    fs.mkdirSync(path.dirname(goldenPath), { recursive: true })
    fs.writeFileSync(goldenPath, actual, 'utf8')
    return
  }

  expectSameText(actual, readGoldenFile(goldenPath), goldenPath)
}
