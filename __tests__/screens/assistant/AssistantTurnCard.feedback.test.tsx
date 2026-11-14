import { fireEvent, render, screen } from '@testing-library/react-native'

import { AssistantTurnCard } from '@/components/screens/assistant/AssistantTurnCard'
import { createAssistantStyles } from '@/components/screens/assistant/assistantStyles'
import type { AssistantTurn } from '@/components/screens/assistant/useAssistantChat'
import { useThemedColors } from '@/hooks/useTheme'

// #3296: оценка ответа под завершённым ходом — «Помогло», «Не помогло», причина; один голос на ход.
const turn = (patch: Partial<AssistantTurn> = {}): AssistantTurn => ({
  id: 't1',
  question: 'Куда поехать на выходные?',
  answer: 'Поезжайте под Гродно.',
  sources: [],
  status: 'done',
  removedLinks: 0,
  retryAfterSec: null,
  usage: null,
  offTopicStrikes: null,
  feedbackId: 'turn-1',
  ...patch,
})

function Card({ item, onRate }: { item: AssistantTurn; onRate?: jest.Mock }) {
  const colors = useThemedColors()
  const styles = createAssistantStyles(colors, false)
  return <AssistantTurnCard turn={item} styles={styles} colors={colors} busy={false} onRetry={jest.fn()} onOpenCatalog={jest.fn()} onRate={onRate} />
}

describe('AssistantTurnCard: оценка ответа (#3296)', () => {
  it('под завершённым ответом — вопрос и две кнопки; нажатие отдаёт голос', async () => {
    const onRate = jest.fn()
    await render(<Card item={turn()} onRate={onRate} />)
    expect(screen.getByText('Ответ помог?')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('assistant-feedback-up'))
    expect(onRate).toHaveBeenLastCalledWith('t1', 'up')
    await fireEvent.press(screen.getByTestId('assistant-feedback-down'))
    expect(onRate).toHaveBeenLastCalledWith('t1', 'down')
  })

  it('после «Помогло» — благодарность, кнопок больше нет', async () => {
    await render(<Card item={turn({ vote: 'up' })} onRate={jest.fn()} />)
    expect(screen.getByText('Спасибо за оценку.')).toBeTruthy()
    expect(screen.queryByTestId('assistant-feedback-up')).toBeNull()
    expect(screen.queryByTestId('assistant-feedback-down')).toBeNull()
    expect(screen.queryByTestId('assistant-feedback-reason-place')).toBeNull()
  })

  it('после «Не помогло» — три необязательные причины; выбранная причина — благодарность', async () => {
    const onRate = jest.fn()
    const view = await render(<Card item={turn({ vote: 'down' })} onRate={onRate} />)
    expect(screen.getByText('Что не так?')).toBeTruthy()
    expect(screen.getByText('Не то место')).toBeTruthy()
    expect(screen.getByText('Неверные сведения')).toBeTruthy()
    expect(screen.getByText('Нет ответа на вопрос')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('assistant-feedback-reason-facts'))
    expect(onRate).toHaveBeenLastCalledWith('t1', 'down', 'facts')
    await view.rerender(<Card item={turn({ vote: 'down', voteReason: 'facts' })} onRate={onRate} />)
    expect(screen.getByText('Спасибо за оценку.')).toBeTruthy()
    expect(screen.queryByTestId('assistant-feedback-reason-facts')).toBeNull()
  })

  it('оценки нет: ход без идентификатора, незавершённый ход, экран без обработчика', async () => {
    const hidden = async (item: AssistantTurn, onRate?: jest.Mock) => {
      const view = await render(<Card item={item} onRate={onRate} />)
      expect(screen.queryByTestId('assistant-feedback')).toBeNull()
      await view.unmount()
    }
    await hidden(turn({ feedbackId: null }), jest.fn())
    await hidden(turn({ status: 'streaming' }), jest.fn())
    await hidden(turn({ status: 'no_sources', answer: '' }), jest.fn())
    await hidden(turn())
  })
})
