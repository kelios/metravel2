/**
 * #3219 (приёмка 9b8774567): до старта на странице одно число точек — в строке
 * «Бесплатно · без гида · N точек · время». Desktop-сайдбар показывал «Задания: 0 / 6»
 * и «Маршрут: 9 · …» до старта. Правило «счётчик только после старта» одно для
 * мобильной шапки и сайдбара — оно живёт в QuestProgressSummary.
 */
import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('@/components/quests/questWizardSections', () => ({ QuestCompactExcursions: () => null }))

import { QuestCompactSidebar, QuestHeaderPanel } from '@/components/quests/questWizardShell'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'
import type { QuestCountModel } from '@/utils/questCountModel'

const colors = getThemedColors(false) as any
const countModel: QuestCountModel = { total: 9, start: 1, progressTotal: 6, required: 6, optional: 2, final: 1, source: 'explicit' }
const allSteps = [{ id: 'intro', title: 'Старт' }, { id: 'step-1', title: 'Точка 1' }, { id: 'step-2', title: 'Точка 2' }]
const shared = {
  colors, title: 'Квест', progress: 0, completedCount: 0, stepsCount: 6, countModel, allSteps,
  answers: {}, postponedStepIds: new Set<string>(), showFinaleOnly: false,
  goToStep: jest.fn(), onShowFinale: jest.fn(), onReset: jest.fn(), onPrintDownload: jest.fn(),
  onOfflineMapDownload: jest.fn(), onOfflineMapOpenInApp: jest.fn(), offlineMapPointsCount: 3,
  onOfflineQuestDownload: jest.fn(), offlineQuestState: { status: 'idle' } as any,
}

describe('счётчик заданий только после старта — desktop-сайдбар и шапка (#3219)', () => {
  it.each([
    ['сайдбар 1440', (currentIndex: number) => <QuestCompactSidebar {...shared} styles={createQuestWizardStyles(colors, false, 1440)} currentIndex={currentIndex} />],
    ['шапка 1024', (currentIndex: number) => <QuestHeaderPanel {...shared} styles={createQuestWizardStyles(colors, false, 1024)} currentIndex={currentIndex}
      headerInScreenRow={false} screenW={1024} compactNav={false} />],
  ] as const)('%s: до старта нет «Задания» и разбора, после старта есть', async (_name, make) => {
    const intro = await render(make(0))
    expect(intro.queryByText(/Задания:/)).toBeNull()
    expect(intro.queryByText(/обязательные: 6/)).toBeNull()
    await intro.unmount()

    const started = await render(make(1))
    expect(started.getByText('Задания: 0 / 6')).toBeTruthy()
  })
})
