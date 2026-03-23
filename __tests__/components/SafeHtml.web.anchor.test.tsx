import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { SafeHtml } from '../../components/article/SafeHtml';

describe('SafeHtml (web) anchor links', () => {
  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  };

  beforeEach(() => {
    setPlatformOs('web');
    window.history.replaceState(null, '', '/');
  });

  it('keeps anchor ids after sanitization and scrolls to internal hash targets on click', async () => {
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const { container } = render(
        <SafeHtml html={'<p><a href="#section-1">Перейти</a></p><h2><span id="section-1">Секция 1</span></h2>'} />
      );

      await waitFor(() => {
        expect(container.querySelector('a[href="#section-1"]')).toBeTruthy();
        expect(container.querySelector('#section-1')).toBeTruthy();
      });

      const anchor = container.querySelector('a[href="#section-1"]') as HTMLAnchorElement | null;
      expect(anchor).toBeTruthy();

      fireEvent.click(anchor!);

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(window.location.hash).toBe('#section-1');
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
