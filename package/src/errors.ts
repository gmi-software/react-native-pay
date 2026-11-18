import type { PaymentErrorCode } from './types'

/**
 * The `error` that `usePaymentCheckout` sets when a payment fails or can't
 * start. `code` uses the same values as `PaymentResult.code`.
 *
 * - `'CONFIGURATION'`: the cart is empty, with no `cause`, or the request is
 *   invalid, such as an invalid amount, with the validation error as `cause`.
 * - `'UNKNOWN'`: the native call threw, with what it threw as `cause`.
 * - Any other code: copied from a failed `PaymentResult`. A failed result
 *   without a code gives `'UNKNOWN'`.
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
