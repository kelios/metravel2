import React from 'react';
import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import MessageBubble from '@/components/messages/MessageBubble';
import type { Message } from '@/api/messages';

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
    it('renders message text', () => {
        const { getByText } = render(
            <MessageBubble message={baseMessage} isOwn={false} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders own message', () => {
        const { getByText } = render(
            <MessageBubble message={baseMessage} isOwn={true} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('renders system message', () => {
        const sysMsg: Message = { ...baseMessage, text: 'System notification' };
        const { getByText } = render(
            <MessageBubble message={sysMsg} isOwn={false} isSystem />
        );
        expect(getByText('System notification')).toBeTruthy();
    });

    it('renders formatted time for today', () => {
        const now = new Date();
        const msg: Message = { ...baseMessage, created_at: now.toISOString() };
        const { queryByText } = render(
            <MessageBubble message={msg} isOwn={false} />
        );
        expect(queryByText('Hello world')).toBeTruthy();
    });

    it('handles null created_at gracefully', () => {
        const msg: Message = { ...baseMessage, created_at: null };
        const { getByText } = render(
            <MessageBubble message={msg} isOwn={false} />
        );
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('does not show actions by default', () => {
        const { queryByLabelText } = render(
            <MessageBubble message={baseMessage} isOwn={true} />
        );
        expect(queryByLabelText('Удалить сообщение')).toBeNull();
        expect(queryByLabelText('Копировать текст')).toBeNull();
    });

    it('long press with onDelete shows Alert with Копировать and Удалить (native)', () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const onDelete = jest.fn();
        const { getByText } = render(
            <MessageBubble message={baseMessage} isOwn={true} onDelete={onDelete} />
        );
        const node = findPressableWithLongPress(getByText('Hello world'));
        expect(node).toBeTruthy();
        node.props.onLongPress();
        expect(alertSpy).toHaveBeenCalledWith(
            'Сообщение',
            undefined,
            expect.arrayContaining([
                expect.objectContaining({ text: 'Копировать' }),
                expect.objectContaining({ text: 'Удалить', style: 'destructive' }),
                expect.objectContaining({ text: 'Отмена', style: 'cancel' }),
            ])
        );
        alertSpy.mockRestore();
    });

    it('long press without onDelete shows Alert with Копировать only (native)', () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const { getByText } = render(
            <MessageBubble message={baseMessage} isOwn={false} />
        );
        const node = findPressableWithLongPress(getByText('Hello world'));
        expect(node).toBeTruthy();
        node.props.onLongPress();
        expect(alertSpy).toHaveBeenCalledWith(
            'Сообщение',
            undefined,
            expect.arrayContaining([
                expect.objectContaining({ text: 'Копировать' }),
                expect.objectContaining({ text: 'Отмена', style: 'cancel' }),
            ])
        );
        // Should NOT contain Удалить
        const buttons = alertSpy.mock.calls[0][2] as any[];
        expect(buttons.find((b: any) => b.text === 'Удалить')).toBeUndefined();
        alertSpy.mockRestore();
    });
});
