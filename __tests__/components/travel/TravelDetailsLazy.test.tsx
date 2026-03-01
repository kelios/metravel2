/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

import { withLazy } from '@/components/travel/details/TravelDetailsLazy';

describe('withLazy', () => {
  it('renders fallback component when lazy import has invalid default export', async () => {
    const BrokenLazy = withLazy(async () => ({
      default: undefined as unknown as React.ComponentType<any>,
    }));

    const screen = render(
      <Suspense fallback={<Text>Loading…</Text>}>
        <BrokenLazy />
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByText('Component failed to load')).toBeTruthy();
    });
  });

  it('renders lazy component when default export is valid', async () => {
    const WorkingLazy = withLazy(async () => ({
      default: () => <Text>Lazy loaded content</Text>,
    }));

    const screen = render(
      <Suspense fallback={<Text>Loading…</Text>}>
        <WorkingLazy />
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByText('Lazy loaded content')).toBeTruthy();
    });
  });
});
