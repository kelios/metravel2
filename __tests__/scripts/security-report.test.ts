import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir, runCli } from './cli-test-utils'

// #2721: ежедневный security-отчёт прод-хоста. Скрипт на python3 (stdlib)
// разбирает access-лог nginx, fail2ban.log, auth.log, лог рассылки модерации и
// relay-очередь; тест кормит его фикстурами через флаги и проверяет цифры,
// окно, исключение своих адресов, пометки ⚠ и дельты ко вчера.

const SCRIPT = path.join(process.cwd(), 'scripts', 'security-report.py')
const NOW = '2026-10-25T07:00:00+00:00'
const OWN_IP = '31.182.202.31'

const access = (time: string, ip: string, request: string, status: number, ua: string) =>
  JSON.stringify({ time, remote_addr: ip, request, status, user_agent: ua, upstream_response_time: '0.010' })

function writeFixtures(dir: string) {
  const ng: string[] = []
  // окно: с 24.10 07:00Z; эта строка старше и не считается
  ng.push(access('2026-10-23T10:00:00+00:00', '8.8.8.8', 'GET /.env HTTP/1.1', 404, 'curl/8.0'))
  ng.push(access('2026-10-24T09:00:00+00:00', '203.0.113.5', 'GET /travels/nesvizh HTTP/2.0', 200, 'Mozilla/5.0 Chrome/120'))
  ng.push(access('2026-10-24T09:00:01+00:00', '203.0.113.5', 'GET /api/travels/ HTTP/2.0', 502, 'Mozilla/5.0 Chrome/120'))
  ng.push(access('2026-10-24T09:00:02+00:00', '203.0.113.6', 'GET /quests/warsaw HTTP/2.0', 499, 'Mozilla/5.0 Safari'))
  ng.push(access('2026-10-24T12:00:00+00:00', OWN_IP, 'GET /api/tasks/ HTTP/1.1', 200, 'curl/8.7.1'))
  for (let i = 0; i < 3; i += 1) ng.push(access('2026-10-24T20:00:00+00:00', '45.148.10.238', 'GET /.env HTTP/1.1', 404, 'Mozilla/5.0 zgrab/0.x'))
  ng.push(access('2026-10-24T20:01:00+00:00', '45.148.10.238', 'POST /admin/login/ HTTP/1.1', 403, 'python-requests/2.31'))
  // #2823: до проверки пароля дошли 10 POST (200) — ⚠; отказы 403/429 подбором не считаются
  for (let i = 0; i < 10; i += 1) ng.push(access('2026-10-24T20:02:00+00:00', '185.148.240.80', 'POST /admin/login/ HTTP/1.1', 200, 'Mozilla/5.0 Chrome/120'))
  for (let i = 0; i < 2; i += 1) ng.push(access('2026-10-24T20:03:00+00:00', '185.148.240.80', 'POST /admin/login/ HTTP/1.1', 429, 'Mozilla/5.0 Chrome/120'))
  // #2823: PetalBot закрыт и режется nginx — 70 × 403 и robots.txt без ⚠
  for (let i = 0; i < 70; i += 1) ng.push(access('2026-10-25T03:00:00+00:00', '114.119.130.1', `GET /travels/t${i} HTTP/1.1`, 403, 'Mozilla/5.0 (compatible;PetalBot;+https://webmaster.petalsearch.com/site/petalbot)'))
  ng.push(access('2026-10-25T03:00:01+00:00', '114.119.130.1', 'GET /robots.txt HTTP/1.1', 200, 'Mozilla/5.0 (compatible;PetalBot;+https://webmaster.petalsearch.com/site/petalbot)'))
  for (let i = 0; i < 60; i += 1) ng.push(access('2026-10-25T01:00:00+00:00', '110.249.201.1', `GET /quests/minsk/q${i} HTTP/1.1`, 200, 'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)'))
  ng.push(access('2026-10-25T02:00:00+00:00', '66.249.64.7', 'GET /travels/nesvizh HTTP/1.1', 200, 'Mozilla/5.0 (compatible; Googlebot/2.1)'))
  ng.push('not json at all')
  fs.writeFileSync(path.join(dir, 'nginx.log'), `${ng.join('\n')}\n`)
  fs.writeFileSync(
    path.join(dir, 'nginx.err'),
    [
      '2026/10/24 15:00:00 [error] 29#29: *1 limiting requests, excess: 60.5 by zone "api", client: 1.2.3.4, server: metravel.by',
      // referrer задаёт клиент: адрес берётся из первого `client:`, а не из подставленного в заголовок
      `2026/10/24 15:00:01 [error] 29#29: *2 limiting requests, excess: 60.5 by zone "api", client: 1.2.3.4, server: metravel.by, request: "GET /api/x HTTP/1.1", referrer: "client: ${OWN_IP}"`,
      `2026/10/24 15:00:02 [error] 29#29: *3 limiting requests, excess: 60.5 by zone "api", client: ${OWN_IP}, server: metravel.by`,
      // #2823: отказы зоны login — защита входа, на порог ⚠ limit_req не влияют
      ...Array.from({ length: 20 }, (_, i) => `2026/10/24 20:03:00 [error] 29#29: *${4 + i} limiting requests, excess: 3.990 by zone "login", client: 185.148.240.80, server: metravel.by, request: "POST /admin/login/ HTTP/1.1"`),
      '',
    ].join('\n'),
  )
  // fail2ban пишет локальное время хоста (+03:00): 24.10 10:00 local = 07:00Z — граница окна
  fs.writeFileSync(
    path.join(dir, 'fail2ban.log'),
    [
      '2026-10-24 09:59:59,000 fail2ban.actions        [667]: NOTICE  [sshd] Ban 1.1.1.1',
      '2026-10-24 10:00:01,000 fail2ban.filter         [667]: INFO    [sshd] Found 2.2.2.2 - 2026-10-24 10:00:00',
      '2026-10-24 10:00:02,000 fail2ban.actions        [667]: NOTICE  [sshd] Ban 2.2.2.2',
      '2026-10-24 11:00:02,000 fail2ban.actions        [667]: NOTICE  [sshd] Unban 2.2.2.2',
      '2026-10-24 12:00:00,000 fail2ban.actions        [667]: NOTICE  [sshd] Ban 3.3.3.3',
      '2026-10-24 13:00:00,000 fail2ban.actions        [667]: NOTICE  [sshd-slow] Ban 4.4.4.4',
      '2026-10-24 13:00:01,000 fail2ban.actions        [667]: NOTICE  [recidive] Restore Ban 5.5.5.5',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(dir, 'auth.log'),
    [
      '2026-10-23T20:00:00.000000+00:00 server sshd[1]: Invalid user admin from 7.7.7.7 port 1',
      '2026-10-24T08:00:00.000000+00:00 server sshd[2]: Invalid user admin from 2.2.2.2 port 2',
      // одно соединение пишет несколько строк отказа под одним pid — это одна попытка
      '2026-10-24T08:00:01.000000+00:00 server sshd[2]: Connection closed by invalid user admin 2.2.2.2 port 2 [preauth]',
      '2026-10-24T08:09:59.000000+00:00 server sshd[4]: pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=3.3.3.3  user=root',
      '2026-10-24T08:10:00.000000+00:00 server sshd[4]: Failed password for root from 3.3.3.3 port 3 ssh2',
      '2026-10-24T08:20:00.000000+00:00 server sshd[7]: Connection closed by authenticating user root 3.3.3.3 port 4 [preauth]',
      `2026-10-24T09:00:00.000000+00:00 server sshd[5]: Accepted publickey for sx3 from ${OWN_IP} port 5 ssh2: ED25519 SHA256:x`,
      '2026-10-24T22:00:00.000000+00:00 server sshd[6]: Accepted publickey for sx3 from 9.9.9.9 port 6 ssh2: ED25519 SHA256:y',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(dir, 'moderation.log'),
    [
      '2026-10-20 08:35:24,239 ERROR users.services.moderation_notifications Moderation notification 58 failed (SMTPAuthenticationError)',
      // Django пишет asctime в UTC (TIME_ZONE='UTC'): 08:00 — в окне, хотя в зоне +03:00 было бы 05:00Z, вне окна
      '2026-10-24 08:00:00,000 ERROR users.services.moderation_notifications Moderation notification 69 failed (SMTPServerDisconnected)',
      '2026-10-24 11:30:00,000 ERROR users.services.moderation_notifications Moderation notification 70 failed (SMTPAuthenticationError)',
      'Moderation notifications sent: 0',
      '',
    ].join('\n'),
  )
  fs.writeFileSync(
    path.join(dir, 'relay.log'),
    `${JSON.stringify({ collected_at: '2026-10-25T06:55:00+00:00', deferred_count: 0, queue_depth: 0, last_relay_error_code: null })}\n`,
  )
  fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /api/\n\nUser-agent: Bytespider\nDisallow: /\n\nUser-agent: PetalBot\nDisallow: /\n\nUser-agent: Googlebot-Image\nDisallow: /\n\nSitemap: https://metravel.by/sitemap.xml\n')
}

function runReport(dir: string, extra: string[] = []) {
  return runCli('python3', [
    '-I', SCRIPT, '--dry-run', '--write-state', '--no-host', '--now', NOW, '--log-utc-offset', '+03:00',
    '--ignore-ip', OWN_IP,
    '--nginx-log', path.join(dir, 'nginx.log'), '--nginx-err', path.join(dir, 'nginx.err'),
    '--fail2ban-log', path.join(dir, 'fail2ban.log'), '--auth-log', path.join(dir, 'auth.log'),
    '--moderation-log', path.join(dir, 'moderation.log'), '--relay-log', path.join(dir, 'relay.log'),
    '--robots', path.join(dir, 'robots.txt'), '--state', path.join(dir, 'state.json'),
    ...extra,
  ])
}

describe('scripts/security-report.py', () => {
  let dir: string
  beforeAll(() => {
    dir = makeTempDir('security-report-')
    writeFixtures(dir)
  })
  afterAll(() => removeDir(dir))

  it('считает SSH, web, роботов и почту за окно, без своих адресов, и ставит ⚠', () => {
    const result = runReport(dir)
    expect(result.status).toBe(0)
    const out = result.stdout
    expect(out).toContain('Security report metravel.by 25.10.2026: 4 ⚠')
    // SSH: попытка 23.10 вне окна; в окне 3 соединения с 2 адресов; Found 1; баны sshd 2 (1.1.1.1 — за секунду до окна)
    expect(out).toContain('Неудачных попыток входа: 3 с 2 адресов; fail2ban Found: 1')
    expect(out).toContain('Топ атакующих: 3.3.3.3 ×2, 2.2.2.2 ×1')
    expect(out).toContain('Баны: sshd 2 (уникальных 2), sshd-slow 1, recidive 0')
    expect(out).toContain('Восстановлено банов после рестарта: {\'recidive\': 1}')
    expect(out).toContain('⚠ SSH-вход sx3 с НЕЗНАКОМОГО адреса 9.9.9.9 (publickey, ×1)')
    expect(out).not.toContain(`НЕЗНАКОМОГО адреса ${OWN_IP}`)
    // Web: 151 внешний в окне (старая строка и свой IP не считаются), 1×502, 1×499
    expect(out).toContain('Внешних запросов: 151; 2xx 73, 3xx 0, 4xx 77, 5xx 1, 499 1')
    expect(out).toContain('Сканеры (.env/.git/wp-*/php): 3 запросов с 1 адресов')
    expect(out).toContain('POST /admin/login/: 13, из них отказ 403/429: 3, дошли до проверки пароля: 10')
    expect(out).toContain('⚠ подбор пароля к /admin/login/: 10 POST дошли до проверки пароля')
    expect(out).toContain('Срабатываний limit_req: 22 (185.148.240.80 ×20, 1.2.3.4 ×2); по зонам: login ×20, api ×2')
    expect(out).not.toContain('limit_req сработал')
    expect(out).toContain('5xx по путям: /api/travels/ ×1')
    // адреса посетителей в письмо не попадают: общий топ — сетями
    expect(out).toContain('Топ сетей по запросам (/24, /48): 114.119.130.0/24 ×71, 110.249.201.0/24 ×60, 185.148.240.0/24 ×12, 45.148.10.0/24 ×4, 203.0.113.0/24 ×3')
    expect(out).not.toContain('203.0.113.5')
    expect(out).not.toContain('110.249.201.1 ')
    // Роботы: Bytespider закрыт в robots.txt и получает контент → ⚠; PetalBot закрыт и режется 403 → без ⚠
    expect(out).toMatch(/bytespider\s+60 \[закрыт в robots\.txt, отдано 60\]/)
    expect(out).toMatch(/petalbot\s+71 \[закрыт в robots\.txt, отдано 0\]/)
    expect(out).not.toContain('закрытый робот petalbot')
    expect(out).toMatch(/zgrab\s+3\s+\.env ×3/)
    expect(out).toContain('⚠ закрытый робот bytespider получил 60 ответов вместо 403 — сверить map $closed_crawler в nginx.conf бэка с robots.txt')
    // закрыт только Googlebot-Image: сам googlebot не помечается (сравнение по точному имени)
    expect(out).toMatch(/googlebot\s+1\s+travels ×1/)
    expect(out).toContain('закрыто в robots.txt: 3')
    // Почта: ошибка 20.10 вне окна, две 24.10 (UTC) — в окне
    expect(out).toContain('Ошибок SMTP в рассылке модерации: 2 ({\'SMTPServerDisconnected\': 1, \'SMTPAuthenticationError\': 1})')
    expect(out).toContain('Очередь Postfix: deferred 0, глубина 0, ошибка нет')
    expect(out).not.toContain('Пропущено нечитаемых строк')
    expect(out).not.toContain('ко вчера')
    expect(out).not.toContain('сбор неполный')
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'))
    expect(state.metrics).toEqual({
      ssh_failed: 3, ssh_unique_ips: 2, bans_sshd: 2, scanner_requests: 3, scanner_ips: 1,
      http_5xx: 1, bot_requests: 136, external: 151,
    })
  })

  it('во второй прогон печатает дельты к сохранённому состоянию', () => {
    const state = path.join(dir, 'state.json')
    fs.writeFileSync(state, JSON.stringify({ metrics: { ssh_failed: 10, bans_sshd: 2, scanner_requests: 1, http_5xx: 0, bot_requests: 100 } }))
    const result = runReport(dir)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Неудачных попыток входа: 3 с 2 адресов (-7 ко вчера)')
    expect(result.stdout).toContain('sshd-slow 1, recidive 0 (+0 ко вчера)')
    expect(result.stdout).toContain('3 запросов с 1 адресов (+2 ко вчера)')
    expect(result.stdout).toContain('Всего запросов роботов: 136 (+36 ко вчера)')
  })

  it('пустые логи — отчёт OK с пометкой о неполном сборе', () => {
    const empty = path.join(dir, 'empty.log')
    fs.writeFileSync(empty, '')
    const result = runCli('python3', [
      '-I', SCRIPT, '--dry-run', '--no-host', '--now', NOW,
      '--nginx-log', empty, '--fail2ban-log', empty, '--auth-log', empty, '--moderation-log', empty,
      '--relay-log', empty, '--robots', empty, '--state', path.join(dir, 'state2.json'),
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('OK (сбор неполный)')
    expect(result.stdout).toContain('Отклонений по порогам отчёта нет.')
    expect(result.stdout).toContain('Примечания сбора: fail2ban.log не прочитан; auth.log не прочитан')
  })
})
