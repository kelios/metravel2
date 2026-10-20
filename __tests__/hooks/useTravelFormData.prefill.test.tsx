import { act, renderHook } from '@testing-library/react-native';
import { useTravelFormData } from '@/hooks/useTravelFormData';
import { saveFormData } from '@/api/misc';
import { fetchTravel } from '@/api/travelsApi';

jest.mock('@/api/misc', () => ({
  saveFormData: jest.fn(async (data) => ({ ...data, id: 100 })),
  saveTravelContent: jest.fn(), uploadImage: jest.fn(),
}));
jest.mock('@/api/travelsApi', () => ({ fetchTravel: jest.fn() }));

const defaults = {
  travelId: null, isNew: true, userId: '42', isSuperAdmin: false,
  isAuthenticated: true, authReady: true,
};
const seed = { name: 'Краков', countries: ['616'] };

describe('article wizard initial prefill', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.useRealTimers(); });
  const tick = async () => { await act(async () => { await jest.advanceTimersByTimeAsync(6000); }); };

  it('waits for the initial catalog, creates a pristine baseline and never saves merely by opening', async () => {
    const { result, rerender } = renderHook(
      ({ pending, prefill }) => useTravelFormData({ ...defaults, prefillPending: pending, initialPrefill: prefill }),
      { initialProps: { pending: true, prefill: null as typeof seed | null }, concurrentRoot: false },
    );
    expect(result.current.isInitialLoading).toBe(true);
    await tick();
    expect(saveFormData).not.toHaveBeenCalled();
    rerender({ pending: false, prefill: seed });
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.formData).toMatchObject({ name: 'Краков', countries: ['616'], description: '', coordsMeTravel: [], gallery: [] });
    expect(result.current.formState.isDirty).toBe(false);
    expect(result.current.hasUserInteracted).toBe(false);
    expect(result.current.autosave.hasUnsavedChanges).toBe(false);
    await tick();
    expect(saveFormData).not.toHaveBeenCalled();

    act(() => result.current.setFormData((previous) => ({ ...previous, name: 'Моя поездка' })));
    await tick();
    expect(saveFormData).toHaveBeenCalledTimes(1);
    expect((saveFormData as jest.Mock).mock.calls[0][0]).toMatchObject({ name: 'Моя поездка', countries: ['616'] });
    expect((saveFormData as jest.Mock).mock.calls[0][0]).not.toHaveProperty('source_travel_id');
  });

  it('keeps edits and recovered data when later context, catalog or locale changes', () => {
    const { result, rerender } = renderHook(
      ({ prefill }) => useTravelFormData({ ...defaults, initialPrefill: prefill }),
      { initialProps: { prefill: seed }, concurrentRoot: false },
    );
    act(() => result.current.setFormData((previous) => ({
      ...previous, name: 'Восстановленный черновик', countries: ['112'], description: 'Свой текст',
    })));
    rerender({ prefill: { name: 'Чужое место', countries: ['999'] } });
    expect(result.current.formData).toMatchObject({
      name: 'Восстановленный черновик', countries: ['112'], description: 'Свой текст',
    });
  });

  it('releases the form after a catalog failure without inventing a selected country', async () => {
    const { result, rerender } = renderHook(
      ({ pending, prefill }) => useTravelFormData({ ...defaults, prefillPending: pending, initialPrefill: prefill }),
      { initialProps: { pending: true, prefill: null as typeof seed | null }, concurrentRoot: false },
    );
    rerender({ pending: false, prefill: { name: 'Краков', countries: [] } });
    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.formData.countries).toEqual([]);
    expect(result.current.formData.name).toBe('Краков');
    await tick();
    expect(saveFormData).not.toHaveBeenCalled();
  });

  it('ignores a new source arriving over an already mounted ordinary editor', () => {
    const { result, rerender } = renderHook(
      ({ prefill }) => useTravelFormData({ ...defaults, initialPrefill: prefill }),
      { initialProps: { prefill: null as typeof seed | null }, concurrentRoot: false },
    );
    act(() => result.current.setFormData((previous) => ({ ...previous, name: 'Собственное начало' })));
    rerender({ prefill: seed });
    expect(result.current.formData.name).toBe('Собственное начало');
    expect(result.current.formData.countries).toEqual([]);
  });

  it('never seeds an existing article', async () => {
    (fetchTravel as jest.Mock).mockResolvedValue({
      id: 321, name: 'Существующая статья', countries: [112], description: 'Авторский текст', userIds: '42',
    });
    const { result } = renderHook(() => useTravelFormData({
      ...defaults, travelId: '321', isNew: false, initialPrefill: seed,
    }), { concurrentRoot: false });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.formData).toMatchObject({ name: 'Существующая статья', countries: ['112'], description: 'Авторский текст' });
    await tick();
    expect(saveFormData).not.toHaveBeenCalled();
  });
});
