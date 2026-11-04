import type { QuizQuestion } from './gamesMedia'

export const initialQuizRound = { index: 0, score: 0, answer: null } as {
  index: number
  score: number
  answer: string | null
}

export function answerQuizQuestion(
  round: typeof initialQuizRound,
  question: QuizQuestion,
  choiceId: string,
) {
  if (round.answer !== null || !question.choices.some(choice => choice.id === choiceId)) return round
  return { ...round, answer: choiceId, score: round.score + Number(choiceId === question.correctChoiceId) }
}

export function advanceQuizRound(round: typeof initialQuizRound) {
  if (round.answer === null) return round
  return { ...round, index: round.index + 1, answer: null }
}
