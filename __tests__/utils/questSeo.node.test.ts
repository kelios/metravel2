import { execFileSync } from 'node:child_process'

describe('quest SEO raw Node compatibility', () => {
  it('loads without Metro aliases for production SEO generation', () => {
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        "const { buildQuestSeoMetadata } = require('./utils/questSeo'); process.stdout.write(buildQuestSeoMetadata({ cityName: 'Минск', points: 2 }).title)",
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    expect(output).toContain('Минск: что посмотреть')
  })
})
