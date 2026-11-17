import { Platform } from 'react-native'

type WarnIfOmitted =
  typeof import('../googlePayEnvironment').warnIfGooglePayEnvironmentOmitted

const globals = globalThis as unknown as { __DEV__: boolean }

// A fresh module per test, so its once-per-run flag starts unset.
function loadWarn(): WarnIfOmitted {
  let warn!: WarnIfOmitted
  jest.isolateModules(() => {
    warn = require('../googlePayEnvironment').warnIfGooglePayEnvironmentOmitted
  })
  return warn
}

describe('warnIfGooglePayEnvironmentOmitted', () => {
  let consoleWarn: jest.SpyInstance
  const isDev = globals.__DEV__

  beforeEach(() => {
    globals.__DEV__ = false
    jest.replaceProperty(Platform, 'OS', 'android')
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    globals.__DEV__ = isDev
    jest.restoreAllMocks()
  })

  it('warns once in an Android release build without an environment', () => {
    const warn = loadWarn()

    warn(undefined)
    warn(undefined)

    expect(consoleWarn).toHaveBeenCalledTimes(1)
    expect(consoleWarn.mock.calls[0][0]).toContain(
      "googlePayEnvironment is not set, so Google Pay runs in 'TEST'"
    )
  })

  it.each(['TEST', 'PRODUCTION'] as const)(
    'does not warn with an explicit %s',
    (environment) => {
      loadWarn()(environment)

      expect(consoleWarn).not.toHaveBeenCalled()
    }
  )

  it('does not warn in a dev build', () => {
    globals.__DEV__ = true

    loadWarn()(undefined)

    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('does not warn on iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios')

    loadWarn()(undefined)

    expect(consoleWarn).not.toHaveBeenCalled()
  })
})
