import { advanceQuizRound, answerQuizQuestion, initialQuizRound } from '@/components/games/quizRound'

const question = {
  id: 'q1', prompt: 'A question', correctChoiceId: 'a',
  choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
  explanation: 'An explanation', sourceUrl: 'https://example.com/reference',
}

describe('road quiz round', () => {
  it('ignores invalid answers and cannot advance before a choice', () => {
    expect(answerQuizQuestion(initialQuizRound, question, 'unknown')).toBe(initialQuizRound)
    expect(advanceQuizRound(initialQuizRound)).toBe(initialQuizRound)
  })

  it('locks the first choice and only awards one point', () => {
    const answered = answerQuizQuestion(initialQuizRound, question, 'a')
    expect(answered).toEqual({ index: 0, score: 1, answer: 'a' })
    expect(answerQuizQuestion(answered, question, 'a')).toBe(answered)
    expect(answerQuizQuestion(answered, question, 'b')).toBe(answered)
  })

  it('keeps wrong choices at zero and resets the choice on advance', () => {
    const answered = answerQuizQuestion(initialQuizRound, question, 'b')
    expect(answered).toEqual({ index: 0, score: 0, answer: 'b' })
    expect(answerQuizQuestion(answered, question, 'a')).toBe(answered)
    expect(advanceQuizRound(answered)).toEqual({ index: 1, score: 0, answer: null })
  })

  it('retains the score after the last question and permits a clean replay', () => {
    let round = initialQuizRound
    for (let index = 0; index < 10; index++) {
      round = advanceQuizRound(answerQuizQuestion(round, question, index % 2 === 0 ? 'a' : 'c'))
    }
    expect(round).toEqual({ index: 10, score: 5, answer: null })
    expect(initialQuizRound).toEqual({ index: 0, score: 0, answer: null })
  })
})
