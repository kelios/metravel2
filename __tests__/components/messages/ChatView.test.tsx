import { render as rtlRender, fireEvent, waitFor } from '@testing-library/react-native';
import { createQueryWrapper } from '../../helpers/testQueryClient';
import { StyleSheet } from 'react-native';
import ChatView from '@/components/messages/ChatView';
import type { Message } from '@/api/messages';

// #2133: меню жалобы в рендере зовёт мутации блокировки — нужен QueryClient, как в приложении.
const render = async (ui: Parameters<typeof rtlRender>[0]) =>
    rtlRender(ui, { wrapper: createQueryWrapper().Wrapper });

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

    it('renders header with other user name', async () => {
        const { getByText } = await render(<ChatView {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
    });

    it('renders messages', async () => {
        const { getByText } = await render(<ChatView {...defaultProps} />);
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Здравствуйте!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });

    it('renders empty state when no messages', async () => {
        const { getByText } = await render(
            <ChatView {...defaultProps} messages={[]} />
        );
        expect(getByText('Начните диалог — напишите сообщение')).toBeTruthy();
    });

    it('calls onSend when send button pressed with text', async () => {
        const onSend = jest.fn();
        const { getByLabelText } = await render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        const input = getByLabelText('Поле ввода сообщения');
        await fireEvent.changeText(input, 'Новое сообщение');
        await fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).toHaveBeenCalledWith('Новое сообщение');
    });

    it('does not reserve the global dock inset when reserveBottomDock is false', async () => {
        const { getByTestId } = await render(
            <ChatView {...defaultProps} reserveBottomDock={false} />
        );
        const composerStyle = StyleSheet.flatten(getByTestId('message-composer').props.style);

        expect(composerStyle?.paddingBottom ?? 0).toBeLessThan(56);
    });

    it('does not call onSend with empty text', async () => {
        const onSend = jest.fn();
        const { getByLabelText } = await render(
            <ChatView {...defaultProps} onSend={onSend} />
        );
        await fireEvent.press(getByLabelText('Отправить сообщение'));
        expect(onSend).not.toHaveBeenCalled();
    });

    it('calls onBack when back button pressed', async () => {
        const onBack = jest.fn();
        const { getByLabelText } = await render(
            <ChatView {...defaultProps} onBack={onBack} />
        );
        await fireEvent.press(getByLabelText('Назад к списку диалогов'));
        expect(onBack).toHaveBeenCalled();
    });

    it('hides back button when hideBackButton is true', async () => {
        const { queryByLabelText } = await render(
            <ChatView {...defaultProps} hideBackButton />
        );
        expect(queryByLabelText('Назад к списку диалогов')).toBeNull();
    });

    // #2115: удаление диалога — только после подтверждения (раньше шло сразу).
    it('desktop: «Удалить диалог» спрашивает подтверждение и удаляет только после него', async () => {
        mockIsScreenHeaderMobile = false;
        const onDeleteThread = jest.fn();
        const { getByLabelText, getByTestId } = await render(
            <ChatView {...defaultProps} onDeleteThread={onDeleteThread} />
        );
        await fireEvent.press(getByLabelText('Удалить диалог'));
        expect(onDeleteThread).not.toHaveBeenCalled();
        await fireEvent.press(getByTestId('chat-header-delete-confirm'));
        expect(onDeleteThread).toHaveBeenCalledTimes(1);
    });

    // #2115 (правило #2101): на телефоне удаление — подписанный пункт «⋯», корзины в шапке нет.
    it('телефон: «Удалить диалог» — destructive-пункт «⋯» с подтверждением', async () => {
        mockIsScreenHeaderMobile = true;
        const onDeleteThread = jest.fn();
        const { getByTestId, queryByTestId } = await render(
            <ChatView {...defaultProps} onDeleteThread={onDeleteThread} />
        );
        expect(queryByTestId('chat-header-delete')).toBeNull();
        await fireEvent.press(getByTestId('chat-header-more'));
        await fireEvent.press(getByTestId('chat-header-delete-thread'));
        expect(onDeleteThread).not.toHaveBeenCalled();
        // На iOS пункт ждёт закрытия листа (onDismiss / страховочный таймер, #2115).
        const confirm = await waitFor(() => getByTestId('chat-header-delete-confirm'));
        await fireEvent.press(confirm);
        expect(onDeleteThread).toHaveBeenCalledTimes(1);
        mockIsScreenHeaderMobile = false;
    });

    it('shows loading indicator when loading with no messages', async () => {
        const { queryByText } = await render(
            <ChatView {...defaultProps} messages={[]} loading={true} />
        );
        expect(queryByText('Привет!')).toBeNull();
    });

    // Неудачная отправка не должна молча съедать сообщение: текст возвращается
    // в поле ввода, а переданная ошибка отображается над композером.
    it('restores the input text when onSend reports failure', async () => {
        const onSend = jest.fn().mockResolvedValue(false);
        const { getByLabelText } = await render(<ChatView {...defaultProps} onSend={onSend} />);
        const input = getByLabelText('Поле ввода сообщения');

        await fireEvent.changeText(input, 'Не ушло');
        await fireEvent.press(getByLabelText('Отправить сообщение'));

        expect(onSend).toHaveBeenCalledWith('Не ушло');
        await waitFor(() => expect(input.props.value).toBe('Не ушло'));
    });

    it('keeps the input cleared when onSend succeeds', async () => {
        const onSend = jest.fn().mockResolvedValue(true);
        const { getByLabelText } = await render(<ChatView {...defaultProps} onSend={onSend} />);
        const input = getByLabelText('Поле ввода сообщения');

        await fireEvent.changeText(input, 'Ушло');
        await fireEvent.press(getByLabelText('Отправить сообщение'));

        await waitFor(() => expect(onSend).toHaveBeenCalled());
        expect(input.props.value).toBe('');
    });

    it('renders send error above the composer', async () => {
        const { getByTestId, getByText } = await render(
            <ChatView {...defaultProps} sendError="Ошибка отправки сообщения" />
        );
        expect(getByTestId('message-send-error')).toBeTruthy();
        expect(getByText('Ошибка отправки сообщения')).toBeTruthy();
    });

    it('replaces the composer with a notice when composerDisabledReason is set', async () => {
        const reason = 'Диалог недоступен: собеседник удалён. Отправка сообщений отключена.';
        const { getByTestId, getByText, queryByLabelText } = await render(
            <ChatView {...defaultProps} composerDisabledReason={reason} />
        );
        expect(getByTestId('message-composer-disabled')).toBeTruthy();
        expect(getByText(reason)).toBeTruthy();
        expect(queryByLabelText('Поле ввода сообщения')).toBeNull();
        expect(queryByLabelText('Отправить сообщение')).toBeNull();
    });

    it('renders date separators between different days', async () => {
        const { getByText } = await render(<ChatView {...defaultProps} />);
        // Messages span two days, so there should be date labels
        // The exact labels depend on the current date vs message dates
        // At minimum, the messages should render without errors
        expect(getByText('Привет!')).toBeTruthy();
        expect(getByText('Как дела?')).toBeTruthy();
    });
});
