import * as logger from '@/utils/logger'

const originalEnv = process.env
const originalDev = (global as any).__DEV__

// Вспомогательная функция для пересоздания модуля с нужным NODE_ENV и __DEV__
const reloadLoggerWithEnv = (env: NodeJS.ProcessEnv, devFlag: boolean) => {
  jest.resetModules()
  process.env = env
  ;(global as any).__DEV__ = devFlag
   
  return require('@/utils/logger') as typeof logger
}

describe('logger dev/prod behaviour', () => {
  let origLog: any
  let origWarn: any
  let origError: any

  beforeEach(() => {
    origLog = console.info
    origWarn = console.warn
    origError = console.error
    console.info = jest.fn()
    console.warn = jest.fn()
    console.error = jest.fn()
  })

  afterEach(() => {
    console.info = origLog
    console.warn = origWarn
    console.error = origError
    process.env = originalEnv
    ;(global as any).__DEV__ = originalDev
  })

  it('devLog/devWarn/pdfLog/pdfWarn log only in development', () => {
    const devModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'development' }, true)

    devModule.devLog('msg')
    devModule.devWarn('warn')
    devModule.pdfLog('pdf log')
    devModule.pdfWarn('pdf warn')

    expect(console.info).toHaveBeenCalledWith('msg')
    expect(console.warn).toHaveBeenCalledWith('warn')
    expect(console.info).toHaveBeenCalledWith('[PDF]', 'pdf log')
    expect(console.warn).toHaveBeenCalledWith('[PDF]', 'pdf warn')
  })

  it('devLog/devWarn/pdfLog/pdfWarn are silent in production', () => {
    const prodModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'production' }, false)

    prodModule.devLog('msg')
    prodModule.devWarn('warn')
    prodModule.pdfLog('pdf log')
    prodModule.pdfWarn('pdf warn')

    expect(console.info).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('pdfError always logs with [PDF] prefix', () => {
    const prodModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'production' }, false)

    prodModule.pdfError('oops')
    expect(console.error).toHaveBeenCalledWith('[PDF]', 'oops')
  })

  it('logError sends to monitoring in production but does not log to console via devError', () => {
    const prodModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'production' }, false)

    const monitoring = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      setUser: jest.fn(),
      setContext: jest.fn(),
    }

    prodModule.setMonitoringService(monitoring)

    const err = new Error('boom')
    prodModule.logError(err, { foo: 'bar' })

    // devError is silent in production — no console.error call
    expect(console.error).not.toHaveBeenCalled()
    expect(monitoring.captureException).toHaveBeenCalledWith(err, { foo: 'bar' })
  })

  it('logError logs to console via devError in development', () => {
    const devModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'development' }, true)

    const err = new Error('boom')
    devModule.logError(err, { foo: 'bar' })

    expect(console.error).toHaveBeenCalledWith('Error:', err, { foo: 'bar' })
  })

  it('logMessage logs to console in dev and sends error level to monitoring in prod only', () => {
    // dev
    const devModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'development' }, true)
    const devMonitoring = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      setUser: jest.fn(),
      setContext: jest.fn(),
    }
    devModule.setMonitoringService(devMonitoring)

    devModule.logMessage('info msg', 'info', { a: 1 })
    devModule.logMessage('warn msg', 'warning', { b: 2 })
    devModule.logMessage('err msg', 'error', { c: 3 })

    expect(console.info).toHaveBeenCalledWith('info msg', { a: 1 })
    expect(console.warn).toHaveBeenCalledWith('warn msg', { b: 2 })
    expect(console.error).toHaveBeenCalledWith('err msg', { c: 3 })
    expect(devMonitoring.captureMessage).not.toHaveBeenCalled()

    // prod
    const prodModule = reloadLoggerWithEnv({ ...originalEnv, NODE_ENV: 'production' }, false)
    const prodMonitoring = {
      captureException: jest.fn(),
      captureMessage: jest.fn(),
      setUser: jest.fn(),
      setContext: jest.fn(),
    }
    prodModule.setMonitoringService(prodMonitoring)

    prodModule.logMessage('info prod', 'info', { x: 1 })
    prodModule.logMessage('warn prod', 'warning', { y: 2 })
    prodModule.logMessage('err prod', 'error', { z: 3 })

    // В prod консоль для logMessage не используется, но error уровня должен уйти в мониторинг
    expect(prodMonitoring.captureMessage).toHaveBeenCalledTimes(1)
    expect(prodMonitoring.captureMessage).toHaveBeenCalledWith('err prod', 'error', { z: 3 })
  })
})
