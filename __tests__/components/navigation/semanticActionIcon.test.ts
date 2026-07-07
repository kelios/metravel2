import { SEMANTIC_ACTION_ICON } from '@/components/navigation/navigationActionMeta';

// #842 — три семантические роли действий должны иметь визуально РАЗЛИЧИМЫЕ иконки,
// чтобы Telegram/share, «Маршрут» и «Навигация» не читались как три одинаковые стрелки.
describe('SEMANTIC_ACTION_ICON', () => {
  it('maps each role to a stable Feather glyph', () => {
    expect(SEMANTIC_ACTION_ICON.telegramShare).toBe('send');
    expect(SEMANTIC_ACTION_ICON.buildRoute).toBe('corner-up-right');
    expect(SEMANTIC_ACTION_ICON.navigationMenu).toBe('compass');
  });

  it('gives every role a distinct icon', () => {
    const icons = Object.values(SEMANTIC_ACTION_ICON);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
