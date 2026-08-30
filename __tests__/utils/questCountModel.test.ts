import type { ApiQuestBundle, ApiQuestStep } from '@/api/quests';
import { formatQuestMapPointTitle } from '@/components/quests/questMapPoints';
import {
  buildQuestOfflineMapGeoJSON,
  buildQuestOfflineMapGpx,
} from '@/components/quests/questOfflineMapExport';
import { adaptBundle } from '@/utils/questAdapters';
import { getQuestProgressSteps, getQuestRouteGateSteps } from '@/utils/questCountModel';

const makeApiStep = (
  order: number,
  pointRole?: ApiQuestStep['point_role'],
  answerType = 'exact',
): ApiQuestStep => ({
  id: order,
  step_id: `point-${order}`,
  title: `Точка ${order}`,
  location: `Место ${order}`,
  story: `История ${order}`,
  task: `Задание ${order}`,
  answer_pattern: { type: answerType, value: answerType === 'any' ? '' : `ответ-${order}` },
  lat: 53.9 + order / 1000,
  lng: 27.56 + order / 1000,
  maps_url: `https://maps.example/${order}`,
  order,
  point_role: pointRole,
});

const makeBundle = (steps: ApiQuestStep[]): ApiQuestBundle => ({
  id: 4,
  quest_id: 'minsk-cmok',
  title: 'Квест по центру Минска: в поисках цмока',
  storage_key: 'quest_minsk_cmok_v1',
  city: { id: 4, name: 'Минск', lat: 53.9045, lng: 27.5615, country_code: 'by' },
  intro: {
    ...makeApiStep(0, 'start', 'any'),
    step_id: 'intro',
    is_intro: true,
  },
  steps,
  finale: { text: 'Финал', video_url: null, poster_url: null },
});

describe('questCountModel #1614', () => {
  it('normalizes the Minsk fixture without deriving optional/final roles from prose or answer type', () => {
    const bundle = adaptBundle(makeBundle([
      makeApiStep(1, 'required', 'any_text'),
      makeApiStep(2, 'required'),
      makeApiStep(3, 'required'),
      makeApiStep(4, 'required'),
      makeApiStep(5, 'required'),
      { ...makeApiStep(6, 'optional', 'any'), title: 'Кофе-пауза' },
      { ...makeApiStep(7, 'optional', 'any'), title: 'Смотровая площадка' },
      makeApiStep(8, 'required'),
      { ...makeApiStep(9, 'final', 'any'), title: 'Последний артефакт' },
    ]));

    expect(bundle.countModel).toEqual({
      total: 9,
      required: 6,
      optional: 2,
      start: 1,
      final: 1,
      progressTotal: 6,
      source: 'explicit',
    });
    expect(getQuestProgressSteps(bundle.steps, bundle.countModel).map((step) => step.id))
      .toEqual(['point-1', 'point-2', 'point-3', 'point-4', 'point-5', 'point-8']);
    expect(getQuestRouteGateSteps(bundle.steps, bundle.countModel).map((step) => step.id))
      .toEqual(['point-1', 'point-2', 'point-3', 'point-4', 'point-5', 'point-8', 'point-9']);
  });

  it('keeps zero optional points explicit for a control quest without optional stops', () => {
    const bundle = adaptBundle(makeBundle([
      makeApiStep(1, 'required'),
      makeApiStep(2, 'required'),
      makeApiStep(3, 'required'),
      makeApiStep(4, 'final', 'any'),
    ]));

    expect(bundle.countModel).toMatchObject({
      total: 4,
      required: 3,
      optional: 0,
      start: 1,
      final: 1,
      progressTotal: 3,
      source: 'explicit',
    });
  });

  it('uses a neutral fallback when live payload roles are incomplete', () => {
    const bundle = adaptBundle(makeBundle([
      makeApiStep(1, undefined, 'exact'),
      makeApiStep(2, undefined, 'any'),
      makeApiStep(3, undefined, 'any'),
    ]));

    expect(bundle.countModel).toEqual({
      total: 3,
      required: null,
      optional: null,
      start: 1,
      final: null,
      progressTotal: 3,
      source: 'fallback',
    });
    expect(bundle.steps.every((step) => step.pointRole == null)).toBe(true);
    expect(getQuestProgressSteps(bundle.steps, bundle.countModel).map((step) => step.id))
      .toEqual(['point-1', 'point-2', 'point-3']);
  });

  it('clears partial canonical roles atomically instead of leaking semantic labels', () => {
    const bundle = adaptBundle(makeBundle([
      makeApiStep(1, 'required'),
      makeApiStep(2, undefined, 'any'),
      makeApiStep(3, 'final', 'any'),
    ]));

    expect(bundle.countModel.source).toBe('fallback');
    expect(bundle.steps.every((step) => step.pointRole == null)).toBe(true);
  });

  it('rejects start as a numbered-point role instead of publishing inconsistent counts', () => {
    const bundle = adaptBundle(makeBundle([
      makeApiStep(1, 'start'),
      makeApiStep(2, 'required'),
    ]));

    expect(bundle.countModel).toMatchObject({
      total: 2,
      required: null,
      optional: null,
      final: null,
      progressTotal: 2,
      source: 'fallback',
    });
  });

  it('does not normalize a non-canonical role string into a semantic role', () => {
    const invalid = makeApiStep(1);
    invalid.point_role = ' REQUIRED ' as ApiQuestStep['point_role'];

    const bundle = adaptBundle(makeBundle([invalid]));
    expect(bundle.steps[0].pointRole).toBeUndefined();
    expect(bundle.countModel.source).toBe('fallback');
  });

  it('keeps canonical role labels aligned across map, GPX and GeoJSON exports', () => {
    const steps = [
      { lat: 53.9, lng: 27.56, title: 'Ратуша', pointRole: 'required' as const },
      { lat: 53.91, lng: 27.57, title: 'Финиш', pointRole: 'final' as const },
    ];

    expect(formatQuestMapPointTitle(steps[0])).toBe('Ратуша · Обязательная точка');

    const gpx = buildQuestOfflineMapGpx({ title: 'Квест', steps });
    expect(gpx.content).toContain('<name>Ратуша · Обязательная точка</name>');
    expect(gpx.content).toContain('<name>Финиш · Финальная точка</name>');

    const geoJson = JSON.parse(buildQuestOfflineMapGeoJSON({ title: 'Квест', steps }));
    const pointFeatures = geoJson.features.filter(
      (feature: { geometry: { type: string } }) => feature.geometry.type === 'Point',
    );
    expect(pointFeatures.map((feature: { properties: object }) => feature.properties)).toEqual([
      { order: 1, title: 'Ратуша · Обязательная точка', pointRole: 'required' },
      { order: 2, title: 'Финиш · Финальная точка', pointRole: 'final' },
    ]);
  });
});
