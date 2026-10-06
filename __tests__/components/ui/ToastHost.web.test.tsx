import { act, fireEvent, render } from '@testing-library/react';

import ToastHost from '@/components/ui/ToastHost.web';
import { WEB_TOAST_EVENT_NAME } from '@/utils/toast.web';

describe('ToastHost (web)', () => {
  it('does not let the global #root min-height:100vh stretch the toast container', async () => {
    // jsdom cannot parse CSS var() dimensions; retain the actual style assignment.
    const bottomAssignment = jest.spyOn(CSSStyleDeclaration.prototype, 'bottom', 'set');
    const { container } = render(<ToastHost />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(WEB_TOAST_EVENT_NAME, {
          detail: { type: 'success', text1: 'Сохранено' },
        })
      );
    });

    const host = container.querySelector('div[role="status"]') as HTMLElement | null;
    expect(host).toBeTruthy();
    // Regression: a global rule `#root, #root > div, #root > div > div { min-height: 100vh }`
    // matched the fixed toast container and stretched it to full height, pushing the card to
    // the top of the screen (behind the header). The host must opt out of that min-height so it
    // sizes to the card and stays at the bottom edge.
    expect(host?.style.minHeight).toBe('0');
    expect(host?.style.position).toBe('fixed');
    expect(bottomAssignment).toHaveBeenCalledWith('calc(var(--mt-dock-h, 0px) + 16px)');
    bottomAssignment.mockRestore();
  });

  it('renders an action button («Отменить») that runs the action', () => {
    const onPress = jest.fn();
    const { container } = render(<ToastHost />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(WEB_TOAST_EVENT_NAME, {
          detail: { type: 'success', text1: 'Добавлено в избранное', action: { label: 'Отменить', onPress } },
        })
      );
    });

    const button = container.querySelector('[data-testid="toast-action"]') as HTMLElement;
    expect(button.textContent).toBe('Отменить');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no action button when none is passed', () => {
    const { container } = render(<ToastHost />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent(WEB_TOAST_EVENT_NAME, { detail: { type: 'info', text1: 'Готово' } })
      );
    });
    expect(container.querySelector('[data-testid="toast-action"]')).toBeNull();
  });
});
