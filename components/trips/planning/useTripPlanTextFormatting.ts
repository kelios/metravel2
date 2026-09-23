// components/trips/planning/useTripPlanTextFormatting.ts
// #2072: выделение одного многострочного поля для кнопок оформления
// (`TripPlanFormatToolbar`). Поле с полноэкранным режимом —
// `TripPlanDescriptionEditor` — ведёт выделение двух полей сам.
import { useCallback, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInput, TextInputSelectionChangeEventData } from 'react-native';

import {
  applyTripPlanFormat,
  type TripPlanFormatAction,
  type TripPlanTextSelection,
} from './tripPlanFormatActions';

export function useTripPlanTextFormatting(value: string, onChangeText: (value: string) => void) {
  const inputRef = useRef<TextInput>(null);
  const selectionRef = useRef<TripPlanTextSelection>({ start: value.length, end: value.length });
  // Выделение управляемое только на один кадр после кнопки: иначе при обычном
  // наборе курсор откатывался бы к позиции прошлого рендера.
  const [selection, setSelection] = useState<TripPlanTextSelection>();

  const onSelectionChange = useCallback((event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    selectionRef.current = event.nativeEvent.selection;
    setSelection((current) => (current === undefined ? current : undefined));
  }, []);

  const handleChangeText = useCallback((next: string) => {
    setSelection((current) => (current === undefined ? current : undefined));
    onChangeText(next);
  }, [onChangeText]);

  const applyFormat = useCallback((action: TripPlanFormatAction) => {
    const result = applyTripPlanFormat(value, selectionRef.current, action);
    selectionRef.current = result.selection;
    onChangeText(result.value);
    setSelection(result.selection);
    // Нажатие на кнопку уводит фокус из поля (web); возвращаем после рендера.
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChangeText, value]);

  return { inputRef, selection, onSelectionChange, onChangeText: handleChangeText, applyFormat };
}
