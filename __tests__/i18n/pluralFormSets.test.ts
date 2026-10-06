import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { resources } from '@/i18n/resources'

// Гейт наборов форм числа (#2238). Значения `generated/*` переведены машинно и
// поштучно: форма без числа рядом ушла в словарный смысл («путешествие» →
// «travel» / «podróżować»), падеж после числительного потерян («5 zdjęcia»), а
// форма `_one` скопирована с формы «много» («Completed 1 times»).
//
// Набор форм числа объявляется одним из трёх способов, и гейт видит все три:
// 1. семейство ключей `<ключ>_one/_few/_many/_other` для `translatePlural` —
//    канон, новый набор заводится только так;
// 2. список «одна|несколько|много|прочее» в одном значении (`*NounForms`);
// 3. запрещённое наследие: `selectPlural(n, { one: i18nT(k1), few: i18nT(k2), … })`
//    или `pluralizeRu(n, i18nT(k1), i18nT(k2), i18nT(k3))` — разрозненные ключи.
//    Все 26 таких наборов переведены на семейства; гейт красит любой новый.
//
// Для каждого набора и каждой локали проверяется, что набор объявлен целиком и
// что категории `Intl.PluralRules` локали различаются там, где язык их различает.

type Locale = 'ru' | 'en' | 'pl' | 'be' | 'uk'
type Category = 'one' | 'few' | 'many' | 'other'
type FormSet = { id: string; forms: Partial<Record<Locale, Partial<Record<Category, string>>>> }
type Bundle = Record<string, Record<string, unknown>>

const LOCALES: Locale[] = ['ru', 'en', 'pl', 'be', 'uk']
const CATEGORIES: Category[] = ['one', 'few', 'many', 'other']
const SOURCE_ROOTS = ['app', 'components', 'screens', 'hooks', 'utils', 'services', 'stores', 'context', 'api']
const ROOT = path.resolve(__dirname, '../..')

// Слова, у которых язык сам не различает категории: PL «2 dni» и «5 dni»,
// «2 razy» и «5 razy», «2 uczestników» (мужско-личное). Сравнение идёт по
// значению без `{{…}}`, регистра и краёв.
const SAME_FEW_MANY: Partial<Record<Locale, RegExp>> = {
  pl: /(^|[^a-ząćęłńóśźż])(dni|razy|uczestników)([^a-ząćęłńóśźż]|$)/i,
}

// Наборы, где совпадение форм верно для всей фразы, а не для слова.
const SAME_FORM_SETS: Record<string, { locales: Locale[]; reason: string }> = {
  'tripsStatic:plan.card.goingSeats': {
    locales: ['en', 'pl'],
    reason: 'EN «1 of 4 going» / «5 of 8 going»; PL «Jedzie 1 z 4» / «Jedzie 5 z 8» — глагол в ед. ч. при 5+',
  },
  'tripsStatic:plan.participants.going': { locales: ['pl'], reason: 'PL «1 jedzie» / «5 jedzie»' },
  'quests:components.quests.questWizardStepCard.freeTextNote': {
    locales: ['pl'],
    reason: 'PL «potrzeba» управляет родительным: «2 znaków», «5 znaków»',
  },
}

// Наследие формы 3 переведено на семейства ключей целиком (#2238): разрозненный
// набор больше не заводится ни в одном файле.

const bundles = resources as unknown as Record<Locale, Bundle>

const lookup = (locale: Locale, fullKey: string): string | undefined => {
  const separator = fullKey.indexOf(':')
  if (separator < 0) return undefined
  const value = bundles[locale]?.[fullKey.slice(0, separator)]?.[fullKey.slice(separator + 1)]
  return typeof value === 'string' ? value : undefined
}

const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(absolute)
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [absolute] : []
  })
}

// Ключ перевода из вызова `i18nT('ns:key', …)` / `t('ns:key')` / `translate(…)`.
const keyOfCall = (node: ts.Node | undefined): string | undefined => {
  if (!node || !ts.isCallExpression(node)) return undefined
  const [first] = node.arguments
  return first && ts.isStringLiteralLike(first) && first.text.includes(':') ? first.text : undefined
}

type SplitSet = { file: string; keys: Partial<Record<Category, string>> }

