/**
 * Компактное форматирование `ReactTestInstance` в сообщениях `expect` (#2735).
 *
 * Без `toJSON` pretty-format обходит весь граф fiber (`_fiber.return/child/_debugOwner…`): под
 * Jest 30 одно упавшее `expect(queryByTestId(…)).toBeNull()` форматируется ~0,7 с. Внутри
 * `waitFor` каждая неудачная проба синхронно занимает event loop, и React Query/рендер не
 * успевают обновиться до таймаута. С `toJSON` экземпляр печатается как узел test-renderer
 * (`<View testID="…" />`) за миллисекунды, а сообщение о провале становится читаемым.
 */
import React from 'react'
import TestRenderer from 'react-test-renderer'

type TestInstance = { type: string | { displayName?: string; name?: string }; props: Record<string, unknown> }

export function installCompactTestInstanceFormat(): void {
  let renderer: TestRenderer.ReactTestRenderer | undefined
  TestRenderer.act(() => {
    renderer = TestRenderer.create(React.createElement('View'))
  })
  const proto = Object.getPrototypeOf(renderer!.root) as Record<string, unknown>
  TestRenderer.act(() => renderer!.unmount())
  if (typeof proto.toJSON === 'function') return

  Object.defineProperty(proto, 'toJSON', {
    configurable: true,
    value(this: TestInstance) {
      const { children: _children, ...props } = this.props
      return {
        $$typeof: Symbol.for('react.test.json'),
        type: typeof this.type === 'string' ? this.type : this.type?.displayName ?? this.type?.name ?? 'Unknown',
        props,
        children: null,
      }
    },
  })
}
