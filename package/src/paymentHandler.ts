import { NitroModules } from 'react-native-nitro-modules'
import type { PaymentHandler } from './specs/PaymentHandler.nitro'
import type { PaymentRequest, PaymentResult } from './types'
import { normalizePaymentRequest } from './utils/paymentRequest'

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

let paymentHandler: PaymentHandler | undefined

/**
 * Returns the package-wide native `PaymentHandler` instance. Its
 * `startPayment` does not validate the request in JS: pass it through
 * `normalizePaymentRequest`, or use `HybridPaymentHandler`.
 *
 * The native in-progress guard lives on the instance, so the hook and the
 * exported `HybridPaymentHandler` must share one.
 */
export function getPaymentHandler(): PaymentHandler {
  if (paymentHandler === undefined) {
    paymentHandler =
      NitroModules.createHybridObject<PaymentHandler>('PaymentHandler')
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
