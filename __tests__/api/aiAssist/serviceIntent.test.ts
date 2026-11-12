import { parseConditions } from '@/api/aiAssist/questionConditions'
import { asksAboutService } from '@/api/aiAssist/serviceIntent'
import { classifyQuestion, isOnSiteTopic, judgeModelReply } from '@/api/aiAssist/topicGate'

// #3293: вопрос о самом сайте — намерение «о сервисе». Отвечает справка, а не статьи и квесты; фильтр тем
// такой вопрос считает вопросом по теме на пяти языках.
const ABOUT_SITE: Array<[string, string]> = [
  ['ru', 'Сколько стоит пройти квест?'],
  ['ru', 'Квесты на сайте платные? Сколько стоит пройти один?'],
  ['ru', 'Как добавить на сайт свою статью о поездке?'],
  ['ru', 'Есть ли у вас приложение для телефона?'],
  ['ru', 'Нужен ли интернет во время квеста или его можно загрузить заранее?'],
  ['ru', 'Как проходить квест?'],
  ['ru', 'Сколько идёт модерация статьи?'],
  ['ru', 'На каких языках работает сайт?'],
  ['be', 'Ці трэба рэгістравацца, каб карыстацца сайтам?'],
  ['be', 'Ці ёсць у квэсце падказкі, калі не магу адказаць?'],
  ['be', 'Як праходзіць квэст — трэба рэгістравацца ці можна проста прыйсці на старт і пачаць?'],
  ['uk', 'Чи зберігається прогрес квесту, якщо закрити сторінку?'],
  ['uk', 'Як зв’язатися з вами, якщо знайшов помилку?'],
  ['uk', 'Квест безкоштовний?'],
  ['pl', 'Czy potrzebuję internetu podczas questu?'],
  ['pl', 'Czy quest można wydrukować?'],
  ['pl', 'W jakich językach działa strona?'],
  ['pl', 'Ile kosztuje quest?'],
  ['en', 'Is the site free to use?'],
  ['en', 'How long does moderation of my article take?'],
  ['en', 'Do I need to install an app to play a quest, or does it run in the browser?'],
  ['en', 'How do I start a quest?'],
]

const ABOUT_TRIP = [
  'Что посмотреть в Кракове?',
  'Куди поїхати з дітьми на вихідні у Польщі?',
  'Is there a quest in Grodno?',
  'Сколько стоит билет в Вавель?',
  'Бесплатные музеи Кракова',
  'Сколько длится квест по Гродно?',
  'Самый короткий квест в Минске',
  'Что есть на metravel про Гродно?',
  'Jak dojechać z Krakowa do Zakopanego?',
  'Какие квесты есть в Гродно?',
]

describe('намерение «о сервисе» (#3293)', () => {
  it.each(ABOUT_SITE)('[%s] «%s» — вопрос о сайте: условие service, по теме для фильтра', (_lang, question) => {
    expect(asksAboutService(question)).toBe(true)
    expect(parseConditions(question).service).toBe(true)
    expect(classifyQuestion(question)).toEqual({ offTopic: false })
    expect(isOnSiteTopic(question)).toBe(true)
  })

  it.each(ABOUT_TRIP)('«%s» — вопрос о поездке, не о сайте', (question) => {
    expect(asksAboutService(question)).toBe(false)
    expect(parseConditions(question).service).toBeUndefined()
  })

  it('вопрос о сайте без слов о поездке раньше отсекался мягкой темой; чужая тема по-прежнему отсекается', () => {
    // «Аккаунт», «пароль» и «приложение» признаком поездки не были.
    for (const question of ['Как сменить пароль от аккаунта?', 'Есть ли приложение для iPhone?', 'How do I sign up?']) {
      expect({ question, verdict: classifyQuestion(question) }).toEqual({ question, verdict: { offTopic: false } })
      // Отказ модели на такой вопрос — «материала нет», а не «не по теме».
      expect(judgeModelReply(question, 'Я ассистент metravel.by по путешествиям — на другие темы не отвечаю.', 0)).toBe('no_material')
    }
    expect(classifyQuestion('Напиши код на питоне').offTopic).toBe(true)
    expect(classifyQuestion('Дай рецепт борща').offTopic).toBe(true)
    expect(asksAboutService('')).toBe(false)
    expect(asksAboutService(null)).toBe(false)
  })
})
