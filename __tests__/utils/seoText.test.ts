import { buildSeoTitle, htmlToPlainText, normalizeSeoLead } from '@/utils/seoText';

// Общие правила текста выдачи. Заголовок отдельно покрыт в
// __tests__/scripts/generate-seo-pages.test.ts (buildSeoTitle через SSG-обёртку),
// здесь фиксируем контракт самого модуля и очистку лида.
describe('seoText', () => {
  describe('htmlToPlainText', () => {
    it.each([
      ['<p>Жемыславле</p><p>Дворец Умястовских</p>', 'Жемыславле Дворец Умястовских'],
      ['<p>Проверьте вы.</p><p>Ищите новый маршрут</p>', 'Проверьте вы. Ищите новый маршрут'],
      ['<ul><li>Первый пункт</li><li>Второй пункт</li></ul>', 'Первый пункт Второй пункт'],
      ['<strong>Беларусь.</strong><strong>Ищите дворец</strong>', 'Беларусь. Ищите дворец'],
    ])('preserves a readable boundary for adjacent fragments', (html, expected) => {
      expect(htmlToPlainText(html)).toBe(expected);
    });

    it('removes executable and comment markup without leaking or doubling whitespace', () => {
      expect(
        htmlToPlainText('<style>.x{}</style><p>A&nbsp;&amp;&nbsp;B</p><!-- hidden --><script>alert(1)</script>'),
      ).toBe('A & B');
    });

    it('decodes decimal and hexadecimal entities', () => {
      expect(htmlToPlainText('&#1046;&#x435;&#1084;&#1099;&#1089;&#1083;&#1072;&#1074;&#1083;&#1100;')).toBe(
        'Жемыславль',
      );
      expect(htmlToPlainText('&constructor; &unknown;')).toBe('&constructor; &unknown;');
    });

    it.each([
      ['(<strong>Минск</strong>)', '(Минск)'],
      ['&laquo;<strong>Минск</strong>&raquo;', '«Минск»'],
      ['Санкт-<strong>Петербург</strong>', 'Санкт-Петербург'],
      ['<strong>RU</strong>/<strong>EN</strong>', 'RU/EN'],
      ['слово - слово', 'слово - слово'],
    ])('does not introduce spaces around punctuation inside inline markup', (html, expected) => {
      expect(htmlToPlainText(html)).toBe(expected);
    });

    it('drops executable content even when its closing tag is missing', () => {
      expect(htmlToPlainText('<p>Visible</p><script>alert(1)')).toBe('Visible');
      expect(htmlToPlainText('<p>Visible</p><style>.hidden{}')).toBe('Visible');
    });
  });

  describe('buildSeoTitle', () => {
    it('keeps the brand suffix while it fits the budget', () => {
      expect(buildSeoTitle('Албания. Влёра')).toBe('Албания. Влёра | Metravel');
    });

    it('drops the brand instead of the keywords when both do not fit', () => {
      const name = 'Смолевуд: натурная площадка Беларусьфильма под Минском';
      expect(buildSeoTitle(name)).toBe(name);
    });
  });

  describe('normalizeSeoLead', () => {
    it('strips decorative pictographs so the snippet starts with meaning', () => {
      expect(normalizeSeoLead('🏰 Форты Первой мировой 📍 Местоположение')).toBe(
        'Форты Первой мировой Местоположение',
      );
      expect(normalizeSeoLead('Италия 🇮🇹 Озеро Гарда')).toBe('Италия Озеро Гарда');
    });

    it('drops the leading "from-to (Nкм)" service line', () => {
      expect(normalizeSeoLead('Краков - Каспровый Верх (107км 1 час 40 минут) 🏔 Каспровый Верх (1987 м)')).toBe(
        'Каспровый Верх (1987 м)',
      );
      expect(normalizeSeoLead('От Кракова до парковки (80 км 1ч 20) Парковка в Хуциско')).toBe(
        'Парковка в Хуциско',
      );
    });

    it('keeps typography that carries meaning', () => {
      const lead = 'Маршрут: Zamek Grodno → Zapora na Jeziorze — высота 350 м, №4, 12 °C';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('does not eat the whole lead when the route line is the only sentence', () => {
      // Строка маршрута — весь текст: сниппет без неё пустой, поэтому оставляем как есть.
      expect(normalizeSeoLead('Краков - Закопане (107 км)')).toBe('Краков - Закопане (107 км)');
    });

    it('collapses the whitespace left behind and trims dangling punctuation', () => {
      expect(normalizeSeoLead('  🌊  Ростока  ,  историческая часть города ')).toBe(
        'Ростока, историческая часть города',
      );
    });

    // Лиды ниже — реальные первые абзацы опубликованных статей (замер 04.09.2026
    // по GSC 05.08–01.09.2026). Символ ⠀ — U+2800, невидимая распорка абзаца из
    // редактора: именно она отделяет подпись автора эпиграфа от текста статьи.
    it('drops the leading GPS/distance block', () => {
      expect(
        normalizeSeoLead(
          'Координаты GPS: 53.224367, 26.689889 Расстояние от Минска 120 км. Несвижский замок - комплекс возле городка Несвиж.',
        ),
      ).toBe('Несвижский замок - комплекс возле городка Несвиж.');

      expect(
        normalizeSeoLead(
          'Координаты gps: 52.1558, 23.6379 Расстояние от Бреста: 5 км. Расстояние от Минска: 327 км. В деревеньке Скоки сохранилась усадьба Немцевичей.',
        ),
      ).toBe('В деревеньке Скоки сохранилась усадьба Немцевичей.');
    });

    it('drops the leading epigraph together with its attribution', () => {
      expect(
        normalizeSeoLead(
          '«Жизнь скоротечна - наследие вечно» Пётр Квятковский ⠀ ⠀Попав на усадьбу Котлубаев в деревне Ястрембель, усадебный дом вызывает восторг.',
        ),
      ).toBe('Попав на усадьбу Котлубаев в деревне Ястрембель, усадебный дом вызывает восторг.');
    });

    it('finds the attribution when the paragraph spacer stands before it', () => {
      expect(
        normalizeSeoLead(
          '«Ах, экономна мудрость бытия: Всё новое в ней шьётся из старья!» ⠀ Константин Фофанов ⠀ ⠀Бывали в Закозеле, признавайтесь? Если были года 3-4 назад, то я завидую.',
        ),
      ).toBe('Бывали в Закозеле, признавайтесь? Если были года 3-4 назад, то я завидую.');
    });

    it('keeps the attribution when no spacer separates it from the text', () => {
      // «Сенека Третья и заключительная…»: подпись и первое слово текста обе с
      // заглавной, границы между ними нет. Угадывать нельзя — русский лид сплошь
      // и рядом открывается двумя словами с заглавной, и эвристика съедала бы
      // текст. Цитату снимаем (она кончается точкой), подпись остаётся.
      expect(
        normalizeSeoLead(
          '«Судьба ничего не дает в вечную собственность.» Сенека Третья и заключительная часть моего изучения усадеб Хойникского района.',
        ),
      ).toBe('Сенека Третья и заключительная часть моего изучения усадеб Хойникского района.');
    });

    it.each([
      [
        'топоним из двух слов',
        '«Заброшен храм, пустует чинно. Трава, побеги, деревца - Как будто ловят на живца Гиганта старого.» Старый Свержень Николаевская церковь стоит на берегу Немана с 1590 года.',
        'Старый Свержень Николаевская церковь стоит на берегу Немана с 1590 года.',
      ],
      [
        'нарицательное начало',
        '«Заброшен храм, пустует чинно. Трава, побеги, деревца - Как будто ловят на живца Гиганта старого.» Усадьба Павлиново стоит в стороне от дороги и почти не видна с трассы.',
        'Усадьба Павлиново стоит в стороне от дороги и почти не видна с трассы.',
      ],
    ])('drops the epigraph but keeps the first words of the body (%s)', (_name, lead, expected) => {
      expect(normalizeSeoLead(lead)).toBe(expected);
    });

    it('keeps a quoted object name of several words', () => {
      // Кавычки держат название, а не высказывание: точкой такая фраза не кончается
      // и подписи автора за ней нет. Порог по числу слов тут не спасает — их четыре.
      const lead =
        '«Спасо-Преображенская церковь в Заславле» Заславский Спасо-Преображенский храм построен в XVI веке и стоит до сих пор.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('drops the coordinate block written in degrees, not only in decimals', () => {
      // 52°07′44.8″ — та же служебная шапка, что и 52.128, но правило требовало
      // десятичную дробь и формат градус-минута-секунда не описывало вовсе.
      expect(
        normalizeSeoLead(
          'Координаты gps: 52°07′44.8″ 25°00′9.5″ Расстояние от Бреста: 104 км. Расстояние от Минска: 313 км. Часовня-усыпальница в Закозели построена в стиле неоготики.',
        ),
      ).toBe('Часовня-усыпальница в Закозели построена в стиле неоготики.');
    });

    it.each([
      ['полушарие из Google Maps', 'Координаты gps: 52°07\'44.8"N 25°00\'09.5"E'],
      ['типографские штрихи', 'Координаты gps: 52°07’44.8” 25°00’9.5”'],
      ['полушарие у десятичной пары', 'Координаты gps: 52.1288N, 25.0026E'],
    ])('does not cut inside a coordinate it recognised only halfway (%s)', (_name, header) => {
      // Форм записи градусов больше, чем описано в правиле. Узнав шапку
      // наполовину, срез оборвался бы внутри координаты и открыл сниппет
      // обрубком «N 25°00'09.5"E…» — хуже неснятой шапки. Не узнали целиком —
      // не режем вовсе.
      const lead = `${header} Расстояние от Бреста: 104 км. Часовня-усыпальница в Закозели построена в стиле неоготики.`;
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it.each([
      // Полушарие латиницей — так шапку копирует Google Maps.
      'Координаты gps: 52°07\'44.8"N 25°00\'09.5"E Часовня-усыпальница в Закозели построена в стиле неоготики.',
      // Полушарие русским сокращением.
      'Координаты: 52° с.ш. 25° в.д. Часовня-усыпальница в Закозели построена в стиле неоготики и стоит до сих пор.',
      // Десятичная дробь с полушарием вплотную.
      'Координаты gps: 52.1288N, 25.0026E Часовня-усыпальница в Закозели построена в стиле неоготики.',
    ])('keeps a coordinate header whose form is only half recognised', (lead) => {
      // Узнав шапку наполовину, срез обрывался ВНУТРИ координаты и открывал
      // сниппет обрубком «N 25°00'09.5"E…» — это хуже неснятой шапки.
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('does not read a plain integer as a coordinate', () => {
      // Координатой считается только дробь или градусы: иначе срез съел бы
      // «100 метров» и вместе с ним начало осмысленной фразы.
      const lead = 'Широта 100 метров над Неманом открывает вид на всю пойму и замковую гору в Гродно.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('drops a long epigraph even without an attribution', () => {
      expect(
        normalizeSeoLead(
          '«Заброшен храм, пустует чинно. Трава, побеги, деревца - Как будто ловят на живца Гиганта старого.» Церковь в Старой Водве стоит без крыши уже полвека.',
        ),
      ).toBe('Церковь в Старой Водве стоит без крыши уже полвека.');
    });

    it('drops the authors greeting and their self-introduction', () => {
      expect(
        normalizeSeoLead(
          'Привет! Мы — Юля и Сергей из metravel.by. Живя на юге Польши, мы исходили окрестные горы вдоль и поперёк — от лёгких прогулок до зимних трекингов.',
        ),
      ).toBe('Живя на юге Польши, мы исходили окрестные горы вдоль и поперёк — от лёгких прогулок до зимних трекингов.');
    });

    it('drops the greeting when the word is on either side of it', () => {
      // Квантор «всем» стоял только слева, и «Привет всем!» правило не узнавало.
      expect(
        normalizeSeoLead('Привет всем! Хочу рассказать о волшебном месте — Голубой Кринице под Славгородом.'),
      ).toBe('Хочу рассказать о волшебном месте — Голубой Кринице под Славгородом.');
      expect(
        normalizeSeoLead('Всем привет! Хочу рассказать о волшебном месте — Голубой Кринице под Славгородом.'),
      ).toBe('Хочу рассказать о волшебном месте — Голубой Кринице под Славгородом.');
    });

    it('keeps quotes that hold the name of the place, not a quotation', () => {
      // Признак не в кавычках, а в том, что фраза продолжается с маленькой буквы.
      const lead =
        '«Родники Святые Криницы» — гидрологический памятник природы республиканского значения в Минском районе, около 37 км от Минска.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('keeps a quoted name that the next two capitalized words continue', () => {
      // «Замок Мир» после кавычек по форме не отличается от подписи автора, поэтому
      // правило подписи срезало бы имя объекта. Цитата — это фраза, название — одно-три слова.
      const named = '«Мир» Замок Мир — резиденция Радзивиллов и объект Всемирного наследия ЮНЕСКО.';
      expect(normalizeSeoLead(named)).toBe(named);

      const museum = '«Дудутки» Музей Дудутки расположен в 40 км от Минска и работает круглый год.';
      expect(normalizeSeoLead(museum)).toBe(museum);
    });

    it('keeps a quoted name that the following words repeat', () => {
      // Другая форма того же: «Хатынь» Мемориал Хатынь… Подпись автора слов цитаты
      // не повторяет, а продолжение текста повторяет имя объекта — по этому и отличаем.
      const memorial = '«Хатынь» Мемориал Хатынь находится в 60 км от Минска и напоминает о сожжённых деревнях.';
      expect(normalizeSeoLead(memorial)).toBe(memorial);
    });

    it('drops a three-word epigraph when the attribution is a real name', () => {
      // Порог по числу слов нельзя поднимать до четырёх: «Архитектура — выразительница
      // нравов.» — настоящий эпиграф из трёх слов с подписью Оноре де Бальзака.
      expect(
        normalizeSeoLead(
          '«Архитектура — выразительница нравов.» Оноре де Бальзак ⠀ ⠀...— А у нас точно больше времени не остаётся? - Я посмотрел на часы.',
        ),
      ).toBe('А у нас точно больше времени не остаётся? - Я посмотрел на часы.');
    });

    it('finds the closing quote past a nested one of the same pair', () => {
      // Первая » здесь закрывает вложенное слово, а не эпиграф: срез по ней
      // отдавал в сниппет вторую половину цитаты вместе с подписью автора.
      expect(
        normalizeSeoLead(
          '«Духовная жизнь начинается обычно, когда положение кажется «безвыходным», тогда человек научается обращаться к Богу, а не уповать на собственные силы.» Иеромонах Серафим ⠀ ⠀Продолжая тему костёлов Гродненщины, заглянем в Слоним.',
        ),
      ).toBe('Продолжая тему костёлов Гродненщины, заглянем в Слоним.');
    });

    it('finds the epigraph boundary when the outer quote is never closed', () => {
      // Внешнюю кавычку автор не закрыл: «…Табе пачуецца: «Спыніся!…стаіш!» —
      // баланс до нуля не сходится, и правило отдавало эпиграф в сниппет целиком.
      expect(
        normalizeSeoLead(
          "«Калі ў надвячэрняй высі Над Сар'яю павісне ціш, Табе пачуецца: «Спыніся! Глянь, на якой зямлі стаіш!» Антон Буболо ⠀ Скажите, у вас бывало такое, что очень хочешь посетить какое-то место?",
        ),
      ).toBe('Скажите, у вас бывало такое, что очень хочешь посетить какое-то место?');
    });

    it('keeps an unclosed quote that the phrase continues after', () => {
      // Баланс не сошёлся и здесь, но после первой закрывающей идёт запятая:
      // кавычки держали часть фразы, а не эпиграф. Откат на границу не даёт срез.
      const lead =
        '«Тихая охота, как её называют «в народе», начинается в Налибокской пуще уже в июле и тянется до заморозков.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('keeps a quote that the phrase continues after', () => {
      // После закрывающей кавычки идёт запятая или строчная буква — значит
      // кавычки держали часть фразы, а не отдельный эпиграф.
      const lead =
        '«Тихая охота», как называют сбор грибов, начинается в Налибокской пуще уже в июле и тянется до заморозков.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('treats an intra-word invisible as part of the word, not a boundary', () => {
      // Мягкий перенос стоит ВНУТРИ слова: приняв его за границу абзаца, срез
      // оставлял в сниппете обрубок «рый Свержень».
      expect(
        normalizeSeoLead(
          '«Судьба ничего не дает в вечную собственность.» Ста­рый Свержень Николаевская церковь стоит на берегу Немана.',
        ),
      ).toBe('Старый Свержень Николаевская церковь стоит на берегу Немана.');
    });

    it('keeps a self-introduction that is not preceded by a greeting', () => {
      // «Мы — семья из Минска…» без «Привет!» — это уже содержательная фраза.
      const lead = 'Мы — семья из Минска, и вот наш маршрут по Полесью на три дня. Ехать лучше на своей машине.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('does not eat the whole lead when the preamble is all there is', () => {
      expect(normalizeSeoLead('«Жизнь скоротечна - наследие вечно» Пётр Квятковский')).toBe(
        '«Жизнь скоротечна - наследие вечно» Пётр Квятковский',
      );
      expect(normalizeSeoLead('Координаты GPS: 53.224367, 26.689889 Расстояние от Минска 120 км.')).toBe(
        'Координаты GPS: 53.224367, 26.689889 Расстояние от Минска 120 км.',
      );
      // Порог считается по видимой длине: распорки символы бюджета тратят, но
      // сниппет из них не состоит, иначе «Коротко конец.» прошло бы за 40 символов.
      const padded = `«Жизнь скоротечна - наследие вечно» Пётр Квятковский ⠀ ⠀Коротко ${'⠀'.repeat(30)} конец.`;
      expect(normalizeSeoLead(padded)).toBe(
        '«Жизнь скоротечна - наследие вечно» Пётр Квятковский Коротко конец.',
      );
    });

    it('keeps a greeting that opens a meaningful sentence', () => {
      const lead = 'Привет из Гродно! Сегодня расскажу про форты Первой мировой войны и как до них добраться.';
      expect(normalizeSeoLead(lead)).toBe(lead);
    });

    it('removes invisible spacers left inside the text', () => {
      expect(normalizeSeoLead('Форты Гродно ⠀ ⠀строились с 1912 года и до сих пор стоят в лесу.')).toBe(
        'Форты Гродно строились с 1912 года и до сих пор стоят в лесу.',
      );
    });

    it('stays linear on a long run of spacers', () => {
      // Распорки становятся пробелами, а `\s+([,.;:!?])` по длинному прогону
      // пробелов квадратичен: 50k распорок стоили 4,4 с на один вызов.
      const padded = `Форты Гродно ${'⠀'.repeat(50000)} строились с 1912 года и стоят в лесу.`;
      const startedAt = Date.now();
      expect(normalizeSeoLead(padded)).toBe('Форты Гродно строились с 1912 года и стоят в лесу.');
      expect(Date.now() - startedAt).toBeLessThan(2000);
    });

    it('stays linear on a long run of spaces after the coordinate keyword', () => {
      // Разбор `\s*:?\s*` делит прогон между двумя `\s*` всеми способами сразу и
      // на СЫРОМ прогоне пробелов квадратичен (50k стоят 5 с). Держит его порядок
      // шагов: `\s+` схлопывается в один пробел ДО разбора преамбулы. Тест
      // сторожит именно порядок — перенеси схлопывание ниже, и вызов встанет.
      // Двоеточия после ключевого слова тут нет намеренно: с ним развилки нет.
      const padded = `Координаты${' '.repeat(50000)}Часовня-усыпальница в Закозели построена в стиле неоготики.`;
      const startedAt = Date.now();
      expect(normalizeSeoLead(padded)).toBe(
        'Координаты Часовня-усыпальница в Закозели построена в стиле неоготики.',
      );
      expect(Date.now() - startedAt).toBeLessThan(2000);
    });

    it('returns an empty string for empty input', () => {
      expect(normalizeSeoLead('')).toBe('');
      expect(normalizeSeoLead(null)).toBe('');
    });
  });
});
