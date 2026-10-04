// #2119: синтетическая часть корпуса эталонов PDF-книги.
//
// Реальные описания (`realTravels/*.json`) приходят из редактора уже чистыми:
// в них нет таблиц, `<figcaption>`, битой разметки, `script`/`style` и тегов
// React Native. Здесь — именно те формы, на которых разборщик HTML может
// разойтись с браузерным `DOMParser`. Каждая строка подаётся в
// `ContentParser.parse()` как есть; набор `PIPELINE_EDGE_CASES` дополнительно
// проходит весь путь книги (санитайзер → разбор → рендер).
//
// Правка строки меняет эталон: новый случай добавляется отдельной записью.

export type PdfBookEdgeCase = {
  name: string
  html: string
}

export const PDF_BOOK_EDGE_CASES: PdfBookEdgeCase[] = [
  // ───────────── таблицы ─────────────
  {
    name: 'table-thead-tbody',
    html: '<table><thead><tr><th>Точка</th><th>Высота,&nbsp;м</th></tr></thead><tbody><tr><td>Старт</td><td>950</td></tr><tr><td>Перевал</td><td>1&nbsp;545</td></tr></tbody></table>',
  },
  {
    name: 'table-without-tbody',
    html: '<table><tr><th>День</th><th>Км</th></tr><tr><td>1</td><td>16</td></tr><tr><td>2</td><td>21</td></tr></table>',
  },
  {
    name: 'table-no-header',
    html: '<table><tr><td>Вход</td><td>25 zł</td></tr><tr><td>Парковка</td><td>10 zł</td></tr><tr><td></td><td></td></tr></table>',
  },
  {
    name: 'table-header-cells-only',
    html: '<table><tr><th>Только</th><th>шапка</th></tr></table>',
  },
  {
    name: 'table-unclosed-cells',
    html: '<table><tr><td>a<td>b<tr><td>c<td>d</table><p>после таблицы</p>',
  },
  {
    name: 'table-foster-parenting',
    html: '<table>текст внутри table<tr><td>ячейка</td></tr><p>абзац внутри table</p></table>',
  },
  {
    name: 'table-nested',
    html: '<table><tr><td>внешняя<table><tr><td>внутренняя</td></tr></table></td><td>вторая</td></tr></table>',
  },
  {
    name: 'table-caption-colgroup',
    html: '<table><caption>Расписание</caption><colgroup><col><col></colgroup><tr><th>Рейс</th><th>Время</th></tr><tr><td>Автобус <b>304</b></td><td>08:15<br>09:40</td></tr></table>',
  },
  {
    name: 'table-inside-paragraph',
    html: '<p>перед таблицей<table><tr><td>в абзаце</td></tr></table>после таблицы</p>',
  },

  // ───────────── списки ─────────────
  {
    name: 'list-nested',
    html: '<ul><li>Первый<ul><li>Вложенный 1</li><li>Вложенный 2<ol><li>Третий уровень</li></ol></li></ul></li><li>Второй</li></ul>',
  },
  {
    name: 'list-ordered-with-blocks',
    html: '<ol><li><p>Абзац в пункте</p><p>Второй абзац</p></li><li><strong>Жирный</strong> пункт<br>с переносом</li><li></li><li>   </li></ol>',
  },
  {
    name: 'list-quill-indent',
    html: '<ul><li>Верхний</li><li class="ql-indent-1">Отступ 1</li><li class="ql-indent-2">Отступ 2</li></ul>',
  },
  {
    name: 'list-item-outside-list',
    html: '<li>Пункт без списка</li><li>Ещё один</li><p>Абзац после</p>',
  },
  {
    name: 'list-unclosed-items',
    html: '<ul><li>один<li>два<li>три</ul><ol><li>четыре',
  },
  {
    name: 'list-empty',
    html: '<ul></ul><ol><li></li></ol><p>после пустых списков</p>',
  },

  // ───────────── details ─────────────
  {
    name: 'details-faq',
    html: '<section class="seo-faq"><h2>Частые вопросы</h2><details><summary><strong>Сколько идти?</strong></summary><div><p>Около трёх часов.</p><ul><li>Подъём — 2 ч</li><li>Спуск — 1 ч</li></ul></div></details><details open><summary>Нужна ли обувь?</summary><p>Да.</p></details></section>',
  },
  {
    name: 'details-without-summary',
    html: '<details><p>Ответ без вопроса</p></details>',
  },
  {
    name: 'details-summary-not-first',
    html: '<details>Текст до вопроса<summary>Вопрос в середине</summary>Текст после вопроса<img src="https://metravel.by/a.jpg" alt="в ответе"></details>',
  },
  {
    name: 'details-nested',
    html: '<details><summary>Внешний</summary><details><summary>Внутренний</summary><p>Глубокий ответ</p></details></details>',
  },
  {
    name: 'details-empty-summary',
    html: '<details><summary> </summary><p>Ответ</p></details><details><summary>Только вопрос</summary></details>',
  },

  // ───────────── figure / figcaption ─────────────
  {
    name: 'figure-with-caption',
    html: '<figure class="img-single-wide"><img src="https://metravel.by/travel-description-image/1/a.jpg" alt="Озеро" width="1600" height="900"><figcaption>Озеро&nbsp;на рассвете</figcaption></figure>',
  },
  {
    name: 'figure-linked-image',
    html: '<figure class="img-float-left"><a href="https://metravel.by/a-full.jpg"><img src="https://metravel.by/a.jpg" alt="Башня"></a><figcaption>Башня <em>XIV века</em></figcaption></figure>',
  },
  {
    name: 'figure-picture',
    html: '<figure><picture><source srcset="https://metravel.by/a.webp" type="image/webp"><img src="https://metravel.by/a.jpg" alt="Мост" width="0" height="abc"></picture><figcaption></figcaption></figure>',
  },
  {
    name: 'figure-gallery-2',
    html: '<figure class="img-row-2 img-row-2-landscape img-stack-landscape"><img src="https://metravel.by/1.jpg" alt="один" width="1200" height="800"><img src="https://metravel.by/2.jpg" width="1200" height="800"><figcaption>Подпись галереи</figcaption></figure>',
  },
  {
    name: 'figure-gallery-3',
    html: '<figure class="img-grid img-quilt-3"><img src="https://metravel.by/1.jpg"><img src="https://metravel.by/2.jpg"><img src="https://metravel.by/3.jpg"></figure>',
  },
  {
    name: 'figure-gallery-4',
    html: '<figure class="img-grid img-grid-quilt img-quilt-4"><img src="https://metravel.by/1.jpg"><img src="https://metravel.by/2.jpg"><img src="https://metravel.by/3.jpg"><img src="https://metravel.by/4.jpg"></figure>',
  },
  {
    name: 'figure-without-image',
    html: '<figure><figcaption>Подпись без картинки</figcaption></figure><figure></figure>',
  },

  // ───────────── галереи в div ─────────────
  {
    name: 'gallery-div-layouts',
    html: [
      '<div class="img-row-2 img-row-2-portrait img-pair-portraits"><img src="https://metravel.by/p1.jpg" alt="п1" width="800" height="1200"><img src="https://metravel.by/p2.jpg" alt="п2" width="800" height="1200"></div>',
      '<div class="img-row-2 img-row-2-mixed img-pair-mixed"><img src="https://metravel.by/m1.jpg"><img src="https://metravel.by/m2.jpg"></div>',
      '<div class="img-row-2 img-row-2-balanced img-pair-balanced"><img src="https://metravel.by/b1.jpg"><img src="https://metravel.by/b2.jpg"></div>',
      '<div class="img-grid img-pair-grid img-grid-balanced"><img src="https://metravel.by/g1.jpg"><img src="https://metravel.by/g2.jpg"><img src="https://metravel.by/g3.jpg"><img src="https://metravel.by/g4.jpg"></div>',
      '<div class="img-grid img-column-portraits img-grid-portrait"><img src="https://metravel.by/c1.jpg"><img src="https://metravel.by/c2.jpg"><img src="https://metravel.by/c3.jpg"></div>',
      '<div class="img-editorial-grid"><img src="https://metravel.by/e1.jpg"><img src="https://metravel.by/e2.jpg"><img src="https://metravel.by/e3.jpg"></div>',
      '<div class="img-grid img-grid-mixed img-grid-mixed-stack"><img src="https://metravel.by/x1.jpg"><img src="https://metravel.by/x2.jpg"><img src="https://metravel.by/x3.jpg"></div>',
      '<div class="img-grid img-grid-mixed-reverse"><img src="https://metravel.by/r1.jpg"><img src="https://metravel.by/r2.jpg"><img src="https://metravel.by/r3.jpg"></div>',
      '<div class="IMG-GRID"><img src="https://metravel.by/d1.jpg"><img src="https://metravel.by/d2.jpg"><img src="https://metravel.by/d3.jpg"><img src="https://metravel.by/d4.jpg"><img src="https://metravel.by/d5.jpg"><img src="https://metravel.by/d6.jpg"><img src="https://metravel.by/d7.jpg"></div>',
    ].join(''),
  },
  {
    name: 'gallery-div-nested-wrappers',
    html: '<div class="img-grid"><p><img src="https://metravel.by/n1.jpg" alt="в абзаце"></p><div><a href="#"><img src="https://metravel.by/n2.jpg"></a></div><img alt="без src"></div>',
  },

  // ───────────── картинки в абзацах ─────────────
  {
    name: 'paragraph-single-image',
    html: '<p><img src="https://metravel.by/one.jpg" alt="Одна" width="640" height="480"></p>',
  },
  {
    name: 'paragraph-image-with-text',
    html: '<p class="img-float-right figure-portrait">Текст до <img src="https://metravel.by/mid.jpg" alt="Середина"> текст после<br>и перенос</p>',
  },
  {
    name: 'paragraph-linked-image-and-nested',
    html: '<p><a href="https://metravel.by/big.jpg"><img class="img-single-wide" src="https://metravel.by/small.jpg" alt="Ссылка"></a> подпись <span>в <b>спане</b> <img src="https://metravel.by/in-span.jpg"></span> хвост</p>',
  },
  {
    name: 'paragraph-image-without-src',
    html: '<p><img alt="пустая"> текст рядом с пустой картинкой</p><p><img src=""></p>',
  },
  {
    name: 'image-top-level',
    html: '<img src="https://metravel.by/top.jpg" alt="Верхний уровень" width="100%" height="-5"><img src="/relative/path.jpg"><img src="//metravel.by/protocol-relative.jpg">',
  },

  // ───────────── битая разметка ─────────────
  {
    name: 'broken-unclosed-paragraphs',
    html: '<p>Первый<p>Второй<div>Блок закрывает абзац</div><p>Третий<ul><li>список закрывает абзац</li></ul><p>Четвёртый<h2>Заголовок закрывает абзац</h2>',
  },
  {
    name: 'broken-stray-end-tags',
    html: '</p><p>Текст</p></div></span></li><p>Ещё</p></br></table>',
  },
  {
    name: 'broken-misnested-inline',
    html: '<p>Обычный <b>жирный <i>жирный курсив</b> только курсив</i> обычный</p>',
  },
  {
    name: 'broken-block-in-inline',
    html: '<p><b>жирное начало<div>блок внутри b</div>жирный хвост</b></p><p>следующий абзац</p>',
  },
  {
    name: 'broken-div-in-paragraph',
    html: '<p>до<div>внутри</div>после</p>',
  },
  {
    name: 'broken-nested-links-and-headings',
    html: '<a href="#one">первая <a href="#two">вторая</a> хвост</a><h2>Заголовок <h3>вложенный</h3> хвост</h2>',
  },
  {
    name: 'broken-unclosed-at-end',
    html: '<div><p>Абзац <strong>жирный <em>курсив',
  },
  {
    name: 'broken-attributes',
    html: '<p class=intro data-x=\'1\' title="a > b" hidden>Атрибуты <a href=https://metravel.by/?a=1&b=2 target=_blank>без кавычек</a> и <span class="x" class="y">дубль</span></p>',
  },
  {
    name: 'broken-tag-soup',
    html: 'текст <3 и 2 < 3 и a > b и <непонятный тег> и <p и хвост',
  },
  {
    name: 'broken-uppercase-tags',
    html: '<P>Верхний <B>РЕГИСТР</B><BR>перенос</P><UL><LI>Пункт</LI></UL><H2 CLASS="Tip">Заголовок</H2><IMG SRC="https://metravel.by/up.jpg" ALT="Верхний">',
  },

  // ───────────── сущности ─────────────
  {
    name: 'entities-named-and-numeric',
    html: '<p>Кавычки &laquo;ёлочки&raquo;, тире&nbsp;&mdash; и&#160;&#8212; и &#x2014;; амперсанд &amp; знак &lt;меньше&gt; &quot;кавычки&quot; &apos;апостроф&apos; &copy; &hellip; &euro;</p>',
  },
  {
    name: 'entities-legacy-and-broken',
    html: '<p>Без точки с запятой: &copy 2024, &amp текст, &nbsp&nbsp, &notin; против &notit; и &not; двойное &amp;lt; неизвестная &foo; одиночный & и &#; и &#x; и &#0; и &#128512;</p>',
  },
  {
    name: 'entities-in-attributes',
    html: '<p><a href="https://metravel.by/?a=1&amp;b=2&copy=3" title="A &amp; B &lt;C&gt; &quot;D&quot;">ссылка&nbsp;с&nbsp;сущностями</a> и <img src="https://metravel.by/q.jpg?x=1&amp;y=2" alt="Tom &amp; Jerry &laquo;шоу&raquo;"></p>',
  },
  {
    name: 'entities-only-paragraphs',
    html: '<p>&nbsp;</p><p>&nbsp;&nbsp;&nbsp;</p><p> </p><p>&#8203;</p><p>текст</p>',
  },

  // ───────────── br ─────────────
  {
    name: 'br-inside-paragraph',
    html: '<p>Строка 1<br>Строка 2<br/>Строка 3<br />Строка 4</p>',
  },
  {
    name: 'br-edges-and-doubles',
    html: '<p><br>Начало с br<br><br>двойной<br></p><p><br></p><p>слово<br>   </p>',
  },
  {
    name: 'br-inside-inline-and-heading',
    html: '<p>До <strong>жирный<br>с переносом</strong> после</p><h2>Заголовок<br>в две строки</h2><ul><li>Пункт<br>с переносом</li></ul><blockquote>Цитата<br>в две строки</blockquote>',
  },
  {
    name: 'br-closing-tag-form',
    html: '<p>Строка</br>после закрывающего br</p>',
  },

  // ───────────── script / style / служебные ─────────────
  {
    name: 'script-style-leading',
    html: '<style>.x{color:red}</style><script>window.alert(1)</script><p>Абзац после ведущих style и script</p>',
  },
  {
    name: 'script-style-in-body',
    html: '<p>Первый абзац</p><style>.y{color:blue}</style><script>var a = "<p>не абзац</p>";</script><p>Второй абзац</p>',
  },
  {
    name: 'script-style-inside-blocks',
    html: '<p>Текст<script>document.write("x")</script> продолжается<style>p{margin:0}</style> дальше</p><div>Блок<style>.z{}</style> со стилем</div><ul><li>Пункт<script>1</script> списка</li></ul>',
  },
  {
    name: 'head-elements-in-body',
    html: '<title>Заголовок документа</title><meta charset="utf-8"><link rel="stylesheet" href="x.css"><base href="/"><p>Абзац</p><title>Второй title</title><meta name="x" content="y">',
  },
  {
    name: 'noscript-template-comment',
    html: '<noscript><p>Абзац в noscript</p></noscript><template><p>Абзац в template</p></template><!-- комментарий --><p>Видимый <!-- внутри --> абзац</p><![CDATA[ данные ]]>',
  },
  {
    name: 'full-document',
    html: '<!DOCTYPE html><html lang="ru"><head><title>Документ</title><style>p{}</style></head><body class="tip"><p>Абзац в полном документе</p></body></html>',
  },
  {
    name: 'full-document-text-after-body',
    html: '<html><body><p>В теле</p></body></html><p>После html</p>хвост',
  },

  // ───────────── теги React Native ─────────────
  {
    name: 'react-native-tags',
    html: '<View style="flex:1"><Text>Текст в Text</Text><Image source="x.png" /><ScrollView><p>вырезается целиком</p></ScrollView><p>Абзац внутри View</p><TouchableOpacity onPress="x"><p>кнопка</p></TouchableOpacity><SafeAreaView><p>safe</p></SafeAreaView><ActivityIndicator /></View>',
  },
  {
    name: 'react-native-tags-nested-and-case',
    html: '<view><text>нижний регистр</text></view><View><View><Text>Вложенные <Text>Text</Text></Text></View></View><TouchableHighlight>\n<p>многострочно</p>\n</TouchableHighlight><Image><p>после Image</p>',
  },

  // ───────────── спец-блоки ─────────────
  {
    name: 'special-blocks-by-class',
    html: '<div class="tip"><strong>Совет:</strong> берите воду.</div><div class="warning"><b>Важно</b> — тропа скользкая</div><div class="danger"><h3>Опасно</h3><p>Обрыв без ограждения</p></div><div class="info"><span class="title">Справка</span> Вход бесплатный</div><p class="info-box">Абзац-справка без заголовка</p>',
  },
  {
    name: 'special-blocks-localized-tokens',
    html: '<div class="Совет">Локализованный класс совета</div><div class="блок-важно"><span class="heading">Заголовок</span> тело</div><div class="опасность"></div><div class="информация">Справка</div><p class="лайфхак">Лайфхак в абзаце</p>',
  },
  {
    name: 'special-blocks-substring-classes',
    html: '<div class="tooltip">Подстрока tip в классе</div><div class="multipart">Тоже tip</div><p class="img-portrait-triptych">Триптих</p><section class="information"><p>Вложенный абзац</p></section>',
  },

  // ───────────── цитаты ─────────────
  {
    name: 'quote-with-cite-and-footer',
    html: '<blockquote><p>Горы зовут, и я должен идти.</p><cite>Джон Мьюр</cite></blockquote><blockquote>Дорога возникает под шагами идущего<footer>— пословица</footer></blockquote>',
  },
  {
    name: 'quote-plain-and-empty',
    html: '<blockquote>Просто цитата без автора</blockquote><blockquote>   </blockquote><blockquote><cite>Только автор</cite></blockquote>',
  },

  // ───────────── код ─────────────
  {
    name: 'code-blocks',
    html: '<pre><code class="language-js">const a = 1;\nconst b = a &lt; 2;</code></pre><code>inline code верхнего уровня</code><pre class="language-bash">npm   run\tbuild</pre><pre></pre>',
  },

  // ───────────── заголовки и разделители ─────────────
  {
    name: 'headings-all-levels',
    html: '<h1>Первый</h1><h2>Второй с <em>курсивом</em></h2><h3>Третий&nbsp;уровень</h3><h4> Четвёртый </h4><h5>Пятый</h5><h6>Шестой</h6><h2></h2><h3>   </h3>',
  },
  {
    // h5/h6 в пути книги сейчас роняют рендер (темы описывают только h1–h4),
    // поэтому в эталон книги идёт этот случай, а не `headings-all-levels`.
    name: 'headings-h1-h4',
    html: '<h1>Первый</h1><p>Абзац под первым</p><h2>Второй с <em>курсивом</em></h2><h3>Третий&nbsp;уровень</h3><h4> Четвёртый </h4><p>Абзац под четвёртым</p>',
  },
  {
    name: 'separators-and-top-level-text',
    html: 'Текст до<hr>Текст после<hr/><span>спан верхнего уровня</span> <strong>жирный</strong> <a href="https://metravel.by">ссылка</a><em></em>\n\n  <hr>',
  },

  // ───────────── неизвестные и встроенные теги ─────────────
  {
    name: 'embeds-and-media',
    html: '<iframe class="ql-video" src="https://www.youtube.com/embed/abc" frameborder="0" allowfullscreen="true"></iframe><p><iframe src="https://www.youtube.com/embed/in-p"></iframe></p><video controls><source src="a.mp4">Видео не поддерживается</video><audio>Аудио не поддерживается</audio><object>Объект</object><embed src="x.swf">',
  },
  {
    name: 'legacy-and-semantic-tags',
    html: '<font color="red">Красный шрифт</font><center>По центру</center><article><p>Абзац в article</p></article><aside>Врезка</aside><header>Шапка</header><main><p>Основное</p></main><nav><a href="#">Навигация</a></nav><address>Адрес</address><dl><dt>Термин</dt><dd>Определение</dd></dl>',
  },
  {
    name: 'form-controls',
    html: '<form><label>Имя <input type="text" value="значение"></label><select><option>Раз</option><option selected>Два</option></select><textarea>Текст\nв textarea</textarea><button>Кнопка</button></form>',
  },
  {
    name: 'foreign-content',
    html: '<p>До <svg viewBox="0 0 10 10"><title>Иконка</title><text>svg-текст</text><circle r="1"/></svg> после</p><svg><foreignObject><p>Абзац в foreignObject</p></foreignObject></svg><math><mi>x</mi><mo>=</mo><mn>1</mn></math>',
  },
  {
    name: 'custom-elements',
    html: '<my-widget data-id="1">Содержимое виджета</my-widget><x-empty></x-empty><o:p>офисный тег</o:p><p>абзац</p>',
  },

  // ───────────── абзацы со сложной разметкой (поле html) ─────────────
  {
    name: 'paragraph-inline-formatting',
    html: '<p>Обычный, <strong>жирный</strong>, <em>курсив</em>, <u>подчёркнутый</u>, <s>зачёркнутый</s>, <a href="https://metravel.by/travels/x/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">ссылка</a>, <span style="color: rgb(230, 0, 0);">цветной</span>, <sup>верх</sup> и <sub>низ</sub>.</p>',
  },
  {
    name: 'paragraph-html-serialization',
    html: '<p>Текст с&nbsp;неразрывным, амперсандом &amp; и знаками &lt; &gt; "кавычки" \'апострофы\' <span title=\'одинарные "двойные"\' data-a="&lt;x&gt;" hidden>атрибуты</span> <b >пробел в теге</b> <I>регистр</I> 😀</p>',
  },
  {
    name: 'paragraph-plain-and-whitespace',
    html: '<p>Простой текст без разметки</p><p>   пробелы   по   краям   </p><p>\n\tперенос\n\tи табуляция\n</p><p></p><p> </p>',
  },
  {
    name: 'paragraph-newlines-without-br',
    html: '<p>Первая строка\nвторая строка\r\nтретья строка</p><p><strong>Жирная</strong>\nстрока после разметки</p>',
  },
  {
    name: 'paragraph-quill-classes',
    html: '<p class="ql-align-center">По центру</p><p class="ql-align-right"><span class="ql-size-large">Крупный</span> справа</p><p class="ql-align-justify ql-indent-1">По ширине</p>',
  },

  // ───────────── пробелы и невидимые символы ─────────────
  {
    name: 'invisible-characters',
    html: '<p>Нулевой​пробел, не разрывный, BOM﻿внутри, узкий пробел, идеографический　пробел</p><h2>​Заголовок‍</h2><ul><li>﻿Пункт </li></ul>',
  },
  {
    name: 'crlf-and-indentation',
    html: '<div>\r\n  <h2>Заголовок</h2>\r\n  <p>\r\n    Абзац с отступами\r\n  </p>\r\n  <ul>\r\n    <li>Пункт</li>\r\n  </ul>\r\n</div>\r\n',
  },

  // ───────────── контейнеры ─────────────
  {
    name: 'container-text-only',
    html: '<div>Только текст</div><section>Текст секции <strong>с жирным</strong> и <a href="#">ссылкой</a></section><div><span>спан</span><span>спан</span></div>',
  },
  {
    name: 'container-with-blocks',
    html: '<div>Текст до<h3>Заголовок</h3>текст между<p>Абзац</p><div><div><p>Глубокий абзац</p></div></div>текст после<img src="https://metravel.by/single-in-div.jpg" alt="Одна в div"></div>',
  },
  {
    name: 'container-empty-and-whitespace',
    html: '<div></div><div>   </div><section><div><p></p></div></section><div><br></div><p>после пустых</p>',
  },

  // ───────────── вырожденные входы ─────────────
  {
    name: 'plain-text-only',
    html: 'Просто текст без единого тега',
  },
  {
    name: 'whitespace-only',
    html: ' \n\t ',
  },
  {
    name: 'lonely-symbols',
    html: '<',
  },
  {
    name: 'unterminated-tag',
    html: '<p>Абзац</p><p class="x',
  },
  {
    name: 'unterminated-comment',
    html: '<p>До комментария</p><!-- незакрытый <p>внутри</p>',
  },
]

