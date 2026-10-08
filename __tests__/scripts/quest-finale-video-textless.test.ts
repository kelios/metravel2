/**
 * Финальное видео квеста — без текста в кадре (#2207).
 *
 * Строка в пикселях не переводится: англоязычный игрок получал финал с
 * «Квест пройден!» и русским названием города. Поздравление и город теперь
 * рисует экран финала надписью интерфейса на языке игрока, а оба генератора
 * ролика (Ken Burns по обложке и пост-обработка AI-клипа) обязаны собирать
 * кадр только из картинки.
 */

import fs from 'fs'
import path from 'path'

const { QUESTS, EXISTING_VIDEO_QUESTS, buildFinaleVideoFilter, DURATION, FPS } = require('@/scripts/generate-quest-finale-videos')
const { buildAiFinaleFilter, FREEZE } = require('@/scripts/postprocess-quest-ai-video')

const SCRIPTS = ['generate-quest-finale-videos.js', 'postprocess-quest-ai-video.js'].map((name) => ({
  name,
  source: fs.readFileSync(path.resolve(__dirname, '../../scripts', name), 'utf8'),
}))

// Любой фильтр, который кладёт в кадр текст или вторую картинку поверх ролика.
const TEXT_FILTERS = /\b(drawtext|subtitles|ass|overlay)\s*=/
const CYRILLIC = /[А-Яа-яЁё]/

describe('финальное видео квеста без вшитого текста (#2207)', () => {
  it.each([
    ['Ken Burns по обложке', buildFinaleVideoFilter()],
    ['AI-клип со стоп-кадром', buildAiFinaleFilter(9.5)],
  ])('%s: filtergraph собирает кадр только из картинки', (_label, filter: string) => {
    expect(filter).not.toMatch(TEXT_FILTERS)
    expect(filter).not.toMatch(/textfile|fontfile/)
    expect(filter).not.toMatch(CYRILLIC)
    expect(filter.startsWith('[0:v]')).toBe(true)
    expect(filter.endsWith('[vout]')).toBe(true)
  })

  it.each(SCRIPTS)('$name не рендерит текст ни через ffmpeg, ни через PIL', ({ source }) => {
    expect(source).not.toMatch(/drawtext=/)
    expect(source).not.toMatch(/ImageFont|ImageDraw/)
    expect(source).not.toContain('Квест пройден')
  })

  it('preserves Ken Burns timing, three motions and two real crossfades', () => {
    const graph = buildFinaleVideoFilter()
    expect(FPS).toBe(25)
    expect(DURATION).toBeCloseTo(16.96)
    expect(graph.match(/zoompan=/g)).toHaveLength(3)
    expect(graph.match(/xfade=/g)).toHaveLength(2)
    expect(graph).toContain('duration=0.8:offset=5.72')
    expect(graph).toContain('duration=0.8:offset=11.44')
    expect(graph).toContain('trim=duration=5.52')
  })

  it('preserves the AI clean frame hold and final fade without a second image input', () => {
    expect(FREEZE).toBe(4.5)
    expect(buildAiFinaleFilter(9.5)).toContain('tpad=stop_mode=clone:stop_duration=5')
    expect(buildAiFinaleFilter(9.5)).toContain('fade=t=out:st=8.80:d=0.7')
    expect(buildAiFinaleFilter(9.5)).not.toContain('[1:v]')
  })

  it.each([NaN, Infinity, 0, 4.5, 30.01])('rejects an invalid AI duration %s before encoding', (duration) => {
    expect(() => buildAiFinaleFilter(duration)).toThrow('Invalid AI finale duration')
  })

  it('маппинг финалов не несёт подписи для кадра', () => {
    for (const entry of [...QUESTS, ...EXISTING_VIDEO_QUESTS]) {
      expect(Object.keys(entry).sort()).toEqual(['dir', 'finaleId', 'questId'])
    }
  })
})
