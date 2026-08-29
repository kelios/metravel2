// __tests__/fixtures/questRejectedAnswerCorpus.ts
//
// Реальный корпус отклонённых ответов игроков, снятый с прода 2026-08-29 из
// таблицы \`quest_answer_attempt\` (все строки с \`verdict = rejected\` и непустым
// \`raw_answer\`).
//
// Зачем он зафиксирован. С 29.08.2026 проверка ответа двухпроходная: после
// строгого сравнения работает морфологический проход
// (\`utils/questAnswerMorphology.ts\`), принимающий словоформу уже принимаемого
// слова. Ошибка такого прохода ТИХАЯ: отказ игрок видит сразу и жалуется, а
// лишнее принятие не видит никто. Единственный способ удержать границы правила —
// доказывать на каждом прогоне, что ни один ответ, который продукт считал
// неверным, не начал приниматься.
//
// Как корпус собран: 113 попыток → 96 уникальных пар «шаг + ввод» → 83 записей.
// Отброшены:
//   - свободные ответы (\`any\`, \`any_text\`): там отказ означает «слишком
//     коротко» и к правилу сопоставления отношения не имеет;
//   - 13 вводов, которые СЕЙЧАС принимаются строгим сравнением, потому что
//     редактор с тех пор расширил словарь шага руками (\`holmskie\`: «снаряд»,
//     «пуля», «патрон», «патроны» — #1630; \`5-okna-ozyora\`: «коричневого»,
//     «рыжего» — #1450; \`3-fligel\`, \`2-kaplica\`). Они больше не отказы, и
//     держать их в корпусе отказов значило бы сторожить прошлое.
//
// Что здесь лежит и чего здесь нет:
//   - \`input\` — НОРМАЛИЗОВАННЫЙ ввод (\`normalize()\` из \`questAdapters\`), то
//     есть ровно та строка, которую видит чекер. Ни \`session_key\`, ни
//     \`user_id\`, ни времени: корпус описывает ответы, а не игроков;
//   - \`answerValue\` — паттерн шага НА МОМЕНТ СНЯТИЯ, снимком. Именно снимком, а
//     не чтением с прода: страж обязан проверять правило сопоставления, и
//     правка словаря редактором не должна ронять его задним числом.
//
// Состав по типам паттерна: \`exact_any\` 59, \`range\` 18, \`exact\` 6.
//
// Среди этих вводов есть и добросовестные ответы, отклонённые по делу
// (\`оружие\` на «от чего выбоины», \`12\` и \`13\` на «сколько фигур за столом»),
// и мусор (\`кк\`, \`собачий сыр\`). Для стража разницы нет: продукт считал их
// неверными, и двухпроходная проверка обязана считать так же.

export type RejectedAnswerCase = {
  /** DB-id шага: по нему находится квест и шаг при разборе падения. */
  stepDbId: number
  quest: string
  step: string
  /** Нормализованный ввод игрока — то, что получает чекер. */
  input: string
  /** Тип паттерна шага на момент снятия корпуса. */
  answerType: string
  /** \`answer_pattern.value\` на момент снятия, снимком. */
  answerValue: string
}