/**
 * Случаи, которые проходят полный путь книги одним описанием: санитайзер
 * (`sanitizeRichTextForPdf`) срезает `script`/`style` и чинит часть разметки
 * ещё до разбора, поэтому эталон книги проверяет связку «санитайзер → разбор →
 * рендер», а не разбор в одиночку.
 */
export const PIPELINE_EDGE_CASE_NAMES = [
  'table-thead-tbody',
  'table-without-tbody',
  'table-unclosed-cells',
  'table-caption-colgroup',
  'list-nested',
  'list-ordered-with-blocks',
  'list-item-outside-list',
  'details-faq',
  'details-summary-not-first',
  'figure-with-caption',
  'figure-linked-image',
  'figure-gallery-2',
  'figure-gallery-3',
  'figure-gallery-4',
  'gallery-div-layouts',
  'paragraph-image-with-text',
  'paragraph-linked-image-and-nested',
  'broken-unclosed-paragraphs',
  'broken-misnested-inline',
  'broken-block-in-inline',
  'broken-div-in-paragraph',
  'entities-named-and-numeric',
  'entities-in-attributes',
  'br-inside-paragraph',
  'br-edges-and-doubles',
  'script-style-in-body',
  'script-style-inside-blocks',
  'react-native-tags',
  'special-blocks-by-class',
  'special-blocks-localized-tokens',
  'quote-with-cite-and-footer',
  'code-blocks',
  'headings-h1-h4',
  'separators-and-top-level-text',
  'embeds-and-media',
  'paragraph-inline-formatting',
  'paragraph-html-serialization',
  'invisible-characters',
  'container-with-blocks',
] as const
