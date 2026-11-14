import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useIsFocused } from 'expo-router';

type Phase = 'active' | 'ending' | 'ended';

const EditorSessionContext = createContext<(() => void) | null>(null);

const noop = () => {};

/**
 * Единственный владелец жизни редактора (#3400).
 *
 * Экран вкладки остаётся смонтированным, пока пользователь ходит по сайту его
 * же кнопками и вкладками: вернувшись, он видит набранное. Тот же механизм
 * держал форму и после явного выхода из мастера — в памяти оставались
 * отброшенные правки, автосохранение скрытой формы отправляло их на сервер, а
 * повторное «Редактировать» открывало прежнее состояние без загрузки статьи.
 *
 * Сессия — это всё поддерево редактора: форма, ключ загрузки, автосохранение,
 * шаг мастера, диалоги. Завершение не сбрасывает их по одному, а размонтирует
 * поддерево, когда экран ушёл из фокуса; следующий вход монтирует новое и
 * читает статью с сервера. Пока экран в фокусе, поддерево живёт: несостоявшийся
 * переход не оставит пустой экран.
 */
export function EditorSession({ children }: { children: ReactNode }) {
  const isFocused = useIsFocused();
  const [phase, setPhase] = useState<Phase>('active');

  if (phase === 'ending' && !isFocused) setPhase('ended');
  else if (phase === 'ended' && isFocused) setPhase('active');

  const end = useCallback(() => {
    setPhase((current) => (current === 'active' ? 'ending' : current));
  }, []);

  return (
    <EditorSessionContext.Provider value={end}>
      {phase === 'ended' ? null : children}
    </EditorSessionContext.Provider>
  );
}

/** Завершить сессию редактора: вызывается при явном выходе из мастера. */
export function useEndEditorSession(): () => void {
  return useContext(EditorSessionContext) ?? noop;
}
