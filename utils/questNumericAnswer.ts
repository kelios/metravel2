/** Cardinal quantities only: each compound must follow one language's grammar. */
type Lexicon = {small: Record<string, number>; tens: Record<string, number>; hundreds: Record<string, number>; zero: string};
const entries = (source: string): Record<string, number> => Object.assign(Object.create(null), Object.fromEntries(source.split('|').map(item => {
  const [word, value] = item.split(':');
  return [word, Number(value)];
})));
const lexicons: Lexicon[] = [
  {
    zero: 'ноль',
    small: entries('девятнадцать:19|восемнадцать:18|семнадцать:17|шестнадцать:16|пятнадцать:15|четырнадцать:14|тринадцать:13|двенадцать:12|одиннадцать:11|десять:10|девять:9|восемь:8|семь:7|шесть:6|пять:5|четыре:4|три:3|две:2|два:2|одно:1|одна:1|один:1'),
    tens: entries('девяносто:90|восемьдесят:80|семьдесят:70|шестьдесят:60|пятьдесят:50|сорок:40|тридцать:30|двадцать:20'),
    hundreds: entries('девятьсот:900|восемьсот:800|семьсот:700|шестьсот:600|пятьсот:500|четыреста:400|триста:300|двести:200|сто:100'),
  },
  {
    zero: 'нуль',
    small: entries('дзевятнаццаць:19|васемнаццаць:18|сямнаццаць:17|шаснаццаць:16|пятнаццаць:15|чатырнаццаць:14|трынаццаць:13|дванаццаць:12|адзінаццаць:11|дзесяць:10|дзевяць:9|восем:8|сем:7|шэсць:6|пяць:5|чатыры:4|тры:3|дзве:2|два:2|адно:1|адна:1|адзін:1'),
    tens: entries('дзевяноста:90|восемдзесят:80|семдзесят:70|шэсцьдзясят:60|пяцьдзясят:50|сорак:40|трыццаць:30|дваццаць:20'),
    hundreds: entries('дзевяцьсот:900|восемсот:800|семсот:700|шэсцьсот:600|пяцьсот:500|чатырыста:400|трыста:300|дзвесце:200|сто:100'),
  },
  {
    zero: 'нуль',
    small: entries("дев'ятнадцять:19|вісімнадцять:18|сімнадцять:17|шістнадцять:16|п'ятнадцять:15|чотирнадцять:14|тринадцять:13|дванадцять:12|одинадцять:11|десять:10|дев'ять:9|вісім:8|сім:7|шість:6|п'ять:5|чотири:4|три:3|дві:2|два:2|одне:1|одна:1|один:1"),
    tens: entries("дев'яносто:90|вісімдесят:80|сімдесят:70|шістдесят:60|п'ятдесят:50|сорок:40|тридцять:30|двадцять:20"),
    hundreds: entries("дев'ятсот:900|вісімсот:800|сімсот:700|шістсот:600|п'ятсот:500|чотириста:400|триста:300|двісті:200|сто:100"),
  },
  {
    zero: 'zero',
    small: entries('dziewiętnaście:19|osiemnaście:18|siedemnaście:17|szesnaście:16|piętnaście:15|czternaście:14|trzynaście:13|dwanaście:12|jedenaście:11|dziesięć:10|dziewięć:9|osiem:8|siedem:7|sześć:6|pięć:5|cztery:4|trzy:3|dwie:2|dwa:2|jedno:1|jedna:1|jeden:1'),
    tens: entries('dziewięćdziesiąt:90|osiemdziesiąt:80|siedemdziesiąt:70|sześćdziesiąt:60|pięćdziesiąt:50|czterdzieści:40|trzydzieści:30|dwadzieścia:20'),
    hundreds: entries('dziewięćset:900|osiemset:800|siedemset:700|sześćset:600|pięćset:500|czterysta:400|trzysta:300|dwieście:200|sto:100'),
  },
];
const english: Lexicon = {
  zero: 'zero',
  small: entries('nineteen:19|eighteen:18|seventeen:17|sixteen:16|fifteen:15|fourteen:14|thirteen:13|twelve:12|eleven:11|ten:10|nine:9|eight:8|seven:7|six:6|five:5|four:4|three:3|two:2|one:1'),
  tens: entries('ninety:90|eighty:80|seventy:70|sixty:60|fifty:50|forty:40|thirty:30|twenty:20'), hundreds: {},
};

function belowHundred(words: string[], language: Lexicon): number | null {
  if (words.length === 1) return language.small[words[0]] ?? language.tens[words[0]] ?? null;
  if (words.length === 2 && language.tens[words[0]] && language.small[words[1]] < 10) {
    return language.tens[words[0]] + language.small[words[1]];
  }
  return null;
}

const numericLiteral = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Even an out-of-range literal is numeric and must not enter textual fallback. */
export function isQuestNumericLiteral(input: string): boolean {
  return numericLiteral.test(input.trim());
}

/** No prefix parsing, punctuation deletion, morphology or cross-language mixing. */
export function parseQuestNumber(input: string): number | null {
  if (input.length > 256) return null;
  const value = input.trim().normalize('NFC').toLowerCase().replace(/ё/g, 'е').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ');
  if (numericLiteral.test(value)) {
    const number = Number(value.replace(',', '.'));
    // Number can round a real fraction to an integer at any magnitude (for
    // example 2.0000000000000001). Count checkers must never accept that loss.
    if (Number.isInteger(number) && /[.,]\d*[1-9]/.test(value)) return null;
    return Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER ? number : null;
  }
  const words = value.split(' ');
  for (const language of lexicons) {
    if (value === language.zero || value === 'нуль' && language === lexicons[0]) return 0;
    const hundred = language.hundreds[words[0]];
    if (hundred) {
      if (words.length === 1) return hundred;
      const remainder = belowHundred(words.slice(1), language);
      if (remainder !== null) return hundred + remainder;
    } else {
      const number = belowHundred(words, language);
      if (number !== null) return number;
    }
  }
  if (value === english.zero) return 0;
  // English hyphens join only a tens word to a unit; never "one-hundred".
  const englishWords: string[] = [];
  for (const word of words) {
    if (!word.includes('-')) { englishWords.push(word); continue; }
    const parts = word.split('-');
    if (parts.length !== 2 || !english.tens[parts[0]] || !(english.small[parts[1]] < 10)) return null;
    englishWords.push(...parts);
  }
  if (englishWords[1] === 'hundred' && english.small[englishWords[0]] < 10) {
    const hundred = english.small[englishWords[0]] * 100;
    if (englishWords.length === 2) return hundred;
    const rest = englishWords.slice(englishWords[2] === 'and' ? 3 : 2);
    const remainder = belowHundred(rest, english);
    return remainder === null ? null : hundred + remainder;
  }
  return belowHundred(englishWords, english);
}
