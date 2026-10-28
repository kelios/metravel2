import { render as rtlRender, act, fireEvent, waitFor } from '@testing-library/react-native';
import { createQueryWrapper } from '../../helpers/testQueryClient';
import { Alert, Platform } from 'react-native';
import MessageBubble from '@/components/messages/MessageBubble';
import type { Message } from '@/api/messages';

// #2133: меню жалобы в рендере зовёт мутации блокировки — нужен QueryClient, как в приложении.
const render = async (ui: Parameters<typeof rtlRender>[0]) =>
    rtlRender(ui, { wrapper: createQueryWrapper().Wrapper });

jest.mock('expo-clipboard', () => ({
    setStringAsync: jest.fn(),
}));

const baseMessage: Message = {
    id: 1,
    thread: 10,
    sender: 100,
    text: 'Hello world',
    created_at: new Date().toISOString(),
};

function findPressableWithLongPress(startNode: any): any {
    let node = startNode;
    while (node && !node.props?.onLongPress) {
        node = node.parent;
    }
    return node;
}

describe('MessageBubble', () => {
    it('renders message text', async () => {
        const { getByText } = await render(
            <MessageBubble message={baseMessage} isOwn={false} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders own message', async () => {
        const { getByText } = await render(
            <MessageBubble message={baseMessage} isOwn={true} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders system message', async () => {
        const sysMsg: Message = { ...baseMessage, text: 'System notification' };
        const { getByText } = await render(
            <MessageBubble message={sysMsg} isOwn={false} isSystem />
        );
        expect(getByText('System notification')).toBeTruthy();
    });

    it('renders formatted time for today', async () => {
        const now = new Date();
        const msg: Message = { ...baseMessage, created_at: now.toISOString() };
        const { queryByText } = await render(
            <MessageBubble message={msg} isOwn={false} />
        );
        expect(queryByText('Hello world')).toBeTruthy();
    });

    it('handles null created_at gracefully', async () => {
        const msg: Message = { ...baseMessage, created_at: null };
        const { getByText } = await render(
            <MessageBubble message={msg} isOwn={false} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('does not show actions by default', async () => {
        const { queryByLabelText } = await render(
            <MessageBubble message={baseMessage} isOwn={true} />
        );
        expect(queryByLabelText('Удалить сообщение')).toBeNull();
        expect(queryByLabelText('Копировать текст')).toBeNull();
    });

    it('renders explicit delete button for own message when onDelete is passed', async () => {
        const { getByLabelText } = await render(
            <MessageBubble message={baseMessage} isOwn={true} onDelete={jest.fn()} />
        );

        expect(getByLabelText('Удалить сообщение')).toBeTruthy();
    });

    // #2127: меню долгого нажатия — ActionListSheet на всех платформах, без Alert.alert.
    it('long press with onDelete opens the action sheet with Копировать and destructive Удалить', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const { getByText, getByLabelText, getAllByLabelText } = await render(
            <MessageBubble message={baseMessage} isOwn={true} onDelete={jest.fn()} />
        );
        expect(getAllByLabelText('Удалить сообщение')).toHaveLength(1);
        const node = findPressableWithLongPress(getByText('Hello world'));
        await act(() => node.props.onLongPress());

        expect(getByText('Сообщение')).toBeTruthy();
        expect(getByLabelText('Копировать текст')).toBeTruthy();
        // кнопка в строке сообщения + destructive-пункт меню
        expect(getAllByLabelText('Удалить сообщение')).toHaveLength(2);
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    it('long press without onDelete offers Копировать only', async () => {
        const { getByText, getByLabelText, queryByText } = await render(
            <MessageBubble message={baseMessage} isOwn={false} />
        );
        const node = findPressableWithLongPress(getByText('Hello world'));
        await act(() => node.props.onLongPress());

        expect(getByLabelText('Копировать текст')).toBeTruthy();
        expect(queryByText('Удалить')).toBeNull();
    });

    it('native: «Удалить» из меню спрашивает через confirmAction и удаляет после подтверждения', async () => {
        const originalPlatform = Platform.OS;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const onDelete = jest.fn();
        try {
            const { getByText, getByLabelText } = await render(
                <MessageBubble message={baseMessage} isOwn={true} onDelete={onDelete} />
            );
            await fireEvent.press(getByLabelText('Удалить сообщение'));
            expect(onDelete).not.toHaveBeenCalled();
            expect(alertSpy).toHaveBeenCalledWith(
                'Удалить сообщение',
                expect.any(String),
                expect.any(Array),
                expect.objectContaining({ cancelable: true }),
            );
            const buttons = alertSpy.mock.calls[0]?.[2] as any[];
            buttons.find((b) => b.style === 'destructive')?.onPress?.();
            await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
            expect(getByText('Hello world')).toBeTruthy();
        } finally {
            alertSpy.mockRestore();
            Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
        }
    });
});
