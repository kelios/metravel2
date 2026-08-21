import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import TripRouteFilePicker from '@/components/trips/planning/TripRouteFilePicker.web';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: false }),
}));
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ text: '#111111' }),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const renderPicker = (overrides: Record<string, unknown> = {}) => {
  const props = {
    label: 'Load track (GPX/KML)',
    maxBytes: 100,
    onPicked: jest.fn(),
    onError: jest.fn(),
    onBusyChange: jest.fn(),
    ...overrides,
  };
  const result = render(<TripRouteFilePicker {...props} />);
  return { ...result, props };
};

describe('TripRouteFilePicker web adapter', () => {
  it('exposes a labelled GPX/KML input and opens it from the tool action', () => {
    const { container } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = jest.spyOn(input, 'click').mockImplementation(() => undefined);

    expect(input.accept).toBe('.gpx,.kml');
    expect(input.getAttribute('aria-label')).toBe('Load track (GPX/KML)');

    fireEvent.click(screen.getByRole('button', { name: 'Load track (GPX/KML)' }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('reads a selected file locally and reports balanced busy state', async () => {
    const { container, props } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = {
      name: 'weekend.gpx',
      size: 42,
      text: jest.fn().mockResolvedValue('<gpx />'),
    };

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(props.onPicked).toHaveBeenCalledWith({
        name: 'weekend.gpx',
        size: 42,
        text: '<gpx />',
      });
    });
    expect(file.text).toHaveBeenCalledTimes(1);
    expect(props.onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(props.onError).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before reading it', async () => {
    const { container, props } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = { name: 'huge.gpx', size: 101, text: jest.fn() };

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(props.onError).toHaveBeenCalledWith('tooLarge'));
    expect(file.text).not.toHaveBeenCalled();
    expect(props.onPicked).not.toHaveBeenCalled();
    expect(props.onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it('ignores a stale read when a newer file finishes first', async () => {
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    const { container, props } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [{ name: 'old.gpx', size: 10, text: () => firstRead.promise }] },
    });
    fireEvent.change(input, {
      target: { files: [{ name: 'new.kml', size: 11, text: () => secondRead.promise }] },
    });

    await act(async () => {
      secondRead.resolve('<kml />');
      await secondRead.promise;
    });
    await waitFor(() => expect(props.onPicked).toHaveBeenCalledTimes(1));

    await act(async () => {
      firstRead.resolve('<gpx />');
      await firstRead.promise;
    });

    expect(props.onPicked).toHaveBeenCalledWith({
      name: 'new.kml',
      size: 11,
      text: '<kml />',
    });
    expect(props.onBusyChange.mock.calls.filter(([busy]) => busy === false)).toHaveLength(1);
  });

  it('treats chooser cancellation as a no-op', () => {
    const { container, props } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });

    expect(props.onPicked).not.toHaveBeenCalled();
    expect(props.onError).not.toHaveBeenCalled();
    expect(props.onBusyChange).not.toHaveBeenCalled();
  });
});