// Рукописная форма наследия 3: `n === 1 ? i18nT(k1) : n < 5 ? i18nT(k2) : i18nT(k3)` —
// сравнение счётчика с числом и ключи перевода в ветках (#2238, QuickFacts «2 day»).
const COMPARISON = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken, ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken,
])
const isCountConditional = (node: ts.Node): node is ts.ConditionalExpression => {
  if (!ts.isConditionalExpression(node)) return false
  let condition: ts.Expression = node.condition
  while (ts.isParenthesizedExpression(condition)) condition = condition.expression
  return ts.isBinaryExpression(condition) && COMPARISON.has(condition.operatorToken.kind)
    && (ts.isNumericLiteral(condition.left) || ts.isNumericLiteral(condition.right))
}
// Признак ручного правила числа: в цепочке есть сравнение с 1 и либо с 2–5 (граница
// «few»), либо ветки дают однословное существительное без подстановки — подпись к
// числу («1 фото» / «5 фото», PDF FinalPageRenderer). «Пусто / не пусто», пороги
// прогресса (25, 50…) и фразы «Квест по этому городу» / «Квесты…» наборами не считаются.
const conditionLiterals = (node: ts.Expression): number[] => {
  let branch: ts.Expression = node
  while (ts.isParenthesizedExpression(branch)) branch = branch.expression
  if (!isCountConditional(branch)) return []
  let condition: ts.Expression = branch.condition
  while (ts.isParenthesizedExpression(condition)) condition = condition.expression
  const { left, right } = condition as ts.BinaryExpression
  const literal = ts.isNumericLiteral(left) ? left : (right as ts.NumericLiteral)
  return [Number(literal.text), ...conditionLiterals(branch.whenTrue), ...conditionLiterals(branch.whenFalse)]
}
const isNounForm = (fullKey: string, ruValue: (key: string) => string | undefined): boolean => {
  const value = ruValue(fullKey)
  return typeof value === 'string' && /^[^\s{}]+$/.test(value.trim())
}
const isHandWrittenPluralRule = (
  node: ts.ConditionalExpression,
  keys: string[],
  ruValue: (key: string) => string | undefined,
): boolean => {
  const literals = conditionLiterals(node)
  if (!literals.includes(1)) return false
  return literals.some((value) => value >= 2 && value <= 5)
    || (keys.length >= 2 && keys.every((key) => isNounForm(key, ruValue)))
}
const conditionalKeys = (node: ts.Expression): string[] => {
  let branch: ts.Expression = node
  while (ts.isParenthesizedExpression(branch)) branch = branch.expression
  if (isCountConditional(branch)) return [...conditionalKeys(branch.whenTrue), ...conditionalKeys(branch.whenFalse)]
  const key = keyOfCall(branch)
  return key ? [key] : []
}

const collectSplitSetsFrom = (
  relative: string,
  text: string,
  ruValue: (key: string) => string | undefined = (key) => lookup('ru', key),
): SplitSet[] => {
  const sets: SplitSet[] = []
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      const keys: Partial<Record<Category, string>> = {}
      if (name === 'selectPlural' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
        for (const property of node.arguments[1].properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue
          const category = property.name.text as Category
          const key = keyOfCall(property.initializer)
          if (CATEGORIES.includes(category) && key) keys[category] = key
        }
      }
      if (name === 'pluralizeRu') {
        const [one, few, many] = node.arguments.slice(1).map(keyOfCall)
        if (one) keys.one = one
        if (few) keys.few = few
        if (many) keys.many = keys.other = many
      }
      if (Object.keys(keys).length >= 2) sets.push({ file: relative, keys })
    }
    if (isCountConditional(node) && !(ts.isConditionalExpression(node.parent) && isCountConditional(node.parent))) {
      const chain = conditionalKeys(node)
      if (chain.length >= 2 && isHandWrittenPluralRule(node, chain, ruValue)) {
        const keys: Partial<Record<Category, string>> = {}
        chain.forEach((key, index) => { keys[CATEGORIES[Math.min(index, CATEGORIES.length - 1)]] = key })
        sets.push({ file: relative, keys })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return sets
}

const collectSplitSets = (): SplitSet[] =>
  SOURCE_ROOTS.flatMap((root) => walk(path.join(ROOT, root))).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8')
    if (!/selectPlural\(|pluralizeRu\(|[<>=]=?\s*\d+\s*\?/.test(text)) return []
    const relative = path.relative(ROOT, file).split(path.sep).join('/')
    return relative === 'utils/pluralize.ts' ? [] : collectSplitSetsFrom(relative, text)
  })

const splitSets = collectSplitSets()

const familySets = (): FormSet[] => {
  const sets: FormSet[] = []
  for (const [namespace, entries] of Object.entries(bundles.ru)) {
    const bases = new Set(
      Object.keys(entries)
        .map((key) => key.match(/^(.*)_(one|few|many|other)$/)?.[1])
        .filter((base): base is string => Boolean(base)),
    )
    for (const base of bases) {
      const forms: FormSet['forms'] = {}
      for (const locale of LOCALES) {
        const localeForms: Partial<Record<Category, string>> = {}
        for (const category of CATEGORIES) {
          const value = bundles[locale]?.[namespace]?.[`${base}_${category}`]
          if (typeof value === 'string') localeForms[category] = value
        }
        forms[locale] = localeForms
      }
      sets.push({ id: `${namespace}:${base}`, forms })
    }
  }
  return sets
}

const listSets = (): FormSet[] => {
  const sets: FormSet[] = []
  for (const [namespace, entries] of Object.entries(bundles.ru)) {
    for (const key of Object.keys(entries).filter((candidate) => /NounForms$/.test(candidate))) {
      const forms: FormSet['forms'] = {}
      for (const locale of LOCALES) {
        const value = bundles[locale]?.[namespace]?.[key]
        if (typeof value !== 'string') continue
        const parts = value.split('|')
        forms[locale] = Object.fromEntries(CATEGORIES.map((category, index) => [category, parts[index]]))
      }
      sets.push({ id: `${namespace}:${key}`, forms })
    }
  }
  return sets
}

const splitFormSets = (): FormSet[] =>
  splitSets.map(({ file, keys }) => ({
    id: `${file} → ${Object.values(keys)[0]}`,
    forms: Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        Object.fromEntries(
          (Object.entries(keys) as Array<[Category, string]>).map(([category, key]) => [
            category,
            lookup(locale, key),
          ]),
        ),
      ]),
    ),
  }))

