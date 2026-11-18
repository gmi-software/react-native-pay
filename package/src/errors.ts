import type { PaymentErrorCode } from './types'

/**
 * The `error` that `usePaymentCheckout` sets when a payment fails or can't
 * start. `code` uses the same values as `PaymentResult.code`, so you can
 * branch on it when `startPayment` returned `null`.
 *
 * - `'CONFIGURATION'`: the cart is empty or the request is invalid, such as
 *   an invalid amount. `cause` holds the validation error.
 * - `'UNKNOWN'`: the native call threw. `cause` holds what it threw.
 * - Any other code: copied from a failed `PaymentResult`.
 */
export class PaymentError extends Error {
  readonly code: PaymentErrorCode

  constructor(
    message: string,
    code: PaymentErrorCode,
    options?: { cause?: unknown }
  ) {
    super(message)
    // Keeps `instanceof PaymentError` working when classes are compiled to ES5.
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'PaymentError'
    this.code = code
    // Set here, not through `super`: not every JS engine reads the `cause` option.
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}
