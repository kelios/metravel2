/**
 * #2120 / MODAL-TOP-INSET-001: шапка редактора точки маршрута лежит внутри
 * ModalSafeArea, а не нативного SafeAreaView (на iOS тот даёт верх 0 в Modal).
 */
import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('@/components/forms/MultiSelectField', () => () => null);
jest.mock('@/components/travel/PhotoUploadWithPreview', () => () => null);
jest.mock('@/components/ui/ToastHost', () => () => null);
jest.mock('@/api/misc', () => ({ createPointCategory: jest.fn() }));
jest.mock('@/utils/pointCategoryDictionaryQuery', () => ({ requestPointCategoryDictionaryRefresh: jest.fn() }));

import PointEditorSheet from '@/components/travel/stepRoute/PointEditorSheet';

const marker = { lat: 53.89787, lng: 27.55371, address: 'Галерея', categories: [], image: null } as any;

describe('PointEditorSheet safe area', () => {
  it('keeps the header and the close button inside ModalSafeArea', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <PointEditorSheet
        visible
        marker={marker}
        index={0}
        categoryTravelAddress={[]}
        onSave={jest.fn()}
        onRemove={jest.fn()}
        onClose={onClose}
      />,
    );

    const safeArea = getByTestId('point-editor-safe-area');
    const close = within(safeArea).getByTestId('travel-wizard.point-editor.close');
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
