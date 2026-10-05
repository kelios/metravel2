// Общие данные тестов конвейера перевода квестов (#2199): русский бандл в форме
// `GET /api/quests/by-quest-id/{quest_id}/` и корректный польский перевод к нему.

export const INTRO_ID = 70
export const GATE_ID = 71
export const TOWER_ID = 72

export const makeBundle = () => ({
  id: 7,
  quest_id: 'demo-quest',
  title: 'Квест по Кракову: демо',
  city: { id: 1, name: 'Краков', name_canonical: 'Краков' },
  finale: {
    text: 'Ты прошёл весь след — от ворот, которыми в город входили короли, до башни над площадью. Дракона давно нет, но легенда жива, пока кто-то идёт по его следу.',
  },
  intro: {
    id: INTRO_ID,
    step_id: 'intro',
    is_intro: true,
    order: 0,
    title: 'Как пройти квест?',
    location: 'Начало приключения',
    story:
      'Говорят, под холмом когда-то спал дракон. Сегодня по его следу пойдёшь ты: читаешь историю, осматриваешься, выполняешь задание прямо на месте и вводишь ответ.',
    task: 'Нажми «Начать квест» — след начинается у ворот.',
    hint: null,
    answer_pattern: { type: 'any', value: '' },
    poi_info: null,
  },
  steps: [
    {
      id: TOWER_ID,
      step_id: '2-tower',
      is_intro: false,
      order: 2,
      title: 'Башня — 82 метра',
      location: 'Bazylika Mariacka',
      story:
        'Северная башня поднимается на 82 метра, а шатёр над ней поставили в 1478 году. Билеты и часы работы — на сайте https://example.org/tower, там же расписание.',
      task: 'Сосчитай башенки вокруг шпиля. Сколько их?',
      hint: 'Обойди башню и считай по кругу.',
      answer_pattern: { type: 'range', value: '{"min":6,"max":8}' },
      poi_info: { opening_hours: 'вт–вс 10:00–18:00, пн выходной', ticket_price: 'обычный 35 PLN, льготный 25 PLN' },
    },
    {
      id: GATE_ID,
      step_id: '1-gate',
      is_intro: false,
      order: 1,
      title: 'Флорианские ворота — страж на рубеже',
      location: 'Флорианские ворота',
      story:
        'Флорианские ворота («Brama Floriańska», около 1300 года) — единственные уцелевшие из восьми городских ворот. Высоко над проездом в 1882 году высекли барельеф по рисунку Яна Матейко.',
      task: 'Встань с внешней стороны ворот и подними взгляд. Какая птица высечена в камне? Назови одним словом.',
      hint: 'Барельеф очень высоко, почти под самой крышей ворот.',
      answer_pattern: { type: 'exact_any', value: '["орел","орёл","eagle","orzel"]' },
      poi_info: null,
    },
  ],
})

export const makePolishTranslation = () => ({
  title: 'Quest po Krakowie: demo',
  status: 'draft',
  finale: {
    text: 'Przeszedłeś cały trop — od bramy, którą do miasta wjeżdżali królowie, po wieżę nad rynkiem. Smoka dawno nie ma, ale legenda żyje, dopóki ktoś idzie jego tropem.',
  },
  steps: [
    {
      step_id: INTRO_ID,
      title: 'Jak przejść quest?',
      location: 'Początek przygody',
      story:
        'Podobno pod wzgórzem spał kiedyś smok. Dziś jego tropem pójdziesz ty: czytasz historię, rozglądasz się, wykonujesz zadanie na miejscu i wpisujesz odpowiedź.',
      task: 'Naciśnij «Rozpocznij zadanie» — trop zaczyna się przy bramie.',
      hint: '',
      answer_variants: [] as string[],
      poi_opening_hours: '',
      poi_ticket_price: '',
      origin: 'machine',
    },
    {
      step_id: GATE_ID,
      title: 'Brama Floriańska — strażnik na rubieży',
      location: 'Brama Floriańska',
      story:
        'Brama Floriańska (około 1300 roku) to jedyna zachowana z ośmiu bram miejskich. Wysoko nad przejazdem w 1882 roku wykuto płaskorzeźbę według rysunku Jana Matejki.',
      task: 'Stań po zewnętrznej stronie bramy i spójrz w górę. Jaki ptak został wykuty w kamieniu? Podaj jedno słowo.',
      hint: 'Płaskorzeźba jest bardzo wysoko, prawie pod samym dachem bramy.',
      answer_variants: ['orzeł', 'orzel', 'orła'],
      poi_opening_hours: '',
      poi_ticket_price: '',
      origin: 'machine',
    },
    {
      step_id: TOWER_ID,
      title: 'Wieża — 82 metry',
      location: 'Bazylika Mariacka',
      story:
        'Północna wieża wznosi się na 82 metry, a hełm nad nią postawiono w 1478 roku. Bilety i godziny otwarcia znajdziesz na stronie https://example.org/tower, tam też jest rozkład.',
      task: 'Policz wieżyczki wokół iglicy. Ile ich jest?',
      hint: 'Obejdź wieżę i licz dookoła.',
      answer_variants: [] as string[],
      poi_opening_hours: 'wt.–niedz. 10:00–18:00, pon. nieczynne',
      poi_ticket_price: 'normalny 35 PLN, ulgowy 25 PLN',
      origin: 'machine',
    },
  ],
})