export const QUEST_REJECTED_ANSWER_CORPUS: readonly RejectedAnswerCase[] = [
  {
    stepDbId: 325,
    quest: "minsk-cipher",
    step: "3-pobeda",
    input: "33",
    answerType: "exact_any",
    answerValue: "[\"6\",\"шесть\"]"
  },
  {
    stepDbId: 324,
    quest: "minsk-cipher",
    step: "2-kostel",
    input: "георгий",
    answerType: "exact_any",
    answerValue: "[\"михаил\",\"архангел михаил\",\"святой михаил\",\"св михаил\",\"міхаіл\",\"архангел міхаіл\",\"святой міхаіл\",\"св міхаіл\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "роза",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 323,
    quest: "minsk-cipher",
    step: "1-vorota",
    input: "999",
    answerType: "range",
    answerValue: "{\"min\":10,\"max\":12}"
  },
  {
    stepDbId: 746,
    quest: "braslav-mezh-ozyor",
    step: "1-uspenskaya-church",
    input: "2",
    answerType: "range",
    answerValue: "{\"min\":4,\"max\":6}"
  },
  {
    stepDbId: 746,
    quest: "braslav-mezh-ozyor",
    step: "1-uspenskaya-church",
    input: "3",
    answerType: "range",
    answerValue: "{\"min\":4,\"max\":6}"
  },
  {
    stepDbId: 746,
    quest: "braslav-mezh-ozyor",
    step: "1-uspenskaya-church",
    input: "1",
    answerType: "range",
    answerValue: "{\"min\":4,\"max\":6}"
  },
  {
    stepDbId: 397,
    quest: "pinsk-polesie",
    step: "2-dvorec-butrimovicha",
    input: "пролрм",
    answerType: "exact_any",
    answerValue: "[\"загс\",\"дворец бракосочетаний\",\"дворец бракосочетания\",\"дворец бракосочетании\",\"бракосочетания\",\"бракосочетание\",\"свадьбы\",\"свадьба\",\"свадебные церемонии\",\"свадебный дворец\",\"женятся\",\"здесь женятся\",\"тут женятся\",\"регистрация брака\",\"регистрируют брак\",\"регистрируют браки\",\"заключают браки\",\"заключение брака\",\"дворец брака\",\"свадьбы и музей\"]"
  },
  {
    stepDbId: 275,
    quest: "minsk-loshitsa",
    step: "1-usadba",
    input: "3",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 275,
    quest: "minsk-loshitsa",
    step: "1-usadba",
    input: "4",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 1212,
    quest: "krakow-bike-tyniec",
    step: "2-zakrzowek",
    input: "синяя",
    answerType: "exact_any",
    answerValue: "[\"бирюзовый\",\"бирюзовая\",\"бирюза\",\"изумрудный\",\"изумрудная\",\"лазурный\",\"лазурная\",\"голубой\",\"голубая\",\"сине зеленый\",\"сине зеленая\",\"зелено голубой\",\"аквамарин\",\"аквамариновый\"]"
  },
  {
    stepDbId: 1212,
    quest: "krakow-bike-tyniec",
    step: "2-zakrzowek",
    input: "синяя бирюзовая",
    answerType: "exact_any",
    answerValue: "[\"бирюзовый\",\"бирюзовая\",\"бирюза\",\"изумрудный\",\"изумрудная\",\"лазурный\",\"лазурная\",\"голубой\",\"голубая\",\"сине зеленый\",\"сине зеленая\",\"зелено голубой\",\"аквамарин\",\"аквамариновый\"]"
  },
  {
    stepDbId: 1214,
    quest: "krakow-bike-tyniec",
    step: "4-tyniec",
    input: "стена",
    answerType: "exact_any",
    answerValue: "[\"колодец\",\"студня\",\"колодезь\",\"источник воды\",\"скважина\",\"studnia\"]"
  },
  {
    stepDbId: 1216,
    quest: "krakow-bike-tyniec",
    step: "5-kladka",
    input: "пристань",
    answerType: "exact_any",
    answerValue: "[\"шлюз\",\"шлюза\",\"шлюзовая камера\",\"судоходный шлюз\",\"sluza\",\"шлюзы\"]"
  },
  {
    stepDbId: 1216,
    quest: "krakow-bike-tyniec",
    step: "5-kladka",
    input: "причал",
    answerType: "exact_any",
    answerValue: "[\"шлюз\",\"шлюза\",\"шлюзовая камера\",\"судоходный шлюз\",\"sluza\",\"шлюзы\"]"
  },
  {
    stepDbId: 1219,
    quest: "krakow-bike-tyniec",
    step: "8-salwator",
    input: "3",
    answerType: "range",
    answerValue: "{\"min\":7,\"max\":9}"
  },
  {
    stepDbId: 1212,
    quest: "krakow-bike-tyniec",
    step: "2-zakrzowek",
    input: "бирюзованя",
    answerType: "exact_any",
    answerValue: "[\"бирюзовый\",\"бирюзовая\",\"бирюза\",\"изумрудный\",\"изумрудная\",\"лазурный\",\"лазурная\",\"голубой\",\"голубая\",\"сине зеленый\",\"сине зеленая\",\"зелено голубой\",\"аквамарин\",\"аквамариновый\"]"
  },
  {
    stepDbId: 168,
    quest: "polotsk-ancient",
    step: "sofia",
    input: "7",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 168,
    quest: "polotsk-ancient",
    step: "sofia",
    input: "5",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 168,
    quest: "polotsk-ancient",
    step: "sofia",
    input: "9",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 168,
    quest: "polotsk-ancient",
    step: "sofia",
    input: "3",
    answerType: "range",
    answerValue: "{\"min\":2,\"max\":2}"
  },
  {
    stepDbId: 993,
    quest: "vitebsk-kids-skazki",
    step: "1-ulichny-kloun",
    input: "скрипка",
    answerType: "exact_any",
    answerValue: "[\"собака\",\"собачка\",\"пёс\",\"песик\",\"пудель\",\"щенок\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "папороть",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "папороть кветка",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "папароть кветка",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "папааоть кветка",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 326,
    quest: "minsk-cipher",
    step: "4-kupala",
    input: "папарать кветка",
    answerType: "exact_any",
    answerValue: "[\"папараць кветка\",\"цветок папоротника\",\"папоротник\",\"папараци кветка\",\"кветка папараци\",\"папороць кветка\"]"
  },
  {
    stepDbId: 957,
    quest: "minsk-kids-bronze-friends",
    step: "1-ekipazh",
    input: "одна",
    answerType: "exact_any",
    answerValue: "[\"2\",\"две\",\"две лошади\",\"пара лошадей\",\"двое\"]"
  },
  {
    stepDbId: 1269,
    quest: "vilnius-kids-iron-wolf",
    step: "1-varpine",
    input: "3",
    answerType: "exact",
    answerValue: "1"
  },
  {
    stepDbId: 1269,
    quest: "vilnius-kids-iron-wolf",
    step: "1-varpine",
    input: "2",
    answerType: "exact",
    answerValue: "1"
  },
  {
    stepDbId: 1269,
    quest: "vilnius-kids-iron-wolf",
    step: "1-varpine",
    input: "5",
    answerType: "exact",
    answerValue: "1"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "золотой",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "зеленый",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "зеленый и золотой",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "жолтые",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "желтые",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 290,
    quest: "minsk-dvoriki",
    step: "1-voyt",
    input: "ключ и план",
    answerType: "exact_any",
    answerValue: "[\"ключ и грамоту\",\"ключ и свиток\",\"ключ и грамота\",\"ключ грамота\",\"ключ и документ\",\"ключ свиток\",\"грамота и ключ\",\"свиток и ключ\"]"
  },
  {
    stepDbId: 558,
    quest: "grodno-gorodnitsa",
    step: "6-pamyatnik-jiliberu",
    input: "столб",
    answerType: "exact_any",
    answerValue: "[\"трость\",\"на трость\",\"тростью\",\"на трости\",\"посох\",\"палка\",\"палку\",\"палкой\",\"на палку\",\"на посох\",\"клюка\"]"
  },
  {
    stepDbId: 993,
    quest: "vitebsk-kids-skazki",
    step: "1-ulichny-kloun",
    input: "баян",
    answerType: "exact_any",
    answerValue: "[\"собака\",\"собачка\",\"пёс\",\"песик\",\"пудель\",\"щенок\"]"
  },
  {
    stepDbId: 993,
    quest: "vitebsk-kids-skazki",
    step: "1-ulichny-kloun",
    input: "акардион",
    answerType: "exact_any",
    answerValue: "[\"собака\",\"собачка\",\"пёс\",\"песик\",\"пудель\",\"щенок\"]"
  },
  {
    stepDbId: 993,
    quest: "vitebsk-kids-skazki",
    step: "1-ulichny-kloun",
    input: "аккордеон",
    answerType: "exact_any",
    answerValue: "[\"собака\",\"собачка\",\"пёс\",\"песик\",\"пудель\",\"щенок\"]"
  },
  {
    stepDbId: 883,
    quest: "vyaloe-tyshkevich-curse",
    step: "4-dub-starozhil",
    input: "сосна",
    answerType: "exact_any",
    answerValue: "[\"дуб\",\"это дуб\",\"дуб обыкновенный\",\"старый дуб\",\"вековой дуб\",\"дуб черешчатый\"]"
  },
  {
    stepDbId: 791,
    quest: "yelnya-bog-bells",
    step: "5-okna-ozyora",
    input: "прозрачного",
    answerType: "exact_any",
    answerValue: "[\"коричневая\",\"коричневый\",\"коричневая вода\",\"темно коричневая\",\"бурая\",\"бурый\",\"рыжая\",\"рыжеватая\",\"ржавая\",\"янтарная\",\"чайного цвета\",\"цвета чая\",\"цвет чая\",\"как чай\",\"чайная\",\"темная\",\"темный\",\"темно бурая\",\"черная\",\"черный\",\"торфяная\",\"кофейная\",\"коричневатая\",\"коричневого\",\"коричневой\",\"коричневатого\",\"коричневатой\",\"бурого\",\"бурой\",\"рыжий\",\"рыжего\",\"рыжей\",\"рыжеватый\",\"рыжеватого\",\"рыжеватой\",\"ржавый\",\"ржавого\",\"ржавой\",\"янтарный\",\"янтарного\",\"янтарной\",\"чайный\",\"чайного\",\"чайной\",\"темного\",\"темной\",\"темно коричневый\",\"темно коричневого\",\"темнокоричневая\",\"темнокоричневый\",\"темнокоричневого\",\"темнокоричневой\",\"темно бурый\",\"темно бурого\",\"темнобурая\",\"темнобурый\",\"темнобурого\",\"темнобурой\",\"черного\",\"черной\",\"торфяной\",\"торфяного\",\"кофейный\",\"кофейного\",\"кофейной\"]"
  },
  {
    stepDbId: 205,
    quest: "torun-copernicus",
    step: "dom",
    input: "дерево",
    answerType: "exact_any",
    answerValue: "[\"кирпич\",\"кирпича\",\"из кирпича\",\"красный кирпич\",\"кирпичи\",\"кирпичом\"]"
  },
  {
    stepDbId: 205,
    quest: "torun-copernicus",
    step: "dom",
    input: "бетон",
    answerType: "exact_any",
    answerValue: "[\"кирпич\",\"кирпича\",\"из кирпича\",\"красный кирпич\",\"кирпичи\",\"кирпичом\"]"
  },
  {
    stepDbId: 1272,
    quest: "vilnius-kids-iron-wolf",
    step: "4-ona",
    input: "дерево",
    answerType: "exact_any",
    answerValue: "[\"кирпич\",\"кирпичи\",\"кирпича\",\"кирпичей\",\"из кирпича\",\"из кирпичей\",\"кирпичик\",\"кирпичики\",\"красный кирпич\"]"
  },
  {
    stepDbId: 1272,
    quest: "vilnius-kids-iron-wolf",
    step: "4-ona",
    input: "бетон",
    answerType: "exact_any",
    answerValue: "[\"кирпич\",\"кирпичи\",\"кирпича\",\"кирпичей\",\"из кирпича\",\"из кирпичей\",\"кирпичик\",\"кирпичики\",\"красный кирпич\"]"
  },
  {
    stepDbId: 994,
    quest: "vitebsk-kids-skazki",
    step: "2-tsvetochnitsa",
    input: "пес",
    answerType: "exact_any",
    answerValue: "[\"василёк\",\"василек\",\"васильки\"]"
  },
  {
    stepDbId: 994,
    quest: "vitebsk-kids-skazki",
    step: "2-tsvetochnitsa",
    input: "пудель",
    answerType: "exact_any",
    answerValue: "[\"василёк\",\"василек\",\"васильки\"]"
  },
  {
    stepDbId: 516,
    quest: "amsterdam-on-piles",
    step: "1-dam",
    input: "пять",
    answerType: "exact_any",
    answerValue: "[\"3\",\"три\",\"три креста\",\"3 креста\",\"трех\",\"трех крестов\",\"xxx\",\"три икса\",\"3 икса\",\"тройной крест\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "i",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "ъ",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "й",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "ерь",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "ять",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1018,
    quest: "brest-teens-erased-city",
    step: "1-garden-arch",
    input: "y",
    answerType: "exact_any",
    answerValue: "[\"сад\",\"садъ\",\"городской сад\",\"городской садъ\",\"горсад\",\"горсадъ\"]"
  },
  {
    stepDbId: 1019,
    quest: "brest-teens-erased-city",
    step: "2-city-foundation",
    input: "2019",
    answerType: "exact_any",
    answerValue: "[\"1019\"]"
  },
  {
    stepDbId: 1019,
    quest: "brest-teens-erased-city",
    step: "2-city-foundation",
    input: "1918",
    answerType: "exact_any",
    answerValue: "[\"1019\"]"
  },
  {
    stepDbId: 1019,
    quest: "brest-teens-erased-city",
    step: "2-city-foundation",
    input: "1818",
    answerType: "exact_any",
    answerValue: "[\"1019\"]"
  },
  {
    stepDbId: 80,
    quest: "krakow-dragon",
    step: "2-mariacki",
    input: "крест",
    answerType: "exact_any",
    answerValue: "[\"корона\",\"корону\",\"короны\",\"короной\",\"золотая корона\",\"золоченая корона\",\"золочёная корона\",\"korona\",\"crown\"]"
  },
  {
    stepDbId: 80,
    quest: "krakow-dragon",
    step: "2-mariacki",
    input: "купол",
    answerType: "exact_any",
    answerValue: "[\"корона\",\"корону\",\"короны\",\"короной\",\"золотая корона\",\"золоченая корона\",\"золочёная корона\",\"korona\",\"crown\"]"
  },
  {
    stepDbId: 995,
    quest: "vitebsk-kids-skazki",
    step: "3-hottabych",
    input: "амфора",
    answerType: "exact_any",
    answerValue: "[\"кувшин\",\"кувшина\"]"
  },
  {
    stepDbId: 996,
    quest: "vitebsk-kids-skazki",
    step: "4-teatr-lyalka",
    input: "белорусский театр",
    answerType: "exact_any",
    answerValue: "[\"кукольный\", \"кукольный театр\", \"театр кукол\", \"кукол\", \"кукольного\"]"
  },
  {
    stepDbId: 997,
    quest: "vitebsk-kids-skazki",
    step: "5-san-krispin",
    input: "миска",
    answerType: "exact_any",
    answerValue: "[\"кольцо\",\"колечко\",\"кольца\",\"на кольцо\",\"обруч\",\"обод\",\"ободок\",\"бортик\",\"круг\",\"кружок\",\"круглая\",\"круглое\",\"круглый\",\"окружность\",\"колесо\",\"бублик\",\"баранка\",\"абруч\",\"абадок\",\"кола\",\"круглае\",\"круглы\",\"кальцо\",\"калечка\"]"
  },
  {
    stepDbId: 997,
    quest: "vitebsk-kids-skazki",
    step: "5-san-krispin",
    input: "тарелка",
    answerType: "exact_any",
    answerValue: "[\"кольцо\",\"колечко\",\"кольца\",\"на кольцо\",\"обруч\",\"обод\",\"ободок\",\"бортик\",\"круг\",\"кружок\",\"круглая\",\"круглое\",\"круглый\",\"окружность\",\"колесо\",\"бублик\",\"баранка\",\"абруч\",\"абадок\",\"кола\",\"круглае\",\"круглы\",\"кальцо\",\"калечка\"]"
  },
  {
    stepDbId: 997,
    quest: "vitebsk-kids-skazki",
    step: "5-san-krispin",
    input: "крыжка",
    answerType: "exact_any",
    answerValue: "[\"кольцо\",\"колечко\",\"кольца\",\"на кольцо\",\"обруч\",\"обод\",\"ободок\",\"бортик\",\"круг\",\"кружок\",\"круглая\",\"круглое\",\"круглый\",\"окружность\",\"колесо\",\"бублик\",\"баранка\",\"абруч\",\"абадок\",\"кола\",\"круглае\",\"круглы\",\"кальцо\",\"калечка\"]"
  },
  {
    stepDbId: 201,
    quest: "poznan-goats",
    step: "zamek",
    input: "wrong",
    answerType: "exact_any",
    answerValue: "[\"лев\",\"львы\",\"львов\",\"львами\",\"лева\",\"lew\",\"lwy\"]"
  },
  {
    stepDbId: 201,
    quest: "poznan-goats",
    step: "zamek",
    input: "wrong2",
    answerType: "exact_any",
    answerValue: "[\"лев\",\"львы\",\"львов\",\"львами\",\"лева\",\"lew\",\"lwy\"]"
  },
  {
    stepDbId: 201,
    quest: "poznan-goats",
    step: "zamek",
    input: "wrong3",
    answerType: "exact_any",
    answerValue: "[\"лев\",\"львы\",\"львов\",\"львами\",\"лева\",\"lew\",\"lwy\"]"
  },
  {
    stepDbId: 200,
    quest: "poznan-goats",
    step: "katedra",
    input: "лев",
    answerType: "exact",
    answerValue: "2"
  },
  {
    stepDbId: 200,
    quest: "poznan-goats",
    step: "katedra",
    input: "меч",
    answerType: "exact",
    answerValue: "2"
  },
  {
    stepDbId: 200,
    quest: "poznan-goats",
    step: "katedra",
    input: "мак",
    answerType: "exact",
    answerValue: "2"
  },
  {
    stepDbId: 1481,
    quest: "luxembourg-melusina",
    step: "1-place-darmes",
    input: "жираф",
    answerType: "exact_any",
    answerValue: "[\"лев\",\"льва\",\"лева\",\"бронзовый лев\",\"лев с гербом\",\"лев и герб\",\"лев держит герб\",\"лев с щитом\",\"лев со щитом\"]"
  },
  {
    stepDbId: 721,
    quest: "gervyaty-kostel",
    step: "1-apostoly",
    input: "георгий победоносец",
    answerType: "exact_any",
    answerValue: "[\"архангел михаил\",\"архангела михаила\",\"михаил\",\"архангел\",\"ангел михаил\",\"св михаил\",\"святой михаил\",\"архангелом михаилом\",\"михаил архангел\",\"архангел михаила\",\"михаила\"]"
  },
  {
    stepDbId: 135,
    quest: "brest-fortress",
    step: "zhazhda",
    input: "котелок",
    answerType: "exact_any",
    answerValue: "[\"каска\",\"каску\",\"каской\",\"шлем\",\"шлемом\",\"каска бойца\"]"
  },
  {
    stepDbId: 136,
    quest: "brest-fortress",
    step: "holmskie",
    input: "оружие",
    answerType: "exact_any",
    answerValue: "[\"пуля\",\"пули\",\"пуль\",\"пулю\",\"пулей\",\"пулями\",\"пулях\",\"от пуль\",\"от пули\",\"от пуль и снарядов\",\"снаряд\",\"снаряды\",\"снаряда\",\"снарядов\",\"снарядами\",\"от снарядов\",\"от снаряда\",\"осколок\",\"осколки\",\"осколка\",\"осколков\",\"осколками\",\"от осколков\",\"выстрел\",\"выстрелы\",\"выстрела\",\"выстрелов\",\"от выстрелов\",\"стрельба\",\"стрельбы\",\"от стрельбы\",\"обстрел\",\"обстрела\",\"обстрелы\",\"от обстрела\",\"бомбежка\",\"бомбежки\",\"от бомбежки\",\"патрон\",\"патроны\",\"патронов\",\"от патронов\",\"пулі\",\"куля\",\"кулі\",\"куль\",\"снарад\",\"снарады\",\"аскепак\",\"аскепкі\",\"стрэл\",\"стрэлы\",\"абстрэл\"]"
  },
  {
    stepDbId: 136,
    quest: "brest-fortress",
    step: "holmskie",
    input: "ружье",
    answerType: "exact_any",
    answerValue: "[\"пуля\",\"пули\",\"пуль\",\"пулю\",\"пулей\",\"пулями\",\"пулях\",\"от пуль\",\"от пули\",\"от пуль и снарядов\",\"снаряд\",\"снаряды\",\"снаряда\",\"снарядов\",\"снарядами\",\"от снарядов\",\"от снаряда\",\"осколок\",\"осколки\",\"осколка\",\"осколков\",\"осколками\",\"от осколков\",\"выстрел\",\"выстрелы\",\"выстрела\",\"выстрелов\",\"от выстрелов\",\"стрельба\",\"стрельбы\",\"от стрельбы\",\"обстрел\",\"обстрела\",\"обстрелы\",\"от обстрела\",\"бомбежка\",\"бомбежки\",\"от бомбежки\",\"патрон\",\"патроны\",\"патронов\",\"от патронов\",\"пулі\",\"куля\",\"кулі\",\"куль\",\"снарад\",\"снарады\",\"аскепак\",\"аскепкі\",\"стрэл\",\"стрэлы\",\"абстрэл\"]"
  },
  {
    stepDbId: 125,
    quest: "grodno-royal",
    step: "kalozha",
    input: "глина",
    answerType: "exact_any",
    answerValue: "[\"плинфа\",\"плінфа\",\"кирпич\",\"кирпича\",\"из кирпича\",\"кирпичь\"]"
  },
  {
    stepDbId: 125,
    quest: "grodno-royal",
    step: "kalozha",
    input: "собачий сыр",
    answerType: "exact_any",
    answerValue: "[\"плинфа\",\"плінфа\",\"кирпич\",\"кирпича\",\"из кирпича\",\"кирпичь\"]"
  },
  {
    stepDbId: 109,
    quest: "krakow-dragon",
    step: "4-barbakan",
    input: "кк",
    answerType: "exact_any",
    answerValue: "[\"орел\",\"орёл\",\"орла\",\"белый орел\",\"белый орёл\",\"eagle\",\"orzel\",\"orzeł\"]"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "12",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 160,
    quest: "mir-castle",
    step: "church",
    input: "13",
    answerType: "range",
    answerValue: "{\"min\": 3, \"max\": 3}"
  },
  {
    stepDbId: 537,
    quest: "brest-lantern",
    step: "1-chasy-fonarey",
    input: "закат",
    answerType: "exact_any",
    answerValue: "[\"зажжения фонарей\",\"время зажжения фонарей\",\"зажжение фонарей\",\"зажигания фонарей\",\"зажигание фонарей\",\"время зажжения\",\"время зажигания фонарей\",\"зажжения\",\"зажжение\",\"зажигания\",\"зажигание\",\"фонарей\",\"фонари\",\"запальвання ліхтароў\",\"час запальвання ліхтароў\"]"
  }
] as const
