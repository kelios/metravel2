import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ScrollView, View } from 'react-native';
import { useScrollNavigation } from '@/hooks/useScrollNavigation';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    ScrollView: actual.ScrollView,
    View: actual.View,
  };
});

describe('useScrollNavigation', () => {
  it('creates anchors for predefined section keys', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const keys = Object.keys(result.current.anchors);
    expect(keys).toContain('gallery');
    expect(keys).toContain('map');
    expect(keys).toContain('popular');
  });

  it('scrollTo uses measureLayout and scrollTo when anchor exists', () => {
    const { result } = renderHook(() => useScrollNavigation());

    const fakeScrollRef = {
      current: {
        scrollTo: jest.fn(),
      },
    } as any;

    // Подменяем scrollRef
    (result.current as any).scrollRef.current = fakeScrollRef.current;

    const anchor = {
      current: {
        measureLayout: jest.fn((relativeTo, onSuccess) => {
          onSuccess(0, 120);
        }),
      },
    } as any;

    (result.current as any).anchors['map'] = anchor;

    act(() => {
      result.current.scrollTo('map');
    });

    expect(fakeScrollRef.current.scrollTo).toHaveBeenCalledWith({ y: 120, animated: true });
  });

  it('does nothing when anchor or scrollRef is missing', () => {
    const { result } = renderHook(() => useScrollNavigation());

    // Не устанавливаем scrollRef и anchor явно
    act(() => {
      result.current.scrollTo('non-existing');
    });

    // Отсутствие ошибок уже достаточно; поведение "ничего не делать"
    expect(true).toBe(true);
  });
});
