// Проверка цветовых лексем — монотонное уточнение surface-answer criterion v2.
const norm = value => String(value || '').toLowerCase().replace(/ё/g, 'е')
const ADJECTIVE_ENDINGS = '(?:оват|еват|ат|ист|еньк|оньк)?(?:ый|ая|ое|ые|ого|ой|ою|ому|ым|ыми|ую|ых|ом|ий|яя|ее|ие|его|ей|ею|ему|им|ими|юю|их|ем|а|о)?'
const UK_ENDINGS = '(?:ий|ій|а|я|е|є|і|ого|ього|ої|ому|ьому|им|ім|ими|іми|у|ю|их|іх|ою|ьою)?'
const BE_ENDINGS = '(?:ы|ая|ае|ыя|ага|ай|аю|аму|ым|ымі|ую|ых)?'
const PL_ENDINGS = '(?:aw|kaw)?(?:y|a|e|i|ie|o|ego|iego|ej|emu|iemu|ym|im|ymi|imi|ą|ych|ich|zy)?'
const DE_ENDINGS = '(?:e|er|es|en|em)?'
const GROUPS = [
  [['красн', 'червон', 'ал', 'голуб', 'зелен', 'желт', 'бел', 'черн', 'оранжев', 'фиолетов', 'сиренев', 'розов', 'сер', 'коричнев', 'бур', 'бирюзов', 'золот', 'серебрян', 'бордов', 'малинов', 'терракотов', 'бежев', 'кремов', 'песочн', 'медн', 'патинов'], ADJECTIVE_ENDINGS],
  [['син'], '(?:ий|яя|ее|ие|его|ей|ею|ему|им|ими|юю|их|ем)'],
  [['лазур', 'бирюз', 'оранж', 'фиолет', 'охр', 'патин'], '(?:ь|и|ью|а|ы|е|у|ой|ою)?'],
  [['охр'], '(?:ян|янн|ист|исто|ов)' + ADJECTIVE_ENDINGS],
  [['лазур'], 'н' + ADJECTIVE_ENDINGS],
  [['син', 'зелен', 'червон', 'блакитн', 'голуб', 'жовт', 'чорн', 'помаранчев', 'бузков'], UK_ENDINGS],
  [['чырвон', 'зялен', 'зелен', 'жоўт', 'бял', 'бел', 'ружов', 'чорн'], BE_ENDINGS],
  [['czerwon', 'czerwien', 'niebiesk', 'blekitn', 'błękitn', 'granatow', 'zielon', 'zolt', 'żółt', 'bial', 'biał', 'czarn', 'pomaranczow', 'pomarańczow', 'fioletow', 'różow', 'rozow', 'szar', 'brazow', 'brązow', 'turkusow', 'zlot', 'złot', 'srebrn'], PL_ENDINGS],
  [['grun', 'grün', 'gelb', 'weiss', 'weiß', 'schwarz'], '(?:lich|st)?' + DE_ENDINGS],
  [['blue', 'green', 'yellow', 'white', 'black', 'orange', 'purple', 'violet', 'pink', 'grey', 'gray', 'brown', 'turquoise', 'gold', 'silver'], '(?:ish|en|ened|ening|ned|ning|y|er|est|r|st|ed|ing)?'],
  [['czerwień', 'czerwien', 'fiolet', 'turkus', 'bial', 'biał', 'zlot', 'złot', 'srebr', 'pomarancz', 'pomarańcz'], ''],
  [['золот'], 'ист' + ADJECTIVE_ENDINGS],
  [['серебр'], 'ист' + ADJECTIVE_ENDINGS],
  [['серебр'], '(?:о|а|у|ом|е)'],
  [['золот'], '(?:о|а|у|ом|е)'],
  [['краснот', 'чернот', 'желтизн', 'белизн'], '(?:а|ы|е|у|ой|ою)'],
  [['зелен', 'син'], '(?:ь|и|ью)'],
  [['серост'], '(?:ь|и|ью)'],
  [['терракот'], '(?:а|ы|е|у|ой|ою|ами|ам|ах)'],
  [['белес'], ADJECTIVE_ENDINGS],
  [['синев'], '(?:а|ы|е|у|ой|ою)'],
  [['czerwien', 'czerwień'], '(?:ią|i|ię)'],
  [['srebrzyst'], PL_ENDINGS],
  [['голуб'], 'оват' + ADJECTIVE_ENDINGS],
  [['розов'], 'ат' + ADJECTIVE_ENDINGS],
  [['красн', 'бел', 'желт', 'зелен', 'черн', 'сер', 'син'], '(?:оват|еват|еньк|оньк)' + ADJECTIVE_ENDINGS],
  [['белоснежн', 'белен'], ADJECTIVE_ENDINGS],
  [['белен'], ''],
  [['позолот', 'zlot', 'złot'], '(?:а|ы|е|у|ой|ою|ами|o|em)?'],
  [['голубизн'], '(?:а|ы|е|у|ой|ою)'],
  [['золот'], '(?:ится|ятся|ит|ят|ясь|ившийся)'],
]
const COMPOUND_PREFIX = '(?:(?:темно|светло|ярко|бледно|красно|бело|серо|черно|сине|желто|зелено|голубо|коричнево))*'
const patterns = GROUPS.flatMap(([roots, ending]) => roots.map(root => new RegExp('^' + COMPOUND_PREFIX + root + ending + '$', 'u')))
function lexicalColorWord(value) {
  return norm(value).split(/[^\p{L}]+/u).filter(Boolean).some(token => patterns.some(pattern => pattern.test(token)))
}
module.exports = { lexicalColorWord }
