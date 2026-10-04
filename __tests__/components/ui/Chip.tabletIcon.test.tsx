import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import Chip from '@/components/ui/Chip';

let mockWidth = 0;

jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ width: mockWidth }),
}));

const renderChip = () =>
  render(
    <Chip
      label="Организую"
      icon={<Text>i</Text>}
      iconVisibility="fromTablet"
      iconSlotSize={15}
      testID="segment"
    />,
  );

// #2157: иконка «от планшета» — узел есть всегда, видимость из реестра CHIP_LAYOUT,
// бокс фиксирован. Условный icon={isMobile ? undefined : …} расширял чип после гидратации.
describe('Chip iconVisibility="fromTablet"', () => {
  it('keeps the icon node in the zero-width frame, hidden until critical CSS shows it', () => {
    mockWidth = 0;
    const slot = StyleSheet.flatten(renderChip().getByTestId('segment-icon', { includeHiddenElements: true }).props.style);
    expect(slot).toMatchObject({ display: 'none', width: 15, height: 15 });
  });

  it('hides the icon on a phone and shows it from the tablet width', () => {
    mockWidth = 390;
    expect(StyleSheet.flatten(renderChip().getByTestId('segment-icon', { includeHiddenElements: true }).props.style)).toMatchObject({ display: 'none' });
    mockWidth = 800;
    expect(StyleSheet.flatten(renderChip().getByTestId('segment-icon', { includeHiddenElements: true }).props.style)).toMatchObject({ display: 'flex', width: 15 });
  });

  it('leaves regular chips without a breakpoint display style', () => {
    mockWidth = 390;
    const { getByTestId } = render(<Chip label="Фильтр" icon={<Text>i</Text>} testID="filter" />);
    expect(StyleSheet.flatten(getByTestId('filter-icon').props.style).display).toBeUndefined();
  });
});
