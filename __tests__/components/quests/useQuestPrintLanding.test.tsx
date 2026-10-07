// #2318: адрес печатной версии квеста из письма (`?print=1`) открывает ту же
// печатную версию, что кнопка «Печать», — в этой вкладке, один раз, без попапа.
import { renderHook, waitFor } from '@testing-library/react-native';

const mockGeneratePrintableQuest = jest.fn();
const mockNotifyQuest = jest.fn();

jest.mock('@/components/quests/QuestPrintable', () => ({
  generatePrintableQuest: (...args: unknown[]) => mockGeneratePrintableQuest(...args),
}));
jest.mock('@/components/quests/questWizardHelpers', () => ({
  notifyQuest: (...args: unknown[]) => mockNotifyQuest(...args),
}));

import {
  isQuestPrintRequested,
  useQuestPrintLanding,
} from '@/components/quests/hooks/useQuestPrintLanding';
import type { FrontendQuestBundle } from '@/utils/questAdapters';

const QUEST_URL = 'https://metravel.by/quests/4/minsk-cinema';

const bundle = {
  id: 4,
  questId: 'minsk-cinema',
  title: 'Минск в кадре',
  steps: [{ id: 's1', title: 'Октябрьская' }],
  intro: { id: 'intro', title: 'Старт' },
  finale: { text: 'Финал' },
  coverUrl: 'https://cdn.example/cover.jpg',
  tags: ['loop'],
} as unknown as FrontendQuestBundle;

describe('useQuestPrintLanding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGeneratePrintableQuest.mockResolvedValue('printed');
  });

  it.each([
    ['1', true],
    ['true', true],
    [['1'], true],
    ['0', false],
    [undefined, false],
  ])('isQuestPrintRequested(%p) = %p', (value, expected) => {
    expect(isQuestPrintRequested(value as string | string[] | undefined)).toBe(expected);
  });

  it('ждёт загрузки квеста и открывает печатную версию в этой вкладке один раз', async () => {
    const { rerender } = renderHook(
      ({ current }: { current: FrontendQuestBundle | null }) =>
        useQuestPrintLanding({ enabled: true, bundle: current, questUrl: QUEST_URL }),
      { initialProps: { current: null as FrontendQuestBundle | null } },
    );
    expect(mockGeneratePrintableQuest).not.toHaveBeenCalled();

    rerender({ current: bundle });
    rerender({ current: { ...bundle } as FrontendQuestBundle });

    await waitFor(() => expect(mockGeneratePrintableQuest).toHaveBeenCalledTimes(1));
    const [props, options] = mockGeneratePrintableQuest.mock.calls[0];
    expect(options).toMatchObject({ inPlace: true });
    expect(options.signal.aborted).toBe(false);
    expect(props).toMatchObject({
      closeLoop: true,
      title: 'Минск в кадре',
      steps: bundle.steps,
      intro: bundle.intro,
      coverUrl: bundle.coverUrl,
      questUrl: QUEST_URL,
      finaleText: 'Финал',
    });
  });

  it('ждёт тегов квеста: без них кольцевой маршрут напечатался бы незамкнутым', async () => {
    const pending = { ...bundle, tags: undefined } as FrontendQuestBundle;
    const { rerender } = renderHook(
      ({ current }: { current: FrontendQuestBundle }) =>
        useQuestPrintLanding({ enabled: true, bundle: current, questUrl: QUEST_URL }),
      { initialProps: { current: pending } },
    );
    expect(mockGeneratePrintableQuest).not.toHaveBeenCalled();

    rerender({ current: bundle });
    await waitFor(() => expect(mockGeneratePrintableQuest).toHaveBeenCalledTimes(1));
    expect(mockGeneratePrintableQuest.mock.calls[0][0].closeLoop).toBe(true);
  });

  it('bundle failure never starts print; a later ordinary retry result remains eligible without auto-retry', async () => {
    const { rerender } = renderHook(
      ({ current }: { current: FrontendQuestBundle | null }) =>
        useQuestPrintLanding({ enabled: true, bundle: current, questUrl: QUEST_URL }),
      { initialProps: { current: null as FrontendQuestBundle | null } },
    );
    rerender({ current: null });
    await waitFor(() => expect(mockGeneratePrintableQuest).not.toHaveBeenCalled());
    expect(mockNotifyQuest).not.toHaveBeenCalled();
    rerender({ current: bundle });
    await waitFor(() => expect(mockGeneratePrintableQuest).toHaveBeenCalledTimes(1));
    expect(mockGeneratePrintableQuest.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it('уход с экрана во время сборки отменяет запись печатной версии', async () => {
    mockGeneratePrintableQuest.mockReturnValue(new Promise(() => {}));
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuestPrintLanding({ enabled, bundle, questUrl: QUEST_URL }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(mockGeneratePrintableQuest).toHaveBeenCalledTimes(1));
    const { signal } = mockGeneratePrintableQuest.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    rerender({ enabled: false });
    expect(signal.aborted).toBe(true);
    unmount();
  });

  it('без ?print=1 ничего не печатает', () => {
    renderHook(() => useQuestPrintLanding({ enabled: false, bundle, questUrl: QUEST_URL }));
    expect(mockGeneratePrintableQuest).not.toHaveBeenCalled();
  });

  it('печатать нечем — сообщает, а не молчит', async () => {
    mockGeneratePrintableQuest.mockResolvedValue('unavailable');
    renderHook(() => useQuestPrintLanding({ enabled: true, bundle, questUrl: QUEST_URL }));
    await waitFor(() => expect(mockNotifyQuest).toHaveBeenCalledTimes(1));
  });
});