const ALL_SETS: FormSet[] = [...familySets(), ...listSets(), ...splitFormSets()]

const normalize = (value: string | undefined) =>
  (value ?? '').replace(/\{\{[^}]*\}\}/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()

// Существительное мужского рода (основа на согласную или «ь») и окончание
// родительного падежа единственного числа.
const MASCULINE_STEM = /[бвгґджзйклмнпрстфхцчшщўь’]$/u
const GENITIVE_SINGULAR_END = /[ая]$/u

// Категории, которые `Intl.PluralRules` локали выбирает для целых чисел.
const REQUIRED: Record<Locale, Category[]> = {
  ru: ['one', 'few', 'many'],
  be: ['one', 'few', 'many'],
  uk: ['one', 'few', 'many'],
  pl: ['one', 'few', 'many'],
  en: ['one', 'other'],
}

const violationsOf = (set: FormSet, locale: Locale): string[] => {
  const forms = set.forms[locale] ?? {}
  const ruForms = set.forms.ru ?? {}
  const problems: string[] = []
  const declared = (Object.keys(ruForms) as Category[]).filter((category) => ruForms[category] !== undefined)
  const required = REQUIRED[locale].filter((category) => declared.includes(category) || category === 'other')
  for (const category of required) {
    if (category === 'other') {
      // `other` ru/be/uk/pl селектор берёт только для дробей — split-набор его
      // часто не объявляет. Для EN `other` — это «много»: он обязателен, если
      // набор вообще объявил форму «много» ключом.
      if (locale !== 'en') continue
      if (ruForms.other === undefined && ruForms.many === undefined) continue
      if ((forms.other ?? forms.many) === undefined) problems.push('нет формы other')
      continue
    }
    if (forms[category] === undefined || forms[category] === '') problems.push(`нет формы ${category}`)
  }
  const sameFormAllowed = SAME_FORM_SETS[set.id]?.locales.includes(locale) ?? false
  const one = normalize(forms.one)
  const few = normalize(forms.few)
  const many = normalize(forms.many ?? forms.other)
  if (locale === 'en') {
    const other = normalize(forms.other ?? forms.many)
    if (forms.one !== undefined && one === other && !sameFormAllowed) problems.push(`one = other «${forms.one}»`)
  } else if (locale !== 'ru') {
    if (forms.one !== undefined && one === many && !sameFormAllowed) problems.push(`one = many «${forms.one}»`)
    const ruDiffers = normalize(ruForms.few) !== normalize(ruForms.many ?? ruForms.other)
    const exempt = SAME_FEW_MANY[locale]?.test(forms.few ?? '')
    if (forms.few !== undefined && ruDiffers && few === many && !exempt && !sameFormAllowed) {
      problems.push(`few = many «${forms.few}»`)
    }
    // «Zadanie 1» / «Zadanie 3»: форма «2–4» скопирована с формы «1».
    const ruOneDiffers = normalize(ruForms.one) !== normalize(ruForms.few)
    if (forms.one !== undefined && forms.few !== undefined && ruOneDiffers && one === few && !sameFormAllowed) {
      problems.push(`one = few «${forms.few}»`)
    }
    // BE/UK после 2–4 ставят мужской род в им. п. мн. ч. («2 автори», «2 дні»),
    // а не в род. п. ед. ч., как RU («2 автора», «2 дня») — машинный перевод
    // переносил русскую форму.
    if ((locale === 'be' || locale === 'uk') && forms.one !== undefined && forms.few !== undefined) {
      const lastWord = (value: string) => value.split(' ').pop() ?? ''
      if (MASCULINE_STEM.test(lastWord(one)) && GENITIVE_SINGULAR_END.test(lastWord(few)) && !sameFormAllowed) {
        problems.push(`few в род. п. ед. ч. «${forms.few}»`)
      }
    }
  }
  // Число в шаблоне есть во всех формах или ни в одной.
  const withCount = Object.values(forms).filter((value) => /\{\{\s*count\s*\}\}/.test(value ?? ''))
  if (withCount.length > 0 && withCount.length !== Object.values(forms).filter(Boolean).length) {
    problems.push('{{count}} есть не во всех формах')
  }
  return problems.map((problem) => `${set.id}: ${problem}`)
}

