import { act, fireEvent, render } from '@testing-library/react-native';

import TravelModerationFeedback from '@/components/travel/TravelModerationFeedback';
import { i18n } from '@/i18n';

jest.mock('@/components/ui/InfoSheet', () => ({
  __esModule: true,
  default: ({ visible, onClose, paragraphs }: { visible: boolean; onClose: () => void; paragraphs: string[] }) => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');
    return visible ? (
    <View testID="full-reason-sheet">
      {paragraphs.map((paragraph, index) => <Text key={index}>{paragraph}</Text>)}
      <Pressable testID="close-full-reason" onPress={onClose} />
    </View>
  ) : null;
  },
}));

const rejected = {
  publication_status: 'draft',
  moderation_decision: 'rejected' as const,
  moderation_decision_reason: '  Добавьте сведения о маршруте.\nКомментарий модератора сохраняется как есть.  ',
  moderation_decided_at: '2026-10-22T12:00:00Z',
};

afterEach(async () => { await act(async () => { await i18n.changeLanguage('ru'); }); });

describe('author moderation feedback', () => {
  it('shows raw plain text, opens the complete reason, closes back to the bounded preview, and navigates only on correction', () => {
    const onCorrect = jest.fn();
    const screen = render(<TravelModerationFeedback travel={rejected} onCorrect={onCorrect} />);
    expect(screen.getByText('Отклонено')).toBeTruthy();
    expect(screen.getByTestId('moderation-reason-preview').props.children).toBe(rejected.moderation_decision_reason);
    expect(screen.getByTestId('moderation-reason-preview').props.numberOfLines).toBe(2);
    fireEvent.press(screen.getByTestId('moderation-reason-expand'));
    expect(screen.getByTestId('full-reason-sheet')).toBeTruthy();
    expect(screen.getAllByText(/Добавьте сведения о маршруте/)).toHaveLength(2);
    expect(onCorrect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('close-full-reason'));
    expect(screen.queryByTestId('full-reason-sheet')).toBeNull();
    expect(screen.getByTestId('moderation-reason-preview')).toBeTruthy();
    fireEvent.press(screen.getByTestId('moderation-correct-button'));
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });

  it('keeps rejection and correction without inventing a missing reason or invalid date', () => {
    const screen = render(<TravelModerationFeedback travel={{ ...rejected, moderation_decision_reason: ' \n ', moderation_decided_at: 'not-a-date' }} onCorrect={jest.fn()} />);
    expect(screen.getByText('Отклонено')).toBeTruthy();
    expect(screen.getByTestId('moderation-correct-button')).toBeTruthy();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
    expect(screen.queryByTestId('moderation-reason-expand')).toBeNull();
    expect(screen.queryByTestId('moderation-decision-date')).toBeNull();
  });

  it.each([
    ['draft', 'approved', 'Черновик'],
    ['pending_review', 'rejected', 'Отправлено на модерацию'],
    ['approved', 'rejected', 'Одобрено'],
    ['published', 'rejected', 'Опубликовано'],
  ] as const)('uses canonical %s despite historical %s', (publication_status, moderation_decision, label) => {
    const screen = render(<TravelModerationFeedback travel={{ ...rejected, publication_status, moderation_decision }} onCorrect={jest.fn()} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText('Отклонено')).toBeNull();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
    expect(screen.queryByTestId('moderation-decision-date')).toBeNull();
    expect(screen.queryByTestId('moderation-correct-button')).toBeNull();
  });

  it('shows the valid date of approved published content and hides an old rejection reason', () => {
    const screen = render(<TravelModerationFeedback travel={{ ...rejected, publication_status: 'published', moderation_decision: 'approved' }} />);
    expect(screen.getByText('Опубликовано')).toBeTruthy();
    expect(screen.getByTestId('moderation-decision-date')).toBeTruthy();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
  });

  it('removes an open historical reason immediately when the confirmed status becomes pending', () => {
    const screen = render(<TravelModerationFeedback travel={rejected} onCorrect={jest.fn()} />);
    fireEvent.press(screen.getByTestId('moderation-reason-expand'));
    expect(screen.getByTestId('full-reason-sheet')).toBeTruthy();
    screen.rerender(<TravelModerationFeedback travel={{ ...rejected, publication_status: 'pending_review' }} onCorrect={jest.fn()} />);
    expect(screen.queryByTestId('full-reason-sheet')).toBeNull();
    expect(screen.queryByTestId('moderation-reason-preview')).toBeNull();
    screen.rerender(<TravelModerationFeedback travel={rejected} onCorrect={jest.fn()} />);
    expect(screen.queryByTestId('full-reason-sheet')).toBeNull();
  });

  it.each([
    ['be', 'Адхілена'], ['uk', 'Відхилено'], ['pl', 'Odrzucono'], ['en', 'Rejected'],
  ] as const)('reacts to %s without translating the moderator text', async (locale, label) => {
    const screen = render(<TravelModerationFeedback travel={rejected} />);
    await act(async () => { await i18n.changeLanguage(locale); });
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByTestId('moderation-reason-preview').props.children).toBe(rejected.moderation_decision_reason);
  });
});
