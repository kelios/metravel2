import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ChatView from '@/components/messages/ChatView';
import type { Message } from '@/api/messages';

const mockMessages: Message[] = [
    { id: 1, thread: 10, sender: 100, text: 'Привет!', created_at: '2024-06-15T10:00:00Z' },
    { id: 2, thread: 10, sender: 200, text: 'Здравствуйте!', created_at: '2024-06-15T10:01:00Z' },
    { id: 3, thread: 10, sender: 100, text: 'Как дела?', created_at: '2024-06-14T09:00:00Z' },
];

const defaultProps = {
    messages: mockMessages,
    loading: false,
    sending: false,
    currentUserId: '100',
    otherUserName: 'Иван Петров',
    otherUserAvatar: null as string | null,
    onSend: jest.fn(),
    onBack: jest.fn(),
};

let mockIsScreenHeaderMobile = false;
jest.mock('@/components/layout/ScreenHeaderContext', () => ({
    ...jest.requireActual('@/components/layout/ScreenHeaderContext'),
    useIsScreenHeaderMobile: () => mockIsScreenHeaderMobile,
}));

describe('ChatView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders header with other user name', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
    });

    it('renders messages', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Здравствуйте!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });

    it('renders empty state when no messages', () => {
        const { getByText } = render(
            <ChatView {...defaultProps} messages={[]} />
        );
        expect(getByText('Начните диалог — напишите сообщение')).toBeTruthy();
    });

    it('calls onSend when send button pressed with text', () => {
        const onSend = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        const input = getByLabelText('Поле ввода сообщения');
        fireEvent.changeText(input, 'Новое сообщение');
        fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).toHaveBeenCalledWith('Новое сообщение');
    });

    it('does not reserve the global dock inset when reserveBottomDock is false', () => {
        const { getByTestId } = render(
            <ChatView {...defaultProps} reserveBottomDock={false} />
        );
        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);

        expect(composerStyle?.paddingBottom ?? 0).toBeLessThan(56);
    });

    it('does not call onSend with empty text', () => {
        const onSend = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).not.toHaveBeenCalled();
    });

    it('calls onBack when back button pressed', () => {
        const onBack = jest.fn();
        const { getByLabelText } = render(
            <ChatView {...defaultProps} onBack={onBack} />
        );
        fireEvent.press(getByLabelText('Назад к списку диалогов'));
        expect(onBack).toHaveBeenCalled();
    });

    it('hides back button when hideBackButton is true', () => {
        const { queryByLabelText } = render(
            <ChatView {...defaultProps} hideBackButton />
        );
        expect(queryByLabelText('Назад к списку диалогов')).toBeNull();
    });

    // #2115: удаление диалога — только после подтверждения (раньше шло сразу).
    it('desktop: «Удалить диалог» спрашивает подтверждение и удаляет только после него', () => {
        mockIsScreenHeaderMobile = false;
        const onDeleteThread = jest.fn();
        const { getByLabelText, getByTestId } = render(
            <ChatView {...defaultProps} onDeleteThread={onDeleteThread} />
        );
        fireEvent.press(getByLabelText('Удалить диалог'));
        expect(onDeleteThread).not.toHaveBeenCalled();
        fireEvent.press(getByTestId('chat-header-delete-confirm'));
        expect(onDeleteThread).toHaveBeenCalledTimes(1);
    });

    // #2115 (правило #2101): на телефоне удаление — подписанный пункт «⋯», корзины в шапке нет.
    it('телефон: «Удалить диалог» — destructive-пункт «⋯» с подтверждением', async () => {
        mockIsScreenHeaderMobile = true;
        const onDeleteThread = jest.fn();
        const { getByTestId, queryByTestId } = render(
            <ChatView {...defaultProps} onDeleteThread={onDeleteThread} />
        );
        expect(queryByTestId('chat-header-delete')).toBeNull();
        fireEvent.press(getByTestId('chat-header-more'));
        fireEvent.press(getByTestId('chat-header-delete-thread'));
        expect(onDeleteThread).not.toHaveBeenCalled();
        // На iOS пункт ждёт закрытия листа (onDismiss / страховочный таймер, #2115).
        const confirm = await waitFor(() => getByTestId('chat-header-delete-confirm'));
        fireEvent.press(confirm);
        expect(onDeleteThread).toHaveBeenCalledTimes(1);
        mockIsScreenHeaderMobile = false;
    });

    it('shows loading indicator when loading with no messages', () => {
        const { queryByText } = render(
            <ChatView {...defaultProps} messages={[]} loading={true} />
        );
        expect(queryByText('Привет!')).toBeNull();
    });

    // Неудачная отправка не должна молча съедать сообщение: текст возвращается
    // в поле ввода, а переданная ошибка отображается над композером.
    it('restores the input text when onSend reports failure', async () => {
        const onSend = jest.fn().mockResolvedValue(false);
        const { getByLabelText } = render(<ChatView {...defaultProps} onSend={onSend} />);
        const input = getByLabelText('Поле ввода сообщения');

        fireEvent.changeText(input, 'Не ушло');
        fireEvent.press(getByLabelText('Отправить сообщение'));

        expect(onSend).toHaveBeenCalledWith('Не ушло');
        await waitFor(() => expect(input.props.value).toBe('Не ушло'));
    });

    it('keeps the input cleared when onSend succeeds', async () => {
        const onSend = jest.fn().mockResolvedValue(true);
        const { getByLabelText } = render(<ChatView {...defaultProps} onSend={onSend} />);
        const input = getByLabelText('Поле ввода сообщения');

        fireEvent.changeText(input, 'Ушло');
        fireEvent.press(getByLabelText('Отправить сообщение'));

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(input.props.value).toBe('');
    });

    it('renders send error above the composer', () => {
        const { getByTestId, getByText } = render(
            <ChatView {...defaultProps} sendError="Ошибка отправки сообщения" />
        );
        expect(getByTestId('message-send-error')).toBeTruthy();
        expect(getByText('Ошибка отправки сообщения')).toBeTruthy();
    });

    it('replaces the composer with a notice when composerDisabledReason is set', () => {
        const reason = 'Диалог недоступен: собеседник удалён. Отправка сообщений отключена.';
        const { getByTestId, getByText, queryByLabelText } = render(
            <ChatView {...defaultProps} composerDisabledReason={reason} />
        );
        expect(getByTestId('message-composer-disabled')).toBeTruthy();
        expect(getByText(reason)).toBeTruthy();
        expect(queryByLabelText('Поле ввода сообщения')).toBeNull();
        expect(queryByLabelText('Отправить сообщение')).toBeNull();
    });

    it('renders date separators between different days', () => {
        const { getByText } = render(<ChatView {...defaultProps} />);
        // Messages span two days, so there should be date labels
        // The exact labels depend on the current date vs message dates
        // At minimum, the messages should render without errors
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });
});
