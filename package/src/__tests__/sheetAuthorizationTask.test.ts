import type { PaymentRequest } from '../types'

const request: PaymentRequest = {
  countryCode: 'US',
  currencyCode: 'USD',
  paymentItems: [{ label: 'Coffee', amount: '4.50', type: 'final' }],
  merchantCapabilities: ['3DS'],
  supportedNetworks: ['visa'],
}

function loadOnPlatform(os: 'android' | 'ios') {
  const registerHeadlessTask = jest.fn()
  let prepare!: typeof import('../paymentHandler').prepareStartPaymentOptions
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: os, select: (spec: any) => spec[os] ?? spec.default },
      AppRegistry: { registerHeadlessTask },
    }))
    prepare = require('../paymentHandler').prepareStartPaymentOptions
  })
  return { prepare, registerHeadlessTask }
}

afterEach(() => {
  jest.dontMock('react-native')
})

describe('sheet authorization task', () => {
  it('registers once on Android when onAuthorize is set', () => {
    const { prepare, registerHeadlessTask } = loadOnPlatform('android')
    const onAuthorize = async () => ({ status: 'success' as const })

    prepare({ onAuthorize }, request)
    prepare({ onAuthorize }, request)

    expect(registerHeadlessTask).toHaveBeenCalledTimes(1)
    expect(registerHeadlessTask.mock.calls[0][0]).toBe(
      'ReactNativePaySheetAuthorization'
    )
  })

  it('never settles by itself, so native code decides when it ends', async () => {
    const { prepare, registerHeadlessTask } = loadOnPlatform('android')
    prepare({ onAuthorize: async () => ({ status: 'success' }) }, request)

    const task = registerHeadlessTask.mock.calls[0][1]()
    const settled = jest.fn()
    task({}).then(settled, settled)
    await Promise.resolve()

    expect(settled).not.toHaveBeenCalled()
  })

  it('is not registered without onAuthorize or on iOS', () => {
    const android = loadOnPlatform('android')
    android.prepare(undefined, request)
    expect(android.registerHeadlessTask).not.toHaveBeenCalled()

    const ios = loadOnPlatform('ios')
    ios.prepare({ onAuthorize: async () => ({ status: 'success' }) }, request)
    expect(ios.registerHeadlessTask).not.toHaveBeenCalled()
  })
})
