/**
 * У трекнутого артефакта — ровно один писатель.
 *
 * `BASELINE_METRICS.json` писали двое: `scripts/analyze-bundle.js` (подключён
 * тремя путями) и `scripts/analyze_bundle.py`, у которого не было ни одной точки
 * вызова. Пара была не безобидной: питоновский вариант читал только
 * `dependencies`, поэтому в те же поля писал другие числа — `total` 78 вместо
 * 120 и `dev` всегда 0. Случайный запуск мёртвого скрипта тихо портил бы
 * метрики, по которым потом сравнивают бандл.
 *
 * #1407 починил в обоих писателях завершающий перевод строки и тем самым
 * узаконил саму пару — вопрос «почему их два» тогда не задавался. Этот тест его
 * и задаёт: писатель обязан быть один и обязан быть вызываемым.
 */

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = path.resolve(__dirname, '../..')
const ARTIFACT = 'BASELINE_METRICS.json'
const OWNER = 'scripts/analyze-bundle.js'

/**
 * Примитивы записи в файл — на всех языках, на которых в репозитории пишут
 * скрипты, включая shell-обходной путь `jq … > tmp; mv tmp FILE`: именно так
 * `scripts/ios-build.sh` пишет `app.json`, и регулярка, знающая только
 * `writeFileSync`, такого писателя не увидела бы.
 */
const WRITE_CALL = /writeFileSync|writeFile\(|createWriteStream|json\.dump|write_text|\bmv\b|\bcp\b|\btee\b|>>?\s*["'$]/

/**
 * Кандидаты берутся у git, а не обходом дерева: `git grep` не читает 34 МБ
 * рабочей копии, сам пропускает бинарники и не спотыкается о пути, которые
 * `git ls-files` отдал бы в кавычках (`core.quotePath`) — на таком пути
 * `readFileSync` упал бы, и файл молча выпал бы из проверки.
 */
const filesMentioningArtifact = (): string[] => {
  const out = execFileSync('git', ['grep', '-lI', '--cached', '--', ARTIFACT], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return out.split('\n').filter(Boolean)
}

/**
 * Писатель — файл, который упоминает артефакт и содержит вызов записи.
 * Совпадение ищется по файлу целиком, а не рядом со строкой упоминания:
 * гард должен ошибаться в сторону шума, а не молчания. Будущий скрипт,
 * который читает baseline и пишет СВОЙ отчёт, этот тест уронит — и это
 * правильное поведение: список писателей ниже задан поимённо, так что
 * разбираться будет человек, а не регулярка.
 */
const findWriters = (): string[] =>
  filesMentioningArtifact()
    .filter((file) => file !== ARTIFACT && !file.startsWith('docs/') && !file.startsWith('__tests__/'))
    .filter((file) => WRITE_CALL.test(fs.readFileSync(path.join(ROOT, file), 'utf8')))

describe('BASELINE_METRICS.json: один писатель и он вызываемый', () => {
  it('писатель ровно один — и это analyze-bundle.js', () => {
    expect(findWriters()).toEqual([OWNER])
  })

  it('писатель подключён к npm-скрипту, а не лежит мёртвым', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    const wired = Object.entries(pkg.scripts as Record<string, string>).filter(([, cmd]) =>
      cmd.includes(OWNER),
    )

    expect(wired.length).toBeGreaterThan(0)
  })

  it('считает и devDependencies тоже — мёртвый python-вариант их терял целиком', () => {
    const source = fs.readFileSync(path.join(ROOT, OWNER), 'utf8')

    // Две строки, каждой из которых у второго писателя не было. Первая кладёт
    // devDependencies в выборку, вторая помечает их как dev — без неё поле `dev`
    // снова станет нулём, а тест на одну лишь выборку остался бы зелёным.
    expect(source).toMatch(/\.\.\.\s*packageJson\.devDependencies/)
    expect(source).toMatch(/isDev:\s*!!packageJson\.devDependencies\[/)
  })
})
