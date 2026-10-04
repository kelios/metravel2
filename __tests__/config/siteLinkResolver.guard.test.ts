import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

/**
 * #2144 / App Review 5.1.2(i): ссылка на собственный сайт на native открывается
 * экраном приложения, только если у её пути есть экран `app/`, иначе — в
 * системном браузере; якорь в `router.push` не попадает. Решение принимает ОДНА
 * точка — `utils/siteLinks.ts` (`resolveAppRouteForSiteUrl`), а на native его
 * применяет `openExternalUrl*`. Семейство дефекта — вход, который сам решил
 * «ссылка внутренняя» проверкой одного хоста и сам позвал `router.push`
 * (rich text, HomeHero `INTERNAL_HOSTS`, `normalizeRelatedTravelRoute`).
 *
 * (а) Модуль, который навигирует в приложении, не держит собственного
 *     литерала хоста сайта и не разбирает URL через `new URL(...)`.
 * (б) `resolveSitePath`/`resolveInternalHref` проверяют только хост и отдают
 *     в том числе пути без экрана. Каждый их потребитель классифицирован ниже;
 *     новый роняет тест, пока не решено, почему ему не нужен список экранов.
 */

const ROOT = path.resolve(__dirname, '../..')
const SOURCE_DIRS = ['app', 'components', 'screens', 'hooks', 'utils', 'context', 'stores', 'ui']
const SITE_LINKS_OWNER = 'utils/siteLinks.ts'

const HOST_ONLY_RESOLVER_CONSUMERS: Record<string, string> = {
  'utils/internalLinks.ts':
    'web: навигация в той же вкладке; native делегирует в openExternalUrl (экран или браузер)',
  'utils/externalLinks.ts':
    'normalizeHttpOrInternalUrl: проверка «адрес нашего сайта» при вводе ссылки, не навигация',
  'components/home/HomeHero.tsx': 'только web-ветка (SPA-переход); native — openExternalUrl',
  'components/trips/planning/TripPlanLinkedText.tsx':
    'признак internal для web (та же вкладка); нажатие на native — handleRichTextLinkPress',
}

// Навигирует в приложении: императивный `router.*` или любой импорт навигации
// expo-router (`useRouter`, `router`, `Link`, `Redirect`) — деструктурированный
// `push(` и `<Link href>` тоже переход.
const NAVIGATES_IN_APP =
  /\b(?:router|navigation)\.(?:push|replace|navigate)\s*\(|import\s*\{[^}]*\b(?:useRouter|router|Link|Redirect)\b[^}]*\}\s*from\s*['"]expo-router['"]/
const SITE_HOST_LITERAL = /['"`](?:www\.)?metravel\.by['"`]/
const URL_PARSE = /\bnew URL\(\s*(?!window\.location)/
const HOST_ONLY_RESOLVER = /\b(?:resolveSitePath|resolveInternalHref)\b/

const listSourceFiles = (dir: string): string[] => {
  const absolute = path.join(ROOT, dir)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') return []
      return listSourceFiles(relative)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : []
  })
}

// Комментарии не код: упоминание `new URL` в пояснении не нарушение.
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const sourceFiles = SOURCE_DIRS.flatMap(listSourceFiles).map((file) => file.split(path.sep).join('/'))
const code = new Map(sourceFiles.map((file) => [file, stripComments(readFileSync(path.join(ROOT, file), 'utf8'))]))

describe('site link resolver guard (#2144)', () => {
  it('navigating modules do not decide site membership by their own host literal or URL parsing', () => {
    const offenders = sourceFiles
      .filter((file) => file !== SITE_LINKS_OWNER && NAVIGATES_IN_APP.test(code.get(file)!))
      .flatMap((file) => {
        const source = code.get(file)!
        return [
          ...(SITE_HOST_LITERAL.test(source) ? [`${file}: site host literal`] : []),
          ...(URL_PARSE.test(source) ? [`${file}: new URL(...)`] : []),
        ]
      })

    expect(offenders).toEqual([])
  })

  it('classifies every consumer of the host-only site resolver', () => {
    const consumers = sourceFiles.filter(
      (file) => file !== SITE_LINKS_OWNER && HOST_ONLY_RESOLVER.test(code.get(file)!),
    )

    expect(consumers.filter((file) => !(file in HOST_ONLY_RESOLVER_CONSUMERS))).toEqual([])
    // Снятый потребитель уходит и из реестра — пустая запись выглядела бы рабочей.
    expect(Object.keys(HOST_ONLY_RESOLVER_CONSUMERS).filter((file) => !consumers.includes(file))).toEqual([])
  })
})
