import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

const mockPayServiceStatus = jest.fn()
const mockStartPayment = jest.fn()

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => ({
      payServiceStatus: (...args: any[]) => mockPayServiceStatus(...args),
      startPayment: (...args: any[]) => mockStartPayment(...args),
      isPaymentInProgress: () => false,
    })),
  },
}))

import {
  usePaymentCheckout,
  type UsePaymentCheckoutConfig,
} from '../usePaymentCheckout'

const globals = globalThis as unknown as { __DEV__: boolean }

describe('usePaymentCheckout in an Android release build', () => {
  let consoleWarn: jest.SpyInstance
  const isDev = globals.__DEV__

  beforeEach(() => {
    globals.__DEV__ = false
    jest.replaceProperty(Platform, 'OS', 'android')
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockPayServiceStatus.mockResolvedValue({
      isSupported: true,
      hasActiveCard: true,
    })
    mockStartPayment.mockResolvedValue({ status: 'success', success: true })
  })

  afterEach(() => {
    globals.__DEV__ = isDev
    jest.restoreAllMocks()
  })

  const checkOut = async (config: UsePaymentCheckoutConfig) => {
    const { result } = renderHook(
      (props: UsePaymentCheckoutConfig) => usePaymentCheckout({ ...props }),
      { initialProps: config }
    )
    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false)
    })
    act(() => {
      result.current.addItem('Coffee', 4.99)
    })
    await act(async () => {
      await result.current.startPayment()
    })
  }

  it('warns once per app run, only when googlePayEnvironment is omitted', async () => {
    await checkOut({ googlePayEnvironment: 'TEST' })
    expect(consoleWarn).not.toHaveBeenCalled()

    await checkOut({})
    await checkOut({})
    expect(consoleWarn).toHaveBeenCalledTimes(1)
    expect(consoleWarn.mock.calls[0][0]).toContain(
      'googlePayEnvironment is not set'
    )
  })
})
