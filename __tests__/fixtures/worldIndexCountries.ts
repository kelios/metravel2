/**
 * Страны внешнего индекса маршрутов мира (#3357) — снимок поля `countries` слоя Wikidata полного индекса
 * от 21.11.2026 (771 маршрут, 64 значения): название на RU/BE/UK/PL/EN, как его отдаёт Wikidata, и код таблицы
 * `api/aiAssist/placeCountries.ts`. По снимку тест `promptPlace.test.ts` проверяет, что каждую страну индекса
 * таблица знает и относит к части света; сам индекс (`.codex-temp/3357/dist-v1`) в репозитории не лежит.
 *
 * `code: null` — не страна, а регион, который Wikidata записала в «страну» маршрута (P17) рядом с настоящей:
 * Трансданубия, Славония, Воеводина, Родопы, Фракия у Sultans Trail, три земли Германии у
 * Siegerland-Höhenring. Кода и части света у них нет — маршрут относится к части света своих стран.
 *
 * После новой сборки индекса снимок обновляется: `python3` по `trails-wikidata.jsonl`, уникальные
 * `countries[].qid` с названиями; новая страна без записи в таблице краснит тест.
 */
export const WORLD_INDEX_COUNTRIES: ReadonlyArray<{ qid: string; code: string | null; names: readonly [string, string, string, string, string] }> = [
  { qid: 'Q183', code: 'DE', names: ['Германия', 'Германія', 'Німеччина', 'Niemcy', 'Germany'] },
  { qid: 'Q145', code: 'GB', names: ['Великобритания', 'Вялікабрытанія', 'Сполучене Королівство', 'Wielka Brytania', 'United Kingdom'] },
  { qid: 'Q142', code: 'FR', names: ['Франция', 'Францыя', 'Франція', 'Francja', 'France'] },
  { qid: 'Q30', code: 'US', names: ['США', 'Злучаныя Штаты Амерыкі', 'Сполучені Штати Америки', 'Stany Zjednoczone', 'United States'] },
  { qid: 'Q34', code: 'SE', names: ['Швеция', 'Швецыя', 'Швеція', 'Szwecja', 'Sweden'] },
  { qid: 'Q214', code: 'SK', names: ['Словакия', 'Славакія', 'Словаччина', 'Słowacja', 'Slovakia'] },
  { qid: 'Q38', code: 'IT', names: ['Италия', 'Італія', 'Італія', 'Włochy', 'Italy'] },
  { qid: 'Q29', code: 'ES', names: ['Испания', 'Іспанія', 'Іспанія', 'Hiszpania', 'Spain'] },
  { qid: 'Q36', code: 'PL', names: ['Польша', 'Польшча', 'Польща', 'Polska', 'Poland'] },
  { qid: 'Q27', code: 'IE', names: ['Ирландия', 'Ірландыя', 'Ірландія', 'Irlandia', 'Ireland'] },
  { qid: 'Q39', code: 'CH', names: ['Швейцария', 'Швейцарыя', 'Швейцарія', 'Szwajcaria', 'Switzerland'] },
  { qid: 'Q55', code: 'NL', names: ['Нидерланды', 'Нідэрланды', 'Нідерланди', 'Holandia', 'Netherlands'] },
  { qid: 'Q664', code: 'NZ', names: ['Новая Зеландия', 'Новая Зеландыя', 'Нова Зеландія', 'Nowa Zelandia', 'New Zealand'] },
  { qid: 'Q40', code: 'AT', names: ['Австрия', 'Аўстрыя', 'Австрія', 'Austria', 'Austria'] },
  { qid: 'Q16', code: 'CA', names: ['Канада', 'Канада', 'Канада', 'Kanada', 'Canada'] },
  { qid: 'Q31', code: 'BE', names: ['Бельгия', 'Бельгія', 'Бельгія', 'Belgia', 'Belgium'] },
  { qid: 'Q35', code: 'DK', names: ['Дания', 'Данія', 'Данія', 'Dania', 'Denmark'] },
  { qid: 'Q28', code: 'HU', names: ['Венгрия', 'Венгрыя', 'Угорщина', 'Węgry', 'Hungary'] },
  { qid: 'Q408', code: 'AU', names: ['Австралия', 'Аўстралія', 'Австралія', 'Australia', 'Australia'] },
  { qid: 'Q20', code: 'NO', names: ['Норвегия', 'Нарвегія', 'Норвегія', 'Norwegia', 'Norway'] },
  { qid: 'Q837', code: 'NP', names: ['Непал', 'Непал', 'Непал', 'Nepal', 'Nepal'] },
  { qid: 'Q33', code: 'FI', names: ['Финляндия', 'Фінляндыя', 'Фінляндія', 'Finlandia', 'Finland'] },
  { qid: 'Q213', code: 'CZ', names: ['Чехия', 'Чэхія', 'Чехія', 'Czechy', 'Czech Republic'] },
  { qid: 'Q224', code: 'HR', names: ['Хорватия', 'Харватыя', 'Хорватія', 'Chorwacja', 'Croatia'] },
  { qid: 'Q17', code: 'JP', names: ['Япония', 'Японія', 'Японія', 'Japonia', 'Japan'] },
  { qid: 'Q43', code: 'TR', names: ['Турция', 'Турцыя', 'Туреччина', 'Turcja', 'Turkey'] },
  { qid: 'Q45', code: 'PT', names: ['Португалия', 'Партугалія', 'Португалія', 'Portugalia', 'Portugal'] },
  { qid: 'Q148', code: 'CN', names: ['Китай', 'Кітай', 'Китайська Народна Республіка', 'Chińska Republika Ludowa', "People's Republic of China"] },
  { qid: 'Q215', code: 'SI', names: ['Словения', 'Славенія', 'Словенія', 'Słowenia', 'Slovenia'] },
  { qid: 'Q801', code: 'IL', names: ['Израиль', 'Ізраіль', 'Ізраїль', 'Izrael', 'Israel'] },
  { qid: 'Q32', code: 'LU', names: ['Люксембург', 'Люксембург', 'Люксембург', 'Luksemburg', 'Luxembourg'] },
  { qid: 'Q212', code: 'UA', names: ['Украина', 'Украіна', 'Україна', 'Ukraina', 'Ukraine'] },
  { qid: 'Q228', code: 'AD', names: ['Андорра', 'Андора', 'Андорра', 'Andora', 'Andorra'] },
  { qid: 'Q347', code: 'LI', names: ['Лихтенштейн', 'Ліхтэнштэйн', 'Ліхтенштейн', 'Liechtenstein', 'Liechtenstein'] },
  { qid: 'Q218', code: 'RO', names: ['Румыния', 'Румынія', 'Румунія', 'Rumunia', 'Romania'] },
  { qid: 'Q222', code: 'AL', names: ['Албания', 'Албанія', 'Албанія', 'Albania', 'Albania'] },
  { qid: 'Q227', code: 'AZ', names: ['Азербайджан', 'Азербайджан', 'Азербайджан', 'Azerbejdżan', 'Azerbaijan'] },
  { qid: 'Q236', code: 'ME', names: ['Черногория', 'Чарнагорыя', 'Чорногорія', 'Czarnogóra', 'Montenegro'] },
  { qid: 'Q159', code: 'RU', names: ['Россия', 'Расія', 'Росія', 'Rosja', 'Russia'] },
  { qid: 'Q219', code: 'BG', names: ['Болгария', 'Балгарыя', 'Болгарія', 'Bułgaria', 'Bulgaria'] },
  { qid: 'Q223', code: 'GL', names: ['Гренландия', 'Грэнландыя', 'Гренландія', 'Grenlandia', 'Greenland'] },
  { qid: 'Q225', code: 'BA', names: ['Босния и Герцеговина', 'Боснія і Герцагавіна', 'Боснія і Герцеговина', 'Bośnia i Hercegowina', 'Bosnia and Herzegovina'] },
  { qid: 'Q230', code: 'GE', names: ['Грузия', 'Грузія', 'Грузія', 'Gruzja', 'Georgia'] },
  { qid: 'Q235', code: 'MC', names: ['Монако', 'Манака', 'Монако', 'Monako', 'Monaco'] },
  { qid: 'Q258', code: 'ZA', names: ['ЮАР', 'Паўднёва-Афрыканская Рэспубліка', 'Південно-Африканська Республіка', 'Południowa Afryka', 'South Africa'] },
  { qid: 'Q298', code: 'CL', names: ['Чили', 'Чылі', 'Чилі', 'Chile', 'Chile'] },
  { qid: 'Q334', code: 'SG', names: ['Сингапур', 'Сінгапур', 'Сінгапур', 'Singapur', 'Singapore'] },
  { qid: 'Q399', code: 'AM', names: ['Армения', 'Арменія', 'Вірменія', 'Armenia', 'Armenia'] },
  { qid: 'Q403', code: 'RS', names: ['Сербия', 'Сербія', 'Сербія', 'Serbia', 'Serbia'] },
  { qid: 'Q419', code: 'PE', names: ['Перу', 'Перу', 'Перу', 'Peru', 'Peru'] },
  { qid: 'Q736', code: 'EC', names: ['Эквадор', 'Эквадор', 'Еквадор', 'Ekwador', 'Ecuador'] },
  { qid: 'Q819', code: 'LA', names: ['Лаос', 'Лаос', 'Лаос', 'Laos', 'Laos'] },
  { qid: 'Q865', code: 'TW', names: ['Китайская Республика (Тайвань)', 'Тайвань', 'Республіка Китай', 'Republika Chińska', 'Taiwan'] },
  { qid: 'Q1198', code: null, names: ['Северный Рейн-Вестфалия', 'Паўночны Рэйн-Вестфалія', 'Північний Рейн — Вестфалія', 'Nadrenia Północna-Westfalia', 'North Rhine-Westphalia'] },
  { qid: 'Q1199', code: null, names: ['Гессен', 'Гесэн', 'Гессен', 'Hesja', 'Hesse'] },
  { qid: 'Q1200', code: null, names: ['Рейнланд-Пфальц', 'Рэйнланд-Пфальц', 'Рейнланд-Пфальц', 'Nadrenia-Palatynat', 'Rhineland-Palatinate'] },
  { qid: 'Q1246', code: 'XK', names: ['Республика Косово', 'Рэспубліка Косава', 'Косово', 'Kosowo', 'Kosovo'] },
  { qid: 'Q6489', code: null, names: ['Родопы', 'Радопы', 'Родопи', 'Rodopy', 'Rhodope Mountains'] },
  { qid: 'Q9676', code: 'IM', names: ['Остров Мэн', 'востраў Мэн', 'Острів Мен', 'Wyspa Man', 'Isle of Man'] },
  { qid: 'Q41741', code: null, names: ['Фракия', 'Фракія', 'Фракія', 'Tracja', 'Thrace'] },
  { qid: 'Q44749', code: null, names: ['Воеводина', 'аўтаномны край Ваяводзіна', 'Воєводина', 'Wojwodina', 'Vojvodina'] },
  { qid: 'Q681964', code: null, names: ['Славония', 'Славонія', 'Славонія', 'Slawonia', 'Slavonia'] },
  { qid: 'Q840562', code: null, names: ['Трансданубия', 'Дунантуль', "Задунав'я", 'Kraj Zadunajski', 'Transdanubia'] },
  { qid: 'Q1054923', code: 'HK', names: ['Британский Гонконг', 'Брытанскі Ганконг', 'Британський Гонконг', 'Brytyjski Hongkong', 'British Hong Kong'] },
]
