import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { Button, Card, IconButton, Paragraph, Snackbar, Text, Title } from '@/ui/paper.web';

// #1657: web-шим `@/ui/paper` деструктурировал только `children` и `style`, а
// остальное выбрасывал. Тест пинит контракт: проп, поставленный на месте
// использования, доходит до отрендеренного узла. Импорт идёт по явному пути
// `@/ui/paper.web`, потому что jest резолвит `@/ui/paper` по платформе `ios`.
describe('ui/paper.web prop forwarding', () => {
  it('forwards heading semantics through Title', () => {
    const { getByText } = render(
      <Title accessibilityRole="header" aria-level={2}>
        Популярные путешествия
      </Title>,
    );

    const node = getByText('Популярные путешествия');
    expect(node.props.accessibilityRole).toBe('header');
    expect(node.props['aria-level']).toBe(2);
  });

  it.each([
    ['Text', Text],
    ['Title', Title],
    ['Paragraph', Paragraph],
  ])('forwards numberOfLines and testID through %s', (_name, Component) => {
    const { getByTestId } = render(
      <Component testID="shim-text" numberOfLines={2}>
        подпись
      </Component>,
    );

    const node = getByTestId('shim-text');
    expect(node.props.numberOfLines).toBe(2);
  });

  it('forwards pointerEvents through Text', () => {
    const { getByTestId } = render(
      <Text testID="shim-text" pointerEvents="none">
        подпись
      </Text>,
    );

    expect(getByTestId('shim-text').props.pointerEvents).toBe('none');
  });

  it('keeps the style the shim applies while merging the caller style', () => {
    const { getByText } = render(<Title style={{ color: 'red' }}>заголовок</Title>);

    expect(getByText('заголовок').props.style).toEqual([
      { fontSize: 18, fontWeight: '700' },
      { color: 'red' },
    ]);
  });

  it('forwards testID and lets the caller override the default button role', () => {
    const { getByTestId } = render(
      <Button testID="preview" accessibilityRole="link" accessibilityLabel="Открыть предпросмотр">
        Предпросмотр
      </Button>,
    );

    const node = getByTestId('preview');
    expect(node.props.accessibilityRole).toBe('link');
    expect(node.props.accessibilityLabel).toBe('Открыть предпросмотр');
  });

  it('keeps the button role when the caller does not set one', () => {
    const { getByTestId } = render(<Button testID="save">Сохранить</Button>);

    expect(getByTestId('save').props.accessibilityRole).toBe('button');
  });

  it('forwards testID through IconButton', () => {
    const { getByTestId } = render(
      <IconButton testID="next" icon={({ size }) => <Text>{String(size)}</Text>} onPress={() => {}} />,
    );

    expect(getByTestId('next')).toBeTruthy();
  });

  it('applies the caller style on Card.Content', () => {
    const { getByTestId } = render(
      <Card testID="card">
        <Card.Content testID="card-content" style={{ padding: 4 }}>
          <Text>тело</Text>
        </Card.Content>
      </Card>,
    );

    expect(getByTestId('card-content').props.style).toEqual([{ padding: 12 }, { padding: 4 }]);
  });

  it('calls onDismiss once the Snackbar duration elapses', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();

    try {
      render(
        <Snackbar visible onDismiss={onDismiss} duration={5000}>
          Не удалось сохранить
        </Snackbar>,
      );

      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  // На web `accessibilityState` бесполезен: react-native-web его не форвардит
  // вовсе (в `modules/forwardedProps` его нет). `aria-disabled` и `tabIndex=-1`
  // даёт только собственный проп `disabled` у `Pressable`, поэтому шим обязан
  // прокидывать его вниз, а не ограничиваться `accessibilityState`.
  //
  // Проверяем именно проп на `Pressable`, а не `fireEvent.press`: jest здесь
  // работает под платформой `ios`, `fireEvent` ищет `onPress` вверх по дереву и
  // находит его на самом `Button`, поэтому «нажатие» срабатывает независимо от
  // реализации. Поведение react-native-web юнит-тестом тут не доказывается —
  // `aria-disabled` и `tabindex` проверяются в браузере на стадии testing.
  it.each([
    ['Button', <Button testID="prev" disabled onPress={() => {}} key="b">Назад</Button>],
    [
      'IconButton',
      <IconButton testID="next" disabled icon="→" onPress={() => {}} accessibilityLabel="Дальше" key="i" />,
    ],
  ])('passes disabled down to Pressable in %s, not only accessibilityState', (_name, element) => {
    const { getByTestId, UNSAFE_getByType } = render(element);

    expect(getByTestId(_name === 'Button' ? 'prev' : 'next').props.accessibilityState?.disabled).toBe(true);

    const pressable = UNSAFE_getByType(Pressable);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.onPress).toBeUndefined();
  });

  it('does not restart the Snackbar timer when onDismiss identity changes', () => {
    // paper держит колбэк через useLatestCallback. Если шим зависит от identity,
    // вызывающий с инлайновой стрелкой продлевает таймер каждым рендером и
    // snackbar на web не закрывается никогда, хотя на native закрывается.
    jest.useFakeTimers();
    const first = jest.fn();
    const second = jest.fn();

    try {
      const { rerender } = render(
        <Snackbar visible onDismiss={first} duration={5000}>
          Не удалось сохранить
        </Snackbar>,
      );

      act(() => {
        jest.advanceTimersByTime(4000);
      });
      rerender(
        <Snackbar visible onDismiss={second} duration={5000}>
          Не удалось сохранить
        </Snackbar>,
      );
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule a dismiss while the Snackbar is hidden', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();

    try {
      render(
        <Snackbar visible={false} onDismiss={onDismiss}>
          Не удалось сохранить
        </Snackbar>,
      );

      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
