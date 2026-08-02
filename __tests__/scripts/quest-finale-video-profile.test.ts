/**
 * Паритет фронтового профиля финальных видео квестов с backend-валидатором
 * (`quests/video_policy.py` + `audit_quest_finale_videos`, задача #1169).
 *
 * Генераторы (`scripts/generate-quest-finale-videos.js`,
 * `scripts/postprocess-quest-ai-video.js`) отдают ролик только после
 * `assertFileCompliant`, поэтому разбор MP4 и набор ключей нарушений должны
 * совпадать с бэкендом байт в байт: иначе на прод уедет файл, который
 * отклонит upload-валидатор.
 */

const {
  LIMITS,
  inspectMp4,
  policyViolations,
  videoEncodeArgs,
} = require('@/scripts/quest-finale-video-profile')

const box = (type: string, payload: Buffer) => {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(payload.length + 8, 0)
  header.write(type, 4, 'latin1')
  return Buffer.concat([header, payload])
}

/** mvhd v0: version/flags, created, modified, timescale, duration, хвост. */
const mvhd = (timescale: number, duration: number) => {
  const payload = Buffer.alloc(100)
  payload.writeUInt32BE(0, 0)
  payload.writeUInt32BE(timescale, 12)
  payload.writeUInt32BE(duration, 16)
  return box('mvhd', payload)
}

/** VisualSampleEntry: ширина/высота лежат на +28/+30 от маркера кодека. */
const sampleEntry = (codec: string, width: number, height: number) => {
  const payload = Buffer.alloc(70)
  payload.writeUInt16BE(width, 24)
  payload.writeUInt16BE(height, 26)
  return box(codec, payload)
}

type FileOptions = {
  codec?: string
  width?: number
  height?: number
  timescale?: number
  duration?: number
  audio?: boolean
  faststart?: boolean
  mdatBytes?: number
}

const mp4 = ({
  codec = 'avc1',
  width = 1280,
  height = 720,
  timescale = 1000,
  duration = 17_000,
  audio = false,
  faststart = true,
  mdatBytes = 2 * 1024 * 1024,
}: FileOptions = {}) => {
  const ftyp = box('ftyp', Buffer.from('isomiso2avc1mp41', 'latin1'))
  const handler = box('hdlr', Buffer.from(audio ? 'xxxxsoun' : 'xxxxvide', 'latin1'))
  const moov = box('moov', Buffer.concat([mvhd(timescale, duration), handler, sampleEntry(codec, width, height)]))
  const mdat = box('mdat', Buffer.alloc(mdatBytes))
  return faststart ? Buffer.concat([ftyp, moov, mdat]) : Buffer.concat([ftyp, mdat, moov])
}

const violationsFor = (options: FileOptions = {}) => policyViolations(inspectMp4(mp4(options)))

describe('quest finale video profile', () => {
  it('целевые аргументы ffmpeg соответствуют профилю бэкенда', () => {
    const args = videoEncodeArgs()
    expect(args).toContain('-an')
    expect(args.join(' ')).toContain('-c:v libx264')
    expect(args.join(' ')).toContain('-crf 28')
    expect(args.join(' ')).toContain('-pix_fmt yuv420p')
    expect(args.join(' ')).toContain('-movflags +faststart')
  })

  it('лимиты совпадают с backend-документом', () => {
    expect(LIMITS).toEqual({
      maxBytes: 8 * 1024 * 1024,
      maxDurationSeconds: 30,
      maxDimension: 1280,
      maxBitrateBps: 2_500_000,
    })
  })

  it('разбирает соответствующий профилю ролик без нарушений', () => {
    const metadata = inspectMp4(mp4())
    expect(metadata).toMatchObject({
      codec: 'avc1',
      width: 1280,
      height: 720,
      hasAudio: false,
      faststart: true,
    })
    expect(metadata.durationSeconds).toBeCloseTo(17, 3)
    expect(metadata.bitrateBps).toBe(Math.round((metadata.sizeBytes * 8) / 17))
    expect(policyViolations(metadata)).toEqual([])
  })

  it('ловит аудиодорожку — её запрещает upload-валидатор', () => {
    expect(violationsFor({ audio: true })).toEqual(['audio_track'])
  })

  it('ловит moov после mdat (нет faststart)', () => {
    expect(violationsFor({ faststart: false })).toEqual(['faststart'])
  })

  it('ловит превышение длинной стороны', () => {
    expect(violationsFor({ width: 1920, height: 1080 })).toEqual(['max_dimension'])
  })

  it('ловит длительность больше 30 секунд', () => {
    expect(violationsFor({ duration: 31_000 })).toEqual(['max_duration_seconds'])
  })

  it('ловит размер и средний битрейт вместе', () => {
    expect(violationsFor({ mdatBytes: 9 * 1024 * 1024, duration: 5_000 })).toEqual([
      'max_bytes',
      'max_bitrate_bps',
    ])
  })

  it('битрейт считается по всему файлу, как на бэкенде', () => {
    const buffer = mp4({ mdatBytes: 1024 * 1024, duration: 4_000 })
    expect(inspectMp4(buffer).bitrateBps).toBe(Math.round((buffer.length * 8) / 4))
  })

  it('отвергает не-H.264 и битый контейнер', () => {
    expect(() => inspectMp4(mp4({ codec: 'hvc1' }))).toThrow(/H.264/)
    expect(() => inspectMp4(Buffer.concat([mp4(), Buffer.alloc(3)]))).toThrow(/MP4/)
  })
})
