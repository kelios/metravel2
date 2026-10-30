import {parseQuestNumber} from '@/utils/questNumericAnswer';

describe('bounded multilingual quest quantities', () => {
  it.each([
    ['ноль', 0], ['нуль', 0], ['zero', 0], ['одна', 1], ['адзін', 1], ['одне', 1], ['jedna', 1],
    ['две', 2], ['дзве', 2], ['дві', 2], ['dwie', 2], ['two', 2],
    ['девятнадцать', 19], ['дзевятнаццаць', 19], ['дев’ятнадцять', 19], ['dziewiętnaście', 19], ['nineteen', 19],
    ['двадцать два', 22], ['дваццаць дзве', 22], ['двадцять дві', 22], ['dwadzieścia dwa', 22], ['twenty-two', 22],
    ['сто один', 101], ['сто адна', 101], ['сто одне', 101], ['sto jeden', 101], ['one hundred and one', 101],
    ['двести', 200], ['дзвесце', 200], ['двісті', 200], ['dwieście', 200], ['two hundred', 200],
    ['девятьсот девяносто девять', 999], ['дзевяцьсот дзевяноста дзевяць', 999],
    ["дев'ятсот дев'яносто дев'ять", 999], ['dziewięćset dziewięćdziesiąt dziewięć', 999], ['nine hundred ninety-nine', 999],
    ['  ДВЕ  ', 2], ['02', 2], ['1200', 1200], ['-2', -2], ['2,05', 2.05], ['2.05', 2.05],
  ])('recognizes %s as %s', (input, expected) => {
    expect(parseQuestNumber(String(input))).toBe(expected);
  });

  it.each([
    '', '2abc', '2 3', '2.5.0', 'NaN', 'Infinity', '2e3', '0x20', '9007199254740993',
    '2.0000000000000001', '9007199254740990.5', '9007199254740991.1',
    'второй', 'пятый', 'second', 'drugi', 'два три', 'два или три', 'два крест',
    'twenty два', 'двадцать two', 'sto two', 'one сто', 'сто zero', 'сто ноль',
    'двадцать десять', 'двести сто', 'one hundred and', 'one hundred and zero',
    'one-hundred', 'one--hundred', 'twenty--two', 'two and three', 'ten hundred',
    'one thousand', 'constructor', 'toString', '__proto__', 'два!'
  ])('rejects malformed, mixed, ordinal or ambiguous input %s', input => {
    expect(parseQuestNumber(input)).toBeNull();
  });

  it('bounds the parser before tokenization', () => {
    expect(parseQuestNumber('two '.repeat(10000))).toBeNull();
  });
});
