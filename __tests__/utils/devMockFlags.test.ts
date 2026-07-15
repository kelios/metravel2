import { resolveDevMockFlag } from '@/utils/devMockFlags';
import fs from 'node:fs';
import path from 'node:path';

describe('resolveDevMockFlag', () => {
  it('allows an explicit mock only in development', () => {
    expect(resolveDevMockFlag({ name: 'FLAG', value: 'true', isDev: true })).toBe(true);
    expect(resolveDevMockFlag({ name: 'FLAG', value: '1', isDev: true })).toBe(true);
    expect(resolveDevMockFlag({ name: 'FLAG', value: 'false', isDev: true })).toBe(false);
  });

  it('rejects a production mock configuration', () => {
    expect(() =>
      resolveDevMockFlag({ name: 'FLAG', value: 'true', isDev: false }),
    ).toThrow('FLAG=true is forbidden in production');
    expect(() =>
      resolveDevMockFlag({ name: 'FLAG', value: '1', isDev: false }),
    ).toThrow('FLAG=true is forbidden in production');
  });

  it('supports development-only default fixtures without enabling production mocks', () => {
    expect(
      resolveDevMockFlag({ name: 'FLAG', value: undefined, defaultInDev: true, isDev: true }),
    ).toBe(true);
    expect(
      resolveDevMockFlag({ name: 'FLAG', value: undefined, defaultInDev: true, isDev: false }),
    ).toBe(false);
  });

  it('routes every production-visible API mock flag through the fail-closed guard', () => {
    const apiDir = path.resolve(__dirname, '../../api');
    const offenders = fs
      .readdirSync(apiDir)
      .filter((fileName) => fileName.endsWith('.ts'))
      .filter((fileName) => {
        const source = fs.readFileSync(path.join(apiDir, fileName), 'utf8');
        return (
          /process\.env\.EXPO_PUBLIC_[A-Z0-9_]*MOCK/.test(source) &&
          !source.includes('resolveDevMockFlag')
        );
      });

    expect(offenders).toEqual([]);
  });
});
