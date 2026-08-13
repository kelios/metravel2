import {
  findFrontendDeployLifecycleViolations,
} from './frontend-deploy-lifecycle-contract'
import {
  readCanonicalDeploy,
  readRecoveryDeploy,
} from './remote-deploy-test-utils'

describe('frontend deploy container lifecycle contract', () => {
  it.each([
    ['build-prod.sh', readCanonicalDeploy],
    ['scripts/fix-prod.sh', readRecoveryDeploy],
  ])('keeps %s free of container lifecycle commands', (_path, readSource) => {
    expect(findFrontendDeployLifecycleViolations(readSource())).toEqual([])
  })

  it.each([
    ['docker restart "$nginx_ctr"', 'restart'],
    [
      'docker compose -f docker-compose-prod.app.yaml restart app nginx',
      'restart',
    ],
    ['docker-compose -f docker-compose-prod.yaml down', 'down'],
    ['docker compose create app nginx', 'create'],
    [
      'docker compose -f docker-compose-prod.infrastructure.yaml up -d redis redis-images',
      'up',
    ],
    ['docker compose start nginx', 'start'],
    ['docker compose kill redis', 'kill'],
    ['docker stop metravel_app_1', 'stop'],
    ['docker --context production restart metravel_nginx_1', 'restart'],
    [
      'docker --context production compose -f docker-compose-prod.yaml down',
      'down',
    ],
    ['docker rm -f metravel_nginx_1', 'rm'],
    ['docker run --rm redis:latest', 'run'],
  ])('rejects `%s`', (source, command) => {
    expect(findFrontendDeployLifecycleViolations(source)).toEqual([
      { command, line: 1, source },
    ])
  })

  it('rejects lifecycle commands split across shell continuation lines', () => {
    const source = [
      'docker compose -f docker-compose-prod.infrastructure.yaml \\',
      '  up -d redis redis-images',
    ].join('\n')

    expect(findFrontendDeployLifecycleViolations(source)).toEqual([
      {
        command: 'up',
        line: 1,
        source:
          'docker compose -f docker-compose-prod.infrastructure.yaml  up -d redis redis-images',
      },
    ])
  })

  it('allows exec-based static cleanup and graceful Nginx activation', () => {
    const safeCommands = [
      "docker exec -u 0 \"$app_ctr\" sh -c 'rm -rf /app/static/dist.old'",
      'docker compose -f docker-compose-prod.app.yaml exec -T nginx nginx -t',
      'docker exec "$nginx_ctr" nginx -s reload',
    ].join('\n')

    expect(findFrontendDeployLifecycleViolations(safeCommands)).toEqual([])
  })

  it('validates and gracefully reloads recovery Nginx after the static swap', () => {
    const source = readRecoveryDeploy()
    const swapIndex = source.indexOf(
      "printf '%s' '$SWAP_B64' | base64 -d | docker exec -i",
    )
    const validationIndex = source.indexOf(
      'docker exec \\"\\$nginx_ctr\\" /etc/nginx/sbin/nginx -t -c /etc/nginx/conf/nginx.conf',
    )
    const reloadIndex = source.indexOf(
      'docker exec \\"\\$nginx_ctr\\" /etc/nginx/sbin/nginx -s reload -c /etc/nginx/conf/nginx.conf',
    )

    expect(swapIndex).toBeGreaterThan(-1)
    expect(validationIndex).toBeGreaterThan(swapIndex)
    expect(reloadIndex).toBeGreaterThan(validationIndex)
  })
})
