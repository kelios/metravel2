import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { MarkerData } from '@/types/types';

jest.mock('@/components/forms/MultiSelectField', () => {
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => <View {...props} />;
});
jest.mock('@/components/travel/PhotoUploadWithPreview', () => () => null);
jest.mock('@/components/ui/ToastHost', () => {
  const { View } = require('react-native');
  return (props: Record<string, unknown>) => <View {...props} testID="point-editor-toast-host" />;
});
jest.mock('@/api/misc', () => ({ createPointCategory: jest.fn() }));
jest.mock('@/utils/pointCategoryDictionaryQuery', () => ({ requestPointCategoryDictionaryRefresh: jest.fn() }));

import PointEditorSheet from '@/components/travel/stepRoute/PointEditorSheet';

const marker: MarkerData = { id: null, lat: 53.9, lng: 27.5, country: null, address: 'Original', categories: [1], image: null };
const props = { visible: true, marker, index: 0, categoryTravelAddress: [], onSave: jest.fn(), onRemove: jest.fn(), onClose: jest.fn() };

describe('PointEditorSheet draft identity', () => {
  it('hosts upload feedback inside the native modal above its content', () => {
    const screen = render(<PointEditorSheet {...props} marker={{ ...marker, id: 42 }} />);
    expect(screen.getByTestId('point-editor-toast-host').props.overDock).toBe(false);
    screen.rerender(<PointEditorSheet {...props} visible={false} />);
    expect(screen.queryByTestId('point-editor-toast-host')).toBeNull();
  });

  it('preserves address and categories when the parent assigns an id to the open point', () => {
    const screen = render(<PointEditorSheet {...props} />);
    fireEvent.changeText(screen.getByTestId('travel-wizard.point-editor.address'), 'Draft address');
    fireEvent(screen.getByTestId('travel-wizard.point-editor.categories'), 'onChange', ['2']);
    screen.rerender(<PointEditorSheet {...props} marker={{ ...marker, id: 42 }} />);
    expect(screen.getByTestId('travel-wizard.point-editor.address').props.value).toBe('Draft address');
    expect(screen.getByTestId('travel-wizard.point-editor.categories').props.value).toEqual(['2']);
  });

  it.each([{ index: 1, id: 42 }, { index: 0, id: 99 }])('initializes another point at index $index with id $id', ({ index, id }) => {
    const screen = render(<PointEditorSheet {...props} marker={{ ...marker, id: 42 }} />);
    fireEvent.changeText(screen.getByTestId('travel-wizard.point-editor.address'), 'Draft address');
    screen.rerender(<PointEditorSheet {...props} index={index} marker={{ ...marker, id, address: 'Another', categories: [3] }} />);
    expect(screen.getByTestId('travel-wizard.point-editor.address').props.value).toBe('Another');
    expect(screen.getByTestId('travel-wizard.point-editor.categories').props.value).toEqual(['3']);
  });

  it('initializes the current data after closing and reopening the same point', () => {
    const screen = render(<PointEditorSheet {...props} />);
    fireEvent.changeText(screen.getByTestId('travel-wizard.point-editor.address'), 'Draft address');
    screen.rerender(<PointEditorSheet {...props} visible={false} />);
    screen.rerender(<PointEditorSheet {...props} marker={{ ...marker, address: 'Reopened' }} />);
    expect(screen.getByTestId('travel-wizard.point-editor.address').props.value).toBe('Reopened');
  });
});
