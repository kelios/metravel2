import React from 'react';
import { ActivityIndicator, StyleSheet, Text as RNText } from 'react-native';
import { render } from '@testing-library/react-native';

import * as PaperShim from '@/ui/paper.web';
import { Button } from '@/ui/paper.web';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// #1663: предыдущий тест шима (`paper.web.props.test.tsx`) пинил только проброс
// пропа до узла. Этого мало: `mode`, `icon` и `loading` доходили до тела
// компонента и там терялись — проп «доставлен», а нарисовать его было нечем.
// Поэтому здесь проверяется ВИДИМЫЙ результат: реальные цвета, рамка, отступы
// и наличие узлов, а не факт передачи. Импорт по явному пути `@/ui/paper.web`,
// потому что jest резолвит `@/ui/paper` по платформе `ios`.
const resolveStyle = (node: any) => {
  const raw = node.props.style;
  const resolved = typeof raw === 'function' ? raw({ pressed: false, hovered: false }) : raw;
  return StyleSheet.flatten(resolved) ?? {};
};

describe('ui/paper.web visible behaviour', () => {
  it('renders three distinct fills for the three paper modes', () => {
    const byMode = (['contained', 'outlined', 'text'] as const).map((mode) => {
      const { getByTestId } = render(
        <Button testID="cta" mode={mode}>
          Сохранить
        </Button>,
      );
      return [mode, resolveStyle(getByTestId('cta'))] as const;
    });

    const styleOf = (mode: string) => byMode.find(([m]) => m === mode)![1] as any;

    expect(styleOf('contained').backgroundColor).toBe(DESIGN_TOKENS.colors.primary);
    expect(styleOf('outlined').backgroundColor).toBe('transparent');
    expect(styleOf('outlined').borderColor).toBe(DESIGN_TOKENS.colors.primary);
    expect(styleOf('text').backgroundColor).toBe('transparent');
    expect(styleOf('text').borderColor).toBe('transparent');
  });

  // Порядок в массиве стилей — контракт, а не деталь реализации: `accountconfirmation`
  // и кнопка предпросмотра в `FiltersUpsertComponent` кладут собственную заливку
  // поверх режима. Уедет стиль вызывающего ВЫШЕ `buttonModeStyles` — обе кнопки
  // молча получат чужой фон, и это опять будет незаметно до браузера.
  it('keeps the caller style above the mode fill', () => {
    const { getByTestId } = render(
      <Button testID="cta" mode="outlined" style={{ backgroundColor: '#123456' }}>
        Предпросмотр
      </Button>,
    );

    expect((resolveStyle(getByTestId('cta')) as any).backgroundColor).toBe('#123456');
  });

  // Гард режима существует ради значения из-за границы типов. Проверка через `in`
  // смотрела бы и прототип: `mode="toString"` прошёл бы её насквозь, и в `color`
  // лейбла с спиннером легла бы функция вместо цвета.
  it('falls back to the text mode when mode arrives from outside the type', () => {
    const { getByTestId, getByText } = render(
      <Button testID="cta" mode={'toString' as any}>
        Сохранить
      </Button>,
    );

    expect((resolveStyle(getByTestId('cta')) as any).backgroundColor).toBe('transparent');
    expect((StyleSheet.flatten(getByText('Сохранить').props.style) as any).color).toBe(
      DESIGN_TOKENS.colors.text,
    );
  });

  // ManualPointPanel переключает contained ↔ outlined как индикатор состояния
  // тоггла. Толщина рамки обязана совпадать, иначе переключение дёргает раскладку.
  it('keeps the border width stable across modes so a mode toggle cannot shift layout', () => {
    const widths = (['contained', 'outlined', 'text'] as const).map((mode) => {
      const { getByTestId } = render(<Button testID="toggle" mode={mode}>Вручную</Button>);
      return (resolveStyle(getByTestId('toggle')) as any).borderWidth;
    });

    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(1);
  });

  it('paints the label with the foreground of its mode', () => {
    const { getByText: getContained } = render(<Button mode="contained">Сохранить</Button>);
    const { getByText: getOutlined } = render(<Button mode="outlined">Предпросмотр</Button>);

    expect((StyleSheet.flatten(getContained('Сохранить').props.style) as any).color).toBe(
      DESIGN_TOKENS.colors.textOnPrimary,
    );
    expect((StyleSheet.flatten(getOutlined('Предпросмотр').props.style) as any).color).toBe(
      DESIGN_TOKENS.colors.text,
    );
  });

  it('renders the icon node and hands it the size and foreground of the mode', () => {
    const { getByTestId } = render(
      <Button
        mode="contained"
        icon={({ size, color }) => <RNText testID="cta-icon">{`${size}|${color}`}</RNText>}
      >
        Сохранить
      </Button>,
    );

    expect(getByTestId('cta-icon').props.children).toBe(
      `18|${DESIGN_TOKENS.colors.textOnPrimary}`,
    );
  });

  it('swaps the icon for a spinner while loading and marks the control busy', () => {
    const { getByTestId, queryByTestId, UNSAFE_getByType } = render(
      <Button testID="cta" loading icon={() => <RNText testID="cta-icon">иконка</RNText>}>
        Загрузка
      </Button>,
    );

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(queryByTestId('cta-icon')).toBeNull();
    expect(getByTestId('cta').props.accessibilityState?.busy).toBe(true);
  });

  it('narrows horizontal padding for compact without dropping below the 44 touch target', () => {
    const { getByTestId: getCompact } = render(<Button testID="c" compact>Добавить</Button>);
    const { getByTestId: getRegular } = render(<Button testID="r">Добавить</Button>);

    const compact = resolveStyle(getCompact('c')) as any;
    const regular = resolveStyle(getRegular('r')) as any;

    expect(compact.paddingHorizontal).toBeLessThan(regular.paddingHorizontal);
    expect(compact.minHeight).toBe(44);
    expect(compact.minWidth).toBe(44);
  });

  it('applies contentStyle to the row that holds the icon and the label', () => {
    const { getByText } = render(
      <Button contentStyle={{ paddingVertical: 10 }}>На главную</Button>,
    );

    // Ищем строку контента вверх по предкам, а не берём `.parent` вслепую:
    // форма дерева RNTL — деталь реализации, а проверяем мы стиль на узле,
    // который реально оборачивает иконку и лейбл.
    let node: any = getByText('На главную').parent;
    let contentStyle: any = null;
    while (node && !contentStyle) {
      const flat = StyleSheet.flatten(node.props?.style) as any;
      if (flat?.flexDirection === 'row') contentStyle = flat;
      node = node.parent;
    }

    expect(contentStyle).not.toBeNull();
    expect(contentStyle.paddingVertical).toBe(10);
  });

  // Заглушки `Icon` и `DataTable.Pagination` рендерили `null`. Экспорт убран,
  // места использования переведены на Feather; возврат стаба вернул бы дефект
  // молча, поэтому отсутствие проверяется тестом, а не только комментарием.
  it.each(['Icon', 'DataTable'])('no longer exports the null stub %s', (name) => {
    expect(Object.prototype.hasOwnProperty.call(PaperShim, name)).toBe(false);
  });
});
