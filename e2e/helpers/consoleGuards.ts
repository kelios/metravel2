import { expect } from '@playwright/test';

export function installNoConsoleErrorsGuard(page: any) {
  const errors: string[] = [];

  page.on('pageerror', (err: any) => {
    const msg = String(err?.message ?? err ?? '');
    errors.push(msg);
  });

  page.on('console', (msg: any) => {
    try {
      const type = msg.type?.() ?? msg.type;
      if (type !== 'error') return;
      const text = msg.text?.() ?? String(msg);
      errors.push(text);
    } catch {
      // ignore
    }
  });

  return {
    assertNoErrorsContaining: (needle: string) => {
      const hit = errors.find((e) => e.includes(needle));
      expect(hit, `Console/pageerror must not include: ${needle}\nAll errors: ${errors.join('\n---\n')}`).toBeFalsy();
    },
  };
}
