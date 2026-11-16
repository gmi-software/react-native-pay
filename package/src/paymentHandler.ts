import type { PaymentHandler } from './specs/PaymentHandler.nitro'
import type { PaymentRequest, PaymentResult } from './types'
import { normalizePaymentRequest } from './utils/paymentRequest'
import { requireNitro } from './nitro'

/**
 * Error returned when `startPayment` is called while another payment is
 * still in flight. Matches the message used by the native handlers.
 */
export const PAYMENT_IN_PROGRESS_ERROR = 'A payment is already in progress'

/**
 * Result of `startPayment` while another payment is in flight, as the native
 * handlers return it. Copy it before handing it out.
 */
export const PAYMENT_IN_PROGRESS_RESULT: Readonly<PaymentResult> = {
  status: 'failed',
  code: 'IN_PROGRESS',
  success: false,
  error: PAYMENT_IN_PROGRESS_ERROR,
}

const NATIVE_MODULE_MISSING_ERROR =
  'React Native Pay: the native PaymentHandler is not available. ' +
  'Apple Pay and Google Pay need an iOS or Android build that includes ' +
  '@gmisoftware/react-native-pay and react-native-nitro-modules: rebuild the ' +
  'app after installing them (for Expo, `npx expo prebuild` and a development ' +
  'build; Expo Go is not supported). Web has no native module. In Jest, mock ' +
  'react-native-nitro-modules.'

let paymentHandler: PaymentHandler | undefined

/**
 * Returns the package-wide native `PaymentHandler` instance, created on first
 * use. Its
 * `startPayment` does not validate the request in JS: pass it through
 * `normalizePaymentRequest`, or use `HybridPaymentHandler`.
 *
 * The native in-progress guard lives on the instance, so the hook and the
 * exported `HybridPaymentHandler` must share one.
 *
 * @throws An `Error` naming the fix when the native module is missing.
 */
export function getPaymentHandler(): PaymentHandler {
  if (paymentHandler === undefined) {
    try {
      paymentHandler =
        requireNitro().NitroModules.createHybridObject<PaymentHandler>(
          'PaymentHandler'
        )
    } catch (cause) {
      throw new Error(NATIVE_MODULE_MISSING_ERROR, { cause })
    }
  }
  return paymentHandler
}

/** The `PaymentHandler` methods that `HybridPaymentHandler` offers. */
export type PaymentHandlerMethods = Pick<
  PaymentHandler,
  | 'payServiceStatus'
  | 'startPayment'
  | 'isPaymentInProgress'
  | 'openPaymentSetup'
>

/**
 * The exported `HybridPaymentHandler`. It delegates to the shared native
 * instance, but `startPayment` first validates the request with
 * `normalizePaymentRequest`, as `usePaymentCheckout` does, and resolves an
 * invalid one with `code: 'CONFIGURATION'` without calling native.
 */
export const validatingPaymentHandler: PaymentHandlerMethods = {
  payServiceStatus: (options) => getPaymentHandler().payServiceStatus(options),
  startPayment: async (request, options) => {
    let validatedRequest: PaymentRequest
    try {
      validatedRequest = normalizePaymentRequest(request)
    } catch (err) {
      return {
        status: 'failed',
        code: 'CONFIGURATION',
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    return options === undefined
      ? getPaymentHandler().startPayment(validatedRequest)
      : getPaymentHandler().startPayment(validatedRequest, options)
  },
  isPaymentInProgress: () => getPaymentHandler().isPaymentInProgress(),
  openPaymentSetup: () => getPaymentHandler().openPaymentSetup(),
}
