import { detectLanguage, judgeLanguage, questionLanguage } from '@/scripts/ai-assist/language'

// #3369: один определитель языка для службы `/ai/ask` (язык справочного ответа) и контура оценки.
describe('aiAssist language: язык текста и язык вопроса (#3369)', () => {
  it('язык по буквам: RU/BE/UK/PL/EN; текст без букв — null', () => {
    expect(detectLanguage('Сколько стоит пройти квест?')).toBe('ru')
    expect(detectLanguage('Колькі каштуе прайсці квэст?')).toBe('be')
    expect(detectLanguage('Скільки коштує пройти квест?')).toBe('uk')
    expect(detectLanguage('Ile kosztuje przejście questu?')).toBe('pl')
    expect(detectLanguage('How much does a quest cost?')).toBe('en')
    expect(detectLanguage('https://metravel.by/quests/1 123')).toBeNull()
    expect(judgeLanguage('')).toEqual({ language: null, tied: [] })
  })

  it('равный счёт по буквам решают служебные слова и буквы одного языка; имена латиницей в счёт не идут', () => {
    expect(detectLanguage('У картцы не пазначаны ўзровень гадин; каля 120 хв')).toBe('be')
    expect(detectLanguage('Ось головне в горах взимку: У картках не вказано про катання на лижах')).toBe('uk')
    expect(detectLanguage('Да, приложение MeTravel есть для iPhone, iPad и Android — в App Store и Google Play')).toBe('ru')
  })

  it('вопрос, который между языками не выбирает, читается на языке запроса; однозначный — на своём', () => {
    // «Квест платны» — и русское, и белорусское: буквы и служебные слова языка не называют.
    expect(judgeLanguage('Квест платны?').tied).toEqual(expect.arrayContaining(['ru', 'be']))
    expect(questionLanguage('Квест платны?', 'be')).toBe('be')
    expect(questionLanguage('Квест платны?', 'ru')).toBe('ru')
    // Латиница без признаков польского и английского.
    expect(questionLanguage('Quest?', 'pl')).toBe('pl')
    // Язык определён — интерфейс его не меняет.
    expect(questionLanguage('Ile kosztuje przejście questu?', 'ru')).toBe('pl')
    expect(questionLanguage('Сколько стоит пройти квест?', 'pl')).toBe('ru')
    expect(questionLanguage('Колькі каштуе прайсці квэст?', 'ru')).toBe('be')
    // Равный счёт без языка запроса среди равных — прежний порядок.
    expect(questionLanguage('Квест платны?', 'pl')).toBe('ru')
    expect(questionLanguage('123?', 'uk')).toBe('uk')
  })
})
