/**
 * scripts/lib/questAnswerMorphology.js
 * Второй проход проверки ответа — тот же, что `utils/questAnswerMorphology.ts`.
 *
 * Почему копия: `scripts/` — CommonJS без TS-загрузчика. Скан составных
 * написаний (#1926) обязан спрашивать рантайм, а не строку словаря, иначе
 * выдаёт работу, которую морфологический проход (#1631) уже закрыл.
 * Паритет с TS держит `__tests__/scripts/questAnswerMorphologyParity.test.ts`.
 */

const ENDINGS = new Set([
  '',
  'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о', 'ь', 'й',
  'ой', 'ей', 'ою', 'ею', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ов', 'ев',
  'ами', 'ями', 'ией', 'иях',
  'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ым', 'им', 'ых', 'их',
  'ую', 'юю', 'ому', 'ему', 'ого', 'его', 'ыми', 'ими',
  'і', 'ў', 'аў', 'еў', 'ай', 'яй', 'амі', 'ямі',
  'ае', 'яе', 'ыя', 'ія', 'ага', 'яга', 'аму', 'яму', 'ім', 'іх',
])

const MIN_WORD_LENGTH = 4
const MIN_COMMON_PREFIX = 3
const MAX_ENDING_LENGTH = 3

const NUMERALS = new Set([
  'один', 'одна', 'одно', 'два', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь',
  'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать',
  'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать',
  'девятнадцать', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'сто',
  'первый', 'первая', 'первое', 'второй', 'вторая', 'второе', 'третий', 'третья',
  'третье', 'четвертый', 'четвертая', 'пятый', 'пятая', 'шестой', 'шестая',
  'седьмой', 'седьмая', 'восьмой', 'восьмая', 'девятый', 'девятая', 'десятый',
  'десятая', 'дюжина', 'адзін', 'адна', 'адно', 'два', 'дзве', 'тры',
  'чатыры', 'пяць', 'шэсць', 'сем', 'восем', 'дзевяць', 'дзесяць',
])

const commonPrefixLength = (a, b) => {
  const limit = Math.min(a.length, b.length)
  let i = 0
  while (i < limit && a[i] === b[i]) i += 1
  return i
}

const isMorphComparable = (value) =>
  value.length >= MIN_WORD_LENGTH
  && !value.includes(' ')
  && !/\d/.test(value)
  && !NUMERALS.has(value)

const fleetingVowelStem = (word) => {
  const match = /^(.{2,})(?:о|е)(к|ц)$/.exec(word)
  return match ? match[1] + match[2] : null
}

const matchesByEndings = (input, variant) => {
  const common = commonPrefixLength(input, variant)
  if (common < MIN_COMMON_PREFIX) return false

  const inputEnding = input.slice(common)
  const variantEnding = variant.slice(common)
  if (inputEnding.length > MAX_ENDING_LENGTH || variantEnding.length > MAX_ENDING_LENGTH) return false

  return ENDINGS.has(inputEnding) && ENDINGS.has(variantEnding)
}

const isSameSingleWordForm = (input, variant) => {
  if (input === variant) return true
  if (!isMorphComparable(input) || !isMorphComparable(variant)) return false
  if (matchesByEndings(input, variant)) return true

  const variantStem = fleetingVowelStem(variant)
  if (variantStem && matchesByEndings(input, variantStem)) return true

  const inputStem = fleetingVowelStem(input)
  return !!inputStem && matchesByEndings(inputStem, variant)
}

const isSameWordForm = (input, variant) => {
  if (input === variant) return true

  const inputWords = input.split(' ')
  const variantWords = variant.split(' ')
  if (inputWords.length !== variantWords.length) return false
  if (inputWords.length === 1) return isSameSingleWordForm(input, variant)

  return inputWords.every((word, i) => {
    const target = variantWords[i]
    return word === target || isSameSingleWordForm(word, target)
  })
}

const matchesAnyWordForm = (input, variants) =>
  variants.some((variant) => isSameWordForm(input, variant))

module.exports = {
  ENDINGS,
  MIN_WORD_LENGTH,
  MIN_COMMON_PREFIX,
  MAX_ENDING_LENGTH,
  isSameWordForm,
  matchesAnyWordForm,
}
