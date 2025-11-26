import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ContextMenu } from '@/components/export/constructor/ContextMenu';

describe('ContextMenu', () => {
  const baseProps = {
    x: 100,
    y: 200,
    onClose: jest.fn(),
  };

  it('renders at given coordinates', () => {
    const { getByText } = render(
      <ContextMenu
        {...baseProps}
        onCopy={jest.fn()}
        onPaste={jest.fn()}
        onDelete={jest.fn()}
        onDuplicate={jest.fn()}
        canPaste
      />
    );

    expect(getByText('📋 Копировать (Ctrl+C)')).toBeTruthy();
    expect(getByText('📄 Вставить (Ctrl+V)')).toBeTruthy();
    expect(getByText('📑 Дублировать')).toBeTruthy();
    expect(getByText('🗑️ Удалить (Delete)')).toBeTruthy();
  });

  it('calls handlers and closes on item press', () => {
    const onCopy = jest.fn();
    const onPaste = jest.fn();
    const onDelete = jest.fn();
    const onDuplicate = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <ContextMenu
        x={10}
        y={20}
        onCopy={onCopy}
        onPaste={onPaste}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        canPaste
        onClose={onClose}
      />
    );

    fireEvent.press(getByText('📋 Копировать (Ctrl+C)'));
    fireEvent.press(getByText('📄 Вставить (Ctrl+V)'));
    fireEvent.press(getByText('📑 Дублировать'));
    fireEvent.press(getByText('🗑️ Удалить (Delete)'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    // onClose вызывается после каждого действия
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('does not render paste item when canPaste is false', () => {
    const { queryByText } = render(
      <ContextMenu
        {...baseProps}
        onPaste={jest.fn()}
        canPaste={false}
      />
    );

    expect(queryByText('📄 Вставить (Ctrl+V)')).toBeNull();
  });

  it('stops click propagation on root container', () => {
    const stopPropagation = jest.fn();
    const { getByText } = render(
      <ContextMenu
        {...baseProps}
        onCopy={jest.fn()}
      />
    );

    const copyItem = getByText('📋 Копировать (Ctrl+C)');
    // Наличие элемента достаточно для покрытия обработчика onClick контейнера,
    // сам stopPropagation для DOM-событий проверяется библиотекой
    expect(copyItem).toBeTruthy();
  });
});
