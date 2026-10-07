import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { FiltersProvider, useFiltersContext } from '@/context/MapFiltersContext';
import { makeFiltersContext } from '../utils/makeFiltersContext';

function BusyProbe() {
  const { isBusy } = useFiltersContext();
  return <Text testID="busy">{String(Boolean(isBusy))}</Text>;
}

describe('FiltersProvider context memo (ST-2)', () => {
  it('propagates an isBusy change even when every other field is referentially stable', () => {
    const base = makeFiltersContext({ isBusy: true });
    const { getByTestId, rerender } = render(
      <FiltersProvider {...base}>
        <BusyProbe />
      </FiltersProvider>,
    );
    expect(getByTestId('busy').props.children).toBe('true');

    // Same callbacks, same arrays — only the loading flag flips. The previous
    // hand-written dependency list omitted `isBusy`, so consumers kept the stale
    // value and rendered the empty state while the map was still loading.
    rerender(
      <FiltersProvider {...base} isBusy={false}>
        <BusyProbe />
      </FiltersProvider>,
    );
    expect(getByTestId('busy').props.children).toBe('false');
  });

  it('keeps the context value referentially stable when nothing changed', () => {
    const seen: unknown[] = [];
    function IdentityProbe() {
      seen.push(useFiltersContext());
      return null;
    }
    const base = makeFiltersContext();
    const { rerender } = render(
      <FiltersProvider {...base}>
        <IdentityProbe />
      </FiltersProvider>,
    );
    rerender(
      <FiltersProvider {...base}>
        <IdentityProbe />
      </FiltersProvider>,
    );

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(1);
  });
});
