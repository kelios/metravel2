import fs from 'fs';
import path from 'path';

// #1657: `moduleSuffixes: ['.web', '.native', '']` в tsconfig перебирает
// РАСШИРЕНИЯ снаружи, а суффиксы внутри — сначала `paper.web.ts`,
// `paper.native.ts`, `paper.ts`, и только потом весь тот же ряд на `.tsx`.
// Пока `ui/paper.native.ts` был `.ts`, а `ui/paper.web.tsx` — `.tsx`, native-файл
// выигрывал на первой же стадии, и типы ВСЕХ вызовов `@/ui/paper`, включая web,
// брались из react-native-paper. Web-реализация при этом молча выбрасывала
// пропы, которых не знала, а `tsc` оставался зелёным.
//
// Возврат расширения назад воспроизведёт баг бесшумно, поэтому инвариант
// проверяется тестом, а не только комментарием в шапке обоих файлов.
describe('ui/paper platform shim (#1657)', () => {
  const uiDir = path.resolve(__dirname, '../../ui');

  const shimFiles = () =>
    fs.readdirSync(uiDir).filter((name) => /^paper\.(web|native)\.[a-z]+$/.test(name));

  it('keeps the same file extension on both platform implementations', () => {
    const extensions = shimFiles().map((name) => path.extname(name));

    expect(shimFiles().sort()).toEqual(['paper.native.tsx', 'paper.web.tsx']);
    expect(new Set(extensions).size).toBe(1);
  });

  it('has no extensionless ui/paper that would win the lookup outright', () => {
    expect(fs.existsSync(path.join(uiDir, 'paper.ts'))).toBe(false);
    expect(fs.existsSync(path.join(uiDir, 'paper.tsx'))).toBe(false);
  });
});
