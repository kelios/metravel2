import {
  mergeQuestProgress,
  normalizeQuestProgressSnapshot,
  snapshotFromServerProgress,
  toQuestProgressServerPayload,
  type QuestProgressSnapshot,
} from '@/utils/questProgressMerge'

const T0 = 1_785_000_000_000

const snapshot = (patch: Partial<QuestProgressSnapshot> = {}): QuestProgressSnapshot =>
  normalizeQuestProgressSnapshot({
    currentIndex: 0,
    unlockedIndex: 0,
    answers: {},
    attempts: {},
    hints: {},
    showMap: true,
    completed: false,
    updatedAt: 0,
    answeredAt: {},
    ...patch,
  })

describe('mergeQuestProgress', () => {
  it('объединяет ответы двух устройств без потерь', () => {
    // Телефон A прошёл офлайн 1,2,3; телефон B онлайн записал 1,4,5.
    const local = snapshot({
      currentIndex: 3,
      unlockedIndex: 3,
      answers: { 'step-1': 'a1', 'step-2': 'a2', 'step-3': 'a3' },
      updatedAt: T0 + 5_000,
      answeredAt: { 'step-1': T0 + 1_000, 'step-2': T0 + 3_000, 'step-3': T0 + 5_000 },
    })
    const server = snapshot({
      currentIndex: 5,
      unlockedIndex: 5,
      answers: { 'step-1': 'a1', 'step-4': 'a4', 'step-5': 'a5' },
      updatedAt: T0 + 2_000,
    })

    const { merged, localChanged, serverNeedsPush } = mergeQuestProgress(local, server)

    expect(merged.answers).toEqual({
      'step-1': 'a1',
      'step-2': 'a2',
      'step-3': 'a3',
      'step-4': 'a4',
      'step-5': 'a5',
    })
    expect(localChanged).toBe(true)
    expect(serverNeedsPush).toBe(true)
  })

  it('берёт max по attempts и ИЛИ по hints', () => {
    const local = snapshot({
      attempts: { 'step-1': 3, 'step-2': 1 },
      hints: { 'step-1': true, 'step-2': false },
    })
    const server = snapshot({
      attempts: { 'step-1': 1, 'step-3': 4 },
      hints: { 'step-2': true, 'step-3': false },
    })

    const { merged } = mergeQuestProgress(local, server)

    expect(merged.attempts).toEqual({ 'step-1': 3, 'step-2': 1, 'step-3': 4 })
    expect(merged.hints).toEqual({ 'step-1': true, 'step-2': true, 'step-3': false })
  })

  it('берёт max по unlockedIndex и ИЛИ по completed', () => {
    const { merged } = mergeQuestProgress(
      snapshot({ unlockedIndex: 2, completed: false }),
      snapshot({ unlockedIndex: 7, completed: true }),
    )

    expect(merged.unlockedIndex).toBe(7)
    expect(merged.completed).toBe(true)
  })

  it('currentIndex и showMap решаются по времени (last-writer-wins)', () => {
    const stale = snapshot({ currentIndex: 2, showMap: true, updatedAt: T0 })
    const fresh = snapshot({ currentIndex: 6, showMap: false, updatedAt: T0 + 60_000 })

    expect(mergeQuestProgress(stale, fresh).merged.currentIndex).toBe(6)
    expect(mergeQuestProgress(stale, fresh).merged.showMap).toBe(false)
    expect(mergeQuestProgress(fresh, stale).merged.currentIndex).toBe(6)
    expect(mergeQuestProgress(fresh, stale).merged.showMap).toBe(false)
  })

  it('коллизия одного шага решается по времени ответа', () => {
    const local = snapshot({
      answers: { 'step-1': 'локальный' },
      updatedAt: T0 + 10_000,
      answeredAt: { 'step-1': T0 + 10_000 },
    })
    const server = snapshot({
      answers: { 'step-1': 'серверный' },
      updatedAt: T0 + 20_000,
    })

    expect(mergeQuestProgress(local, server).merged.answers['step-1']).toBe('серверный')

    const laterLocal = snapshot({
      answers: { 'step-1': 'локальный' },
      updatedAt: T0 + 30_000,
      answeredAt: { 'step-1': T0 + 30_000 },
    })
    expect(mergeQuestProgress(laterLocal, server).merged.answers['step-1']).toBe('локальный')
  })

  it('непустой ответ всегда побеждает пустой, даже если пустой свежее', () => {
    const local = snapshot({
      answers: { 'step-1': 'ответ' },
      updatedAt: T0,
      answeredAt: { 'step-1': T0 },
    })
    const server = snapshot({ answers: { 'step-1': '' }, updatedAt: T0 + 90_000 })

    expect(mergeQuestProgress(local, server).merged.answers['step-1']).toBe('ответ')
  })

  it('пустой сервер + полный локальный: локальные ответы сохранены и уходят на сервер', () => {
    // Ровно баг sasino-stilo: на сервере остался только intro.
    const local = snapshot({
      currentIndex: 4,
      unlockedIndex: 4,
      answers: { intro: 'start', 'step-1': 'a1', 'step-2': 'a2', 'step-3': 'a3' },
      updatedAt: T0 + 5_000,
    })
    const server = snapshot({ answers: { intro: 'start' }, updatedAt: T0 })

    const { merged, localChanged, serverNeedsPush } = mergeQuestProgress(local, server)

    expect(merged.answers).toEqual(local.answers)
    expect(merged.currentIndex).toBe(4)
    expect(localChanged).toBe(false)
    expect(serverNeedsPush).toBe(true)
  })

  it('полный сервер + пустой локальный: серверные ответы сохранены', () => {
    const server = snapshot({
      currentIndex: 3,
      unlockedIndex: 3,
      answers: { intro: 'start', 'step-1': 'a1', 'step-2': 'a2' },
      updatedAt: T0 + 5_000,
    })

    const { merged, localChanged, serverNeedsPush } = mergeQuestProgress(snapshot(), server)

    expect(merged.answers).toEqual(server.answers)
    expect(merged.currentIndex).toBe(3)
    expect(localChanged).toBe(true)
    expect(serverNeedsPush).toBe(false)
  })

  it('легаси-запись без updatedAt не теряет курсор в пользу более бедного сервера', () => {
    // Все существующие установки после обновления приложения имеют записи без времени.
    const legacyLocal = snapshot({
      currentIndex: 5,
      unlockedIndex: 5,
      answers: { intro: 'start', 'step-1': 'a1', 'step-2': 'a2' },
      updatedAt: 0,
    })
    const server = snapshot({
      currentIndex: 0,
      answers: { intro: 'start' },
      updatedAt: T0 + 999_000,
    })

    const { merged } = mergeQuestProgress(legacyLocal, server)

    expect(merged.currentIndex).toBe(5)
    expect(merged.answers).toEqual(legacyLocal.answers)
  })

  it('согласованные стороны не дают ни локальных изменений, ни push', () => {
    const same = snapshot({
      currentIndex: 2,
      unlockedIndex: 2,
      answers: { 'step-1': 'a1' },
      attempts: { 'step-1': 1 },
      updatedAt: T0,
      answeredAt: { 'step-1': T0 },
    })
    const server = snapshot({
      currentIndex: 2,
      unlockedIndex: 2,
      answers: { 'step-1': 'a1' },
      attempts: { 'step-1': 1 },
      updatedAt: T0,
      answeredAt: { 'step-1': T0 },
    })

    const { localChanged, serverNeedsPush } = mergeQuestProgress(same, server)

    expect(localChanged).toBe(false)
    expect(serverNeedsPush).toBe(false)
  })

  it('снапшот с сервера проставляет answeredAt из updated_at записи', () => {
    const snap = snapshotFromServerProgress({
      current_index: 2,
      unlocked_index: 3,
      answers: { 'step-1': 'a1', 'step-2': '' },
      attempts: { 'step-1': 2 },
      hints: {},
      show_map: false,
      completed: false,
      updated_at: new Date(T0).toISOString(),
    })

    expect(snap.updatedAt).toBe(T0)
    expect(snap.answeredAt).toEqual({ 'step-1': T0 })
    expect(snap.showMap).toBe(false)
    expect(toQuestProgressServerPayload(snap)).toEqual({
      current_index: 2,
      unlocked_index: 3,
      answers: { 'step-1': 'a1', 'step-2': '' },
      attempts: { 'step-1': 2 },
      hints: {},
      show_map: false,
      completed: false,
    })
  })

  it('не отправляет completed:false поверх серверного completed:true (#1451)', () => {
    // Устройство B не знает про официальный пропуск девятой точки (`skipped`
    // на бэкенде не хранится), поэтому пересчитывает прохождение как
    // незаконченное. Payload обязан остаться `completed: true`: иначе у игрока
    // молча пропадает «Пройден» и единица из счётчика прохождений квеста.
    const deviceB = snapshot({
      answers: { 'step-1': 'a1', 'step-2': 'a2' },
      completed: false,
      updatedAt: T0 + 10_000,
    })
    const server = snapshotFromServerProgress({
      current_index: 2,
      unlocked_index: 2,
      answers: { 'step-1': 'a1', 'step-2': 'a2' },
      attempts: {},
      hints: {},
      show_map: true,
      completed: true,
      updated_at: new Date(T0).toISOString(),
    })

    const { merged } = mergeQuestProgress(deviceB, server)

    expect(merged.completed).toBe(true)
    expect(toQuestProgressServerPayload(merged).completed).toBe(true)
  })

  it('переживает битые/частичные данные без исключений', () => {
    const { merged } = mergeQuestProgress(
      { answers: null as never, currentIndex: NaN as never },
      { unlockedIndex: '4' as never, hints: undefined },
    )

    expect(merged.answers).toEqual({})
    expect(merged.currentIndex).toBe(0)
    expect(merged.unlockedIndex).toBe(4)
  })
})
