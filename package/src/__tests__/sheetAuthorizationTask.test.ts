// Required lazily, outside isolateModules, so one mock serves every test.
const mockNative = { startPayment: jest.fn() }
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: () => mockNative },
}))

function loadOnPlatform(os: 'android' | 'ios') {
  const registerHeadlessTask = jest.fn()
  const startPayment = mockNative.startPayment
  let getPaymentHandler!: typeof import('../paymentHandler').getPaymentHandler
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: os, select: (spec: any) => spec[os] ?? spec.default },
      AppRegistry: { registerHeadlessTask },
    }))
    getPaymentHandler = require('../paymentHandler').getPaymentHandler
  })
  return { getPaymentHandler, registerHeadlessTask, startPayment }
}

afterEach(() => {
  jest.dontMock('react-native')
})

describe('sheet authorization task', () => {
  it('is registered once on Android, with the native handler', () => {
    const { getPaymentHandler, registerHeadlessTask } =
      loadOnPlatform('android')

    getPaymentHandler()
    getPaymentHandler()

    expect(registerHeadlessTask).toHaveBeenCalledTimes(1)
    expect(registerHeadlessTask.mock.calls[0][0]).toBe(
      'ReactNativePaySheetAuthorization'
    )
  })

  it('is registered before the raw handler gets onAuthorize', () => {
    const { getPaymentHandler, registerHeadlessTask, startPayment } =
      loadOnPlatform('android')

    getPaymentHandler().startPayment({} as any, {
      onAuthorize: async () => ({ status: 'success' }),
    })

    expect(startPayment).toHaveBeenCalledTimes(1)
    expect(registerHeadlessTask.mock.invocationCallOrder[0]).toBeLessThan(
      startPayment.mock.invocationCallOrder[0]!
    )
  })

  it('never settles by itself, so native code decides when it ends', async () => {
    const { getPaymentHandler, registerHeadlessTask } =
      loadOnPlatform('android')
    getPaymentHandler()

    const task = registerHeadlessTask.mock.calls[0][1]()
    const settled = jest.fn()
    task({}).then(settled, settled)
    await Promise.resolve()

    expect(settled).not.toHaveBeenCalled()
  })

  it('is not registered on iOS', () => {
    const { getPaymentHandler, registerHeadlessTask } = loadOnPlatform('ios')

    getPaymentHandler()

    expect(registerHeadlessTask).not.toHaveBeenCalled()
  })
})
