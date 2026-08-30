const {
  SERVICES,
  evaluateGuard,
  findViolationsInSource,
  findViolationsInDoc,
} = require('@/scripts/guard-container-names')

describe('guard-container-names', () => {
  it('покрывает все сервисы compose, у которых есть контейнер на проде', () => {
    expect(SERVICES).toEqual(['app', 'nginx', 'metravel-gis', 'redis', 'redis-images'])
  })

  it.each([
    ['compose v1, app', "docker exec -i metravel_app_1 sh -c 'true'"],
    ['compose v2, app', 'docker exec -u 0 metravel-app-1 sh -c "rm -rf /app/static/dist.new"'],
    ['nginx', 'docker exec metravel-nginx-1 nginx -t'],
    ['база', 'docker exec -i metravel_metravel-gis_1 sh -c "pg_dump"'],
    ['redis', 'docker exec metravel_redis_1 redis-cli ping'],
    ['redis-images', 'docker exec metravel_redis-images_1 redis-cli ping'],
  ])('ловит вписанное вручную имя: %s', (_label, content) => {
    expect(findViolationsInSource({ filePath: 'scripts/example.sh', content })).toHaveLength(1)
  })

  it.each([
    ['shell-комментарий', '# при пересоздании metravel_app_1 стал metravel-app-1'],
    ['js-комментарий', '// contains metravel_nginx_1 → metravel-nginx-1'],
    ['python-комментарий', '       # compose v1 звал его metravel_app_1'],
    [
      'сам резолв',
      "ctr=\"$(docker ps --format '{{.Names}}' | grep -E '^metravel[-_]app[-_]1$' | head -1)\"",
    ],
    ['вызов общей функции', 'app_ctr="$(metravel_resolve_container app)"'],
  ])('не считает нарушением: %s', (_label, content) => {
    expect(findViolationsInSource({ filePath: 'scripts/example.sh', content })).toEqual([])
  })

  it('в документации проверяет только исполняемые bash-блоки', () => {
    const content = [
      'Живая БД: контейнер `metravel_metravel-gis_1` на 2026-08-05.',
      '',
      '```',
      '[2026-08-05T12:26:51Z] Checking dump access in container metravel_metravel-gis_1',
      '```',
      '',
      '```bash',
      'docker exec -i metravel_metravel-gis_1 sh -c "pg_dump"',
      '```',
      '',
    ].join('\n')

    const violations = findViolationsInDoc({ filePath: 'docs/DB_BACKUP.md', content })

    // Проза (строка 1) и транскрипт лога в блоке без языка (строка 4) — описание
    // состояния, а не команда. Нарушение ровно одно — строка 8 в ```bash.
    expect(violations).toHaveLength(1)
    expect(violations[0].line).toBe(8)
  })

  it('принимает раннбук, переведённый на резолв', () => {
    const result = evaluateGuard({
      docs: [
        {
          filePath: 'docs/DB_BACKUP.md',
          content: [
            '```bash',
            'DB_CTR="$(metravel_resolve_container_over_ssh metravel-gis)" || exit 1',
            'ssh "$PROD_SSH_TARGET" "docker exec -i $DB_CTR sh -c \'pg_dump\'"',
            '```',
          ].join('\n'),
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('чистое дерево даёт ok без нарушений', () => {
    expect(evaluateGuard({ sources: [], docs: [] })).toMatchObject({ ok: true, violations: [] })
  })
})
