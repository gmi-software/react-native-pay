import { NitroModules } from 'react-native-nitro-modules'
import type { PaymentHandler } from './specs/PaymentHandler.nitro'

/**
 * Error returned when `startPayment` is called while another payment is
 * still in flight. Matches the message used by the native handlers.
 */
export const PAYMENT_IN_PROGRESS_ERROR = 'A payment is already in progress'

let paymentHandler: PaymentHandler | undefined

/**
 * Returns the package-wide `PaymentHandler` instance.
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