describe('наборы форм числа (#2238)', () => {
  it('гейт находит семейства ключей и списки форм', () => {
    expect(familySets().length).toBeGreaterThanOrEqual(30)
    expect(listSets().length).toBeGreaterThanOrEqual(3)
  })

  it('набор форм заводится семейством ключей, а не разрозненными ключами', () => {
    expect(splitSets.map(({ file, keys }) => `${file} → ${Object.values(keys).join(', ')}`)).toEqual([])
  })

  it('детектор разрозненных наборов видит selectPlural, pluralizeRu и тернарник по числу с ключами', () => {
    const probe = [
      "selectPlural(n, { one: i18nT('ns:a'), few: i18nT('ns:b'), many: i18nT('ns:c') })",
      "pluralizeRu(n, i18nT('ns:a'), i18nT('ns:b'), i18nT('ns:c'))",
      "`${n} ${n === 1 ? i18nT('ns:a') : n < 5 ? i18nT('ns:b') : i18nT('ns:c')}`",
      "const flag = n > 0 ? i18nT('ns:x') : i18nT('ns:y')",
      "const stage = p < 25 ? i18nT('ns:s1') : p < 50 ? i18nT('ns:s2') : i18nT('ns:s3')",
      "const label = n === 1 ? i18nT('ns:photo') : i18nT('ns:photo')",
      "const heading = n === 1 ? i18nT('ns:phrase1') : i18nT('ns:phraseMany')",
    ].join('\n')
    const ru: Record<string, string> = { 'ns:photo': 'фото', 'ns:phrase1': 'Квест по этому городу', 'ns:phraseMany': 'Квесты по этому городу' }
    expect(collectSplitSetsFrom('probe.ts', probe, (key) => ru[key])).toHaveLength(4)
  })

  it('семейство ключей объявлено во всех локалях теми же категориями, что в RU', () => {
    const problems = familySets().flatMap((set) => {
      const ruCategories = Object.keys(set.forms.ru ?? {}).sort().join(',')
      return LOCALES.filter((locale) => Object.keys(set.forms[locale] ?? {}).sort().join(',') !== ruCategories).map(
        (locale) => `${set.id} ${locale}: ${Object.keys(set.forms[locale] ?? {}).join(',')} ≠ ${ruCategories}`,
      )
    })
    expect(problems).toEqual([])
  })

  it.each(['en', 'pl', 'be', 'uk'] as Locale[])('%s: формы набора объявлены целиком и различаются по правилам языка', (locale) => {
    expect(ALL_SETS.flatMap((set) => violationsOf(set, locale))).toEqual([])
  })

  it('правило ловит формы, переведённые поштучно', () => {
    const broken: FormSet = {
      id: 'probe',
      forms: {
        ru: { one: 'путешествие', few: 'путешествия', many: 'путешествий' },
        en: { one: 'travel', other: 'travel' },
        pl: { one: 'podróżować', few: 'zdjęcia', many: 'zdjęcia' },
        be: { one: '{{count}} раз', few: '{{count}} разы', many: '{{count}} раз' },
      },
    }
    expect(violationsOf(broken, 'en')).toEqual(['probe: one = other «travel»'])
    expect(violationsOf(broken, 'pl')).toEqual(['probe: few = many «zdjęcia»'])
    expect(violationsOf(broken, 'be')).toEqual(['probe: one = many «{{count}} раз»'])
    const copied: FormSet = {
      id: 'copied',
      forms: {
        ru: { one: 'автор', few: 'автора', many: 'авторов' },
        pl: { one: 'Zadanie #', few: 'Zadanie #', many: 'Zadania: #' },
        uk: { one: 'автор', few: 'автора', many: 'авторів' },
      },
    }
    expect(violationsOf(copied, 'pl')).toEqual(['copied: one = few «Zadanie #»'])
    expect(violationsOf(copied, 'uk')).toEqual(['copied: few в род. п. ед. ч. «автора»'])
    expect(SAME_FEW_MANY.pl?.test('{{value1}} dni')).toBe(true)
  })
})
