import { act, render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { Alert, Platform, StyleSheet } from 'react-native';
import ThreadList from '@/components/messages/ThreadList';
import type { MessageThread } from '@/api/messages';
import * as imageOptimization from '@/utils/imageOptimization';
import { i18n } from '@/i18n';

jest.mock('@/utils/imageOptimization', () => ({
    ...jest.requireActual('@/utils/imageOptimization'),
    optimizeImageUrl: jest.fn(jest.requireActual('@/utils/imageOptimization').optimizeImageUrl),
}));

const mockThreads: MessageThread[] = [
    {
        id: 1,
        participants: [1, 2],
        created_at: '2024-01-01T00:00:00Z',
        last_message_created_at: '2024-06-15T14:30:00Z',
    },
    {
        id: 2,
        participants: [1, 3],
        created_at: '2024-01-02T00:00:00Z',
        last_message_created_at: '2024-06-14T10:00:00Z',
    },
];

const participantNames = new Map<number, string>([
    [2, 'Иван Петров'],
    [3, 'Мария Сидорова'],
]);

const participantAvatars = new Map<number, string | null>([
    [2, 'https://example.com/avatar1.jpg'],
    [3, null],
]);

const defaultProps = {
    threads: mockThreads,
    loading: false,
    error: null,
    currentUserId: '1',
    participantNames,
    participantAvatars,
    onSelectThread: jest.fn(),
    onRefresh: jest.fn(),
    showSearch: true,
};

describe('ThreadList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders thread list with participant names', () => {
        const { getByText } = render(<ThreadList {...defaultProps} />);
        expect(getByText('Иван Петров')).toBeTruthy();
        expect(getByText('Мария Сидорова')).toBeTruthy();
    });

    it('calls onSelectThread when thread is pressed', () => {
        const onSelectThread = jest.fn();
        const { getByText } = render(
            <ThreadList {...defaultProps} onSelectThread={onSelectThread} />
        );
        fireEvent.press(getByText('Иван Петров'));
        expect(onSelectThread).toHaveBeenCalledWith(mockThreads[0]);
    });

    it('keeps an unchanged row memoized when another row is selected (#2284)', () => {
        const optimize = imageOptimization.optimizeImageUrl as jest.Mock;
        const avatars = new Map([[2, 'https://example.com/a.jpg'], [3, 'https://example.com/b.jpg']]);
        const props = { ...defaultProps, participantAvatars: avatars, onDeleteThread: jest.fn() };
        const { rerender } = render(<ThreadList {...props} />);
        optimize.mockClear();
        rerender(<ThreadList {...props} selectedThreadId={1} />);
        expect(optimize.mock.calls.map(([url]) => url)).toEqual(['https://example.com/a.jpg']);
    });

    it('shows loading indicator when loading with no threads', () => {
        const { queryByText } = render(
            <ThreadList {...defaultProps} threads={[]} loading={true} />
        );
        expect(queryByText('Иван Петров')).toBeNull();
    });

    it('shows error state with retry button', () => {
        const onRefresh = jest.fn();
        const { getByText, getByLabelText } = render(
            <ThreadList {...defaultProps} error="Ошибка загрузки" onRefresh={onRefresh} />
        );
        expect(getByText('Ошибка загрузки')).toBeTruthy();
        fireEvent.press(getByLabelText('Повторить'));
        expect(onRefresh).toHaveBeenCalled();
    });

    it('shows empty state when no threads', () => {
        const { getByText } = render(
            <ThreadList {...defaultProps} threads={[]} />
        );
        expect(getByText('Нет сообщений')).toBeTruthy();
    });

    it('shows new conversation button in empty state', () => {
        const onNewConversation = jest.fn();
        const { getByTestId } = render(
            <ThreadList {...defaultProps} threads={[]} onNewConversation={onNewConversation} />
        );
        fireEvent.press(getByTestId('thread-list-empty-action'));
        expect(onNewConversation).toHaveBeenCalledTimes(1);
    });

    // #2267: «Новый диалог» — действие шапки панели рядом с поиском, а не первая
    // карточка списка той же формы, что строка диалога.
    describe('panel header (#2267)', () => {
        it('puts «Новый диалог» into the header next to the search, outside the thread rows', () => {
            const onNewConversation = jest.fn();
            const { getByTestId, getByLabelText } = render(
                <ThreadList {...defaultProps} onNewConversation={onNewConversation} />
            );

            const header = within(getByTestId('thread-list-header'));
            expect(header.getByLabelText('Поиск диалогов')).toBeTruthy();
            const button = header.getByTestId('thread-list-new-conversation');
            expect(button.props.accessibilityLabel).toBe('Новый диалог');
            // Единственный элемент с этой подписью: карточки-строки «Новый диалог» больше нет.
            expect(getByLabelText('Новый диалог')).toBe(button);
            for (const thread of mockThreads) {
                expect(within(getByTestId(`thread-item-${thread.id}`)).queryByLabelText('Новый диалог')).toBeNull();
            }

            fireEvent.press(button);
            expect(onNewConversation).toHaveBeenCalledTimes(1);
        });

        it('keeps the header over the empty list and can leave the empty-state button to the screen', () => {
            const { getByTestId, queryByTestId, getByText } = render(
                <ThreadList {...defaultProps} threads={[]} onNewConversation={jest.fn()} hideEmptyStateAction />
            );

            expect(getByText('Нет сообщений')).toBeTruthy();
            expect(getByTestId('thread-list-new-conversation')).toBeTruthy();
            expect(queryByTestId('thread-list-empty-action')).toBeNull();
        });

        // Шапка — рамка панели: при открытии экрана загрузка сменяется списком, и
        // раньше поиск с кнопкой на это время снимались и монтировались заново.
        it('keeps the same header node across loading, list, empty and error states', () => {
            const props = { ...defaultProps, onNewConversation: jest.fn() };
            const { getByTestId, queryByText, rerender } = render(<ThreadList {...props} threads={[]} loading />);

            const button = getByTestId('thread-list-new-conversation');
            const search = within(getByTestId('thread-list-header')).getByLabelText('Поиск диалогов');
            expect(queryByText('Нет сообщений')).toBeNull();
            fireEvent.changeText(search, 'Иван');

            const states = [
                <ThreadList key="list" {...props} />,
                <ThreadList key="empty" {...props} threads={[]} />,
                <ThreadList key="error" {...props} error="Ошибка загрузки" />,
                <ThreadList key="loading" {...props} threads={[]} loading />,
            ];
            for (const state of states) {
                // Один и тот же экземпляр: `key` у корня не меняется.
                rerender(<ThreadList {...state.props} />);
                expect(getByTestId('thread-list-new-conversation')).toBe(button);
                const field = within(getByTestId('thread-list-header')).getByLabelText('Поиск диалогов');
                expect(field).toBe(search);
                expect(field.props.value).toBe('Иван');
            }
        });

        it('shows the loader, not «Нет сообщений», while the first load is pending', () => {
            const { queryByText, queryByTestId } = render(<ThreadList {...defaultProps} threads={[]} loading />);

            expect(queryByText('Нет сообщений')).toBeNull();
            expect(queryByTestId('thread-list-empty')).toBeNull();
        });

        it('renders no new-conversation button without a handler', () => {
            const { queryByTestId } = render(<ThreadList {...defaultProps} />);
            expect(queryByTestId('thread-list-new-conversation')).toBeNull();
        });

        it('gives the search clear control a 44px touch target', () => {
            const { getByLabelText } = render(<ThreadList {...defaultProps} />);
            fireEvent.changeText(getByLabelText('Поиск диалогов'), 'Мария');

            expect(StyleSheet.flatten(getByLabelText('Очистить поиск').props.style)).toMatchObject({ width: 44, height: 44 });
        });
    });

    it('filters threads by search query', () => {
        const { getByLabelText, queryByText } = render(
            <ThreadList {...defaultProps} />
        );
        const searchInput = getByLabelText('Поиск диалогов');
        fireEvent.changeText(searchInput, 'Мария');
        expect(queryByText('Мария Сидорова')).toBeTruthy();
        expect(queryByText('Иван Петров')).toBeNull();
    });

    it('includes participant name in accessibility label', () => {
        const { getByLabelText } = render(<ThreadList {...defaultProps} />);
        expect(getByLabelText('Диалог с Иван Петров')).toBeTruthy();
    });

    describe('safe preview composition (#2266)', () => {
        const own = { text: 'Маршрут через лес', sender_id: 1, is_deleted: false };
        const other = { text: 'Встретимся у озера', sender_id: 2, is_deleted: false };
        const withPreview = (preview: MessageThread['last_message_preview']): MessageThread => ({
            ...mockThreads[0], unread_count: 150, last_message_preview: preview,
        });

        it.each([
            [own, 'Вы: Маршрут через лес'],
            [other, 'Встретимся у озера'],
            [{ ...own, is_deleted: true }, 'Сообщение удалено'],
            [null, 'Нет сообщений'],
        ])('renders and announces the safe preview state %j', (preview, text) => {
            const view = render(<ThreadList {...defaultProps} threads={[withPreview(preview)]} />);
            expect(view.getByTestId('thread-preview-1').props.children).toBe(text);
            expect(view.getByLabelText(`Диалог с Иван Петров, 150 непрочитанных. ${text}`)).toBeTruthy();
            if (preview?.is_deleted) {
                expect(view.queryByText(preview.text)).toBeNull();
                expect(view.queryByLabelText(new RegExp(preview.text))).toBeNull();
            }
        });

        it('keeps old responses usable without claiming the conversation is empty', () => {
            const view = render(<ThreadList {...defaultProps} threads={[mockThreads[0]]} />);
            expect(view.queryByTestId('thread-preview-1')).toBeNull();
            expect(view.queryByText('Нет сообщений')).toBeNull();
            expect(view.getByLabelText('Диалог с Иван Петров')).toBeTruthy();
        });

        it.each(['invalid', '0', '-1', '1.5', 'Infinity', null])('keeps API text unchanged for invalid current-user id %s', (currentUserId) => {
            const text = 'You: & <b>сообщение</b>';
            const view = render(<ThreadList {...defaultProps} currentUserId={currentUserId} threads={[
                withPreview({ ...own, text }),
            ]} />);
            expect(view.getByTestId('thread-preview-1').props.children).toBe(text);
        });

        it('distinguishes similar names, searches names only and preserves selection/delete callbacks', () => {
            const rows = [
                withPreview(own),
                { ...mockThreads[1], last_message_preview: other },
            ];
            const onSelectThread = jest.fn();
            const onDeleteThread = jest.fn();
            const view = render(<ThreadList {...defaultProps} threads={rows}
                participantNames={new Map([[2, 'Julia Sauran'], [3, 'Julia Ivanova']])}
                onSelectThread={onSelectThread} onDeleteThread={onDeleteThread} />);
            expect(view.getByText('Вы: Маршрут через лес')).toBeTruthy();
            expect(view.getByText('Встретимся у озера')).toBeTruthy();
            fireEvent.press(view.getByText('Встретимся у озера'));
            expect(onSelectThread).toHaveBeenCalledWith(rows[1]);
            fireEvent.changeText(view.getByLabelText('Поиск диалогов'), 'озера');
            expect(view.queryByTestId('thread-item-2')).toBeNull();
            fireEvent.changeText(view.getByLabelText('Поиск диалогов'), 'Ivanova');
            expect(view.queryByTestId('thread-item-1')).toBeNull();
            expect(view.getByTestId('thread-item-2')).toBeTruthy();
            fireEvent(view.getByText('Julia Ivanova'), 'longPress');
            expect(onDeleteThread).not.toHaveBeenCalled();
        });

        it('gives long text one meta line while preserving a full accessibility label', () => {
            const text = 'М'.repeat(200);
            const view = render(<ThreadList {...defaultProps} threads={[withPreview({ ...other, text })]} />);
            const preview = view.getByTestId('thread-preview-1');
            expect(preview.props.numberOfLines).toBe(1);
            expect(preview.props.ellipsizeMode).toBe('tail');
            expect(StyleSheet.flatten(preview.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
            expect(view.getByLabelText(`Диалог с Иван Петров, 150 непрочитанных. ${text}`)).toBeTruthy();
            expect(view.getByText('99+')).toBeTruthy();
        });

        it('reacts to all five locale changes without new thread data or callback churn', async () => {
            const props = { ...defaultProps, threads: [
                withPreview(own),
                { ...withPreview({ ...own, is_deleted: true }), id: 2 },
                { ...withPreview(null), id: 3 },
            ] };
            const view = render(<ThreadList {...props} />);
            try {
                for (const [locale, prefix, deleted, empty] of [
                    ['ru', 'Вы', 'Сообщение удалено', 'Нет сообщений'],
                    ['be', 'Вы', 'Паведамленне выдалена', 'Няма паведамленняў'],
                    ['uk', 'Ви', 'Повідомлення видалено', 'Немає повідомлень'],
                    ['pl', 'Ty', 'Wiadomość usunięta', 'Brak wiadomości'],
                    ['en', 'You', 'Message deleted', 'No messages'],
                ]) {
                    await act(async () => { await i18n.changeLanguage(locale); });
                    expect(view.getByTestId('thread-preview-1').props.children).toBe(`${prefix}: ${own.text}`);
                    expect(view.getByTestId('thread-preview-2').props.children).toBe(deleted);
                    expect(view.getByTestId('thread-preview-3').props.children).toBe(empty);
                }
            } finally {
                view.unmount();
                await act(async () => { await i18n.changeLanguage('ru'); });
            }
        });
    });

    it('announces unread count and caps the visible badge at 99+', () => {
        const unreadThread: MessageThread = {
            ...mockThreads[0],
            unread_count: 150,
        };
        const { getByLabelText, getByText } = render(
            <ThreadList {...defaultProps} threads={[unreadThread]} />
        );

        expect(getByLabelText('Диалог с Иван Петров, 150 непрочитанных')).toBeTruthy();
        expect(getByText('99+')).toBeTruthy();
    });

    // #2264: имя собеседника — главный элемент строки. Постоянная корзина, шеврон,
    // дата и счётчик делили с ним одну линию и оставляли ему 62 px из 288.
    describe('thread row composition (#2264)', () => {
        const unread: MessageThread = { ...mockThreads[0], unread_count: 150 };

        it('keeps the name alone on its line: date and unread badge sit on the line below', () => {
            const { getByTestId } = render(
                <ThreadList {...defaultProps} threads={[unread]} onDeleteThread={jest.fn()} />
            );

            const name = getByTestId('thread-name-1');
            expect(name.props.numberOfLines).toBe(1);
            expect(name.props.children).toBe('Иван Петров');

            // Колонка текста: имя и под ним строка меты — больше ничего.
            const column = name.parent!.parent!;
            const lines = column.props.children.filter(Boolean);
            expect(lines).toHaveLength(2);
            expect(StyleSheet.flatten(column.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
            expect(StyleSheet.flatten(column.props.style).flexDirection).toBeUndefined();

            const time = getByTestId('thread-time-1');
            const meta = time.parent!.parent!;
            expect(StyleSheet.flatten(meta.props.style)).toMatchObject({ flexDirection: 'row' });
            expect(within(meta).getByText('99+')).toBeTruthy();
            expect(within(meta).queryByText('Иван Петров')).toBeNull();
        });

        it('draws no chevron and no in-flow delete button', () => {
            const originalPlatform = Platform.OS;
            Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

            try {
                const { getByTestId, getByLabelText, UNSAFE_queryAllByProps } = render(
                    <ThreadList {...defaultProps} onDeleteThread={jest.fn()} />
                );

                expect(UNSAFE_queryAllByProps({ name: 'chevron-right' })).toHaveLength(0);

                // Кнопка удаления лежит поверх строки и в потоке ширину не занимает;
                // показывает её CSS по маркерам (app/global.css).
                const row = getByTestId('thread-item-1');
                expect(row.props.dataSet).toEqual({ threadRow: 'true' });
                const [action] = row.findAll((node) => node.props.dataSet?.threadRowAction === 'true');
                expect(StyleSheet.flatten(action.props.style)).toMatchObject({ position: 'absolute' });
                expect(within(action).getByLabelText('Удалить диалог с Иван Петров')).toBeTruthy();
                expect(StyleSheet.flatten(getByLabelText('Удалить диалог с Иван Петров').props.style)).toMatchObject({
                    minWidth: 44,
                    minHeight: 44,
                });
                expect(getByTestId('thread-name-1').parent!.parent!.props.dataSet).toEqual({ threadRowText: 'true' });
            } finally {
                Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
            }
        });

        it.each(['ios', 'android'])('on %s renders no delete button: long press and a screen-reader action delete', async (os) => {
            const originalPlatform = Platform.OS;
            Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
            const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

            try {
                const { getByLabelText, queryByLabelText } = render(
                    <ThreadList {...defaultProps} onDeleteThread={jest.fn()} />
                );

                expect(queryByLabelText('Удалить диалог с Иван Петров')).toBeNull();

                const row = getByLabelText('Диалог с Иван Петров');
                expect(row.props.accessibilityActions).toEqual([
                    { name: 'delete', label: 'Удалить диалог с Иван Петров' },
                ]);

                fireEvent(row, 'longPress');
                expect(alertSpy).toHaveBeenCalledTimes(1);

                fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
                expect(alertSpy).toHaveBeenCalledTimes(1);
                fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
                expect(alertSpy).toHaveBeenCalledTimes(2);
            } finally {
                alertSpy.mockRestore();
                Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
            }
        });

        it('offers no delete path at all without a handler', () => {
            const { getByLabelText, queryByLabelText } = render(<ThreadList {...defaultProps} />);

            expect(queryByLabelText('Удалить диалог с Иван Петров')).toBeNull();
            expect(getByLabelText('Диалог с Иван Петров').props.accessibilityActions).toBeUndefined();
        });

        it('opens the web confirmation from a long press as well', () => {
            const originalPlatform = Platform.OS;
            Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

            try {
                const { getByLabelText, queryByLabelText } = render(
                    <ThreadList {...defaultProps} onDeleteThread={jest.fn()} />
                );

                expect(queryByLabelText('Подтвердить удаление диалога')).toBeNull();
                fireEvent(getByLabelText('Диалог с Иван Петров'), 'longPress');
                expect(StyleSheet.flatten(getByLabelText('Подтвердить удаление диалога').props.style)).toMatchObject({ minHeight: 44 });
                fireEvent.press(getByLabelText('Отмена'));
                expect(queryByLabelText('Подтвердить удаление диалога')).toBeNull();
            } finally {
                Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
            }
        });
    });

    it('does not clip the delete tooltip at the web thread-card boundary', () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

        try {
            const { getByTestId } = render(
                <ThreadList {...defaultProps} onDeleteThread={jest.fn()} />
            );

            expect(StyleSheet.flatten(getByTestId('thread-item-1').props.style)).toMatchObject({
                overflow: 'visible',
            });
        } finally {
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });

    it('renders the web confirmation and confirms thread deletion', () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
        const onDeleteThread = jest.fn();

        try {
            const { getByLabelText } = render(
                <ThreadList {...defaultProps} onDeleteThread={onDeleteThread} />
            );

            fireEvent.press(getByLabelText('Удалить диалог с Иван Петров'));
            fireEvent.press(getByLabelText('Подтвердить удаление диалога'));

            expect(onDeleteThread).toHaveBeenCalledWith(1);
        } finally {
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });

    it('uses the native destructive confirmation (confirmAction) before deleting a thread', async () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        const onDeleteThread = jest.fn();
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

        try {
            const { getByLabelText } = render(
                <ThreadList {...defaultProps} onDeleteThread={onDeleteThread} />
            );

            fireEvent(getByLabelText('Диалог с Иван Петров'), 'longPress');
            expect(onDeleteThread).not.toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledTimes(1);
            expect(alertSpy).toHaveBeenCalledWith(
                'Удалить диалог',
                'Вы уверены, что хотите удалить этот диалог?',
                expect.any(Array),
                expect.objectContaining({ cancelable: true }),
            );

            const buttons = alertSpy.mock.calls[0]?.[2];
            const destructiveButton = buttons?.find((button) => button.style === 'destructive');
            expect(destructiveButton?.text).toBe('Удалить');
            destructiveButton?.onPress?.();
            await waitFor(() => expect(onDeleteThread).toHaveBeenCalledWith(1));
        } finally {
            alertSpy.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });

    it('labels a persisted thread with no remaining peer as a deleted user', () => {
        const orphanedThread: MessageThread = {
            ...mockThreads[0],
            participants: [1],
        };
        const { getByText, queryByText } = render(
            <ThreadList
                {...defaultProps}
                threads={[orphanedThread]}
                participantNames={new Map()}
            />
        );

        expect(getByText('Удалённый пользователь')).toBeTruthy();
        expect(queryByText('Пользователь')).toBeNull();
    });

    // Regression (prod bug: list showed generic «Пользователь»): ThreadList has NO
    // way to resolve a name on its own — it relies entirely on participantNames.
    // The screen MUST populate that map for thread peers that are not in the
    // available-users list (it now merges resolved profiles). This test documents
    // the contract: a missing entry falls back to «Пользователь», so the gap is
    // never the component's to hide — it must be filled by the screen.
    it('falls back to «Пользователь» only when the name map lacks the peer', () => {
        const { getByText, queryByText } = render(
            <ThreadList
                {...defaultProps}
                threads={[mockThreads[0]]}
                participantNames={new Map()}
            />
        );
        expect(getByText('Пользователь')).toBeTruthy();
        expect(queryByText('Иван Петров')).toBeNull();

        // With the name provided (как теперь делает экран через mergedNames) — реальное имя.
        const { getByText: getByText2 } = render(
            <ThreadList {...defaultProps} threads={[mockThreads[0]]} />
        );
        expect(getByText2('Иван Петров')).toBeTruthy();
    });
});
