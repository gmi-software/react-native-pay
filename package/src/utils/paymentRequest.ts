/**
 * Validation of a whole payment request before it reaches native code.
 *
 * @module paymentRequest
 */

import type { PaymentRequest } from '../types'
import { amountSign, normalizeItems, sumExactly } from './amounts'
import { warnIfGooglePayEnvironmentOmitted } from './googlePayEnvironment'
import { normalizeMerchantTokens } from './merchantTokens'
import { normalizeMultiTokenContexts } from './multiTokenContexts'

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/

function checkCode(
  field: string,
  value: unknown,
  pattern: RegExp,
  example: string
) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(
      `${field} must be an upper-case code like "${example}", got ${JSON.stringify(value)}`
    )
  }
}

/**
 * Validates a payment request and returns a copy whose amounts are exact
 * decimal strings. `createPaymentRequest`, `usePaymentCheckout` and
 * `HybridPaymentHandler.startPayment` all call it; call it yourself to get the
 * error before the payment starts.
 *
 * `currencyCode` must be an ISO 4217 code (`'USD'`) and `countryCode` an
 * ISO 3166-1 alpha-2 code (`'US'`), both upper case. Line items may be
 * negative (discounts), but the total may not. An Android release build
 * warns once if `googlePayEnvironment` is omitted.
 *
 * `recurring`, `deferred` and `automaticReload` follow the stricter of Apple
 * Pay's and Google Pay's rules, so a request that passes works on both: dates
 * in the future, `https` URLs without query or trailing slash, labels of at
 * most 100 characters.
 *
 * `applePayMultiTokenContexts` amounts must add up to exactly the total, and
 * shipping methods must then all cost the same. On Android the field is
 * removed without being checked.
 *
 * @throws Error if a code or an amount is invalid, the total is negative,
 *   a recurring, deferred or automatic reload request is invalid, or
 *   `applePayMultiTokenContexts` is invalid.
 */
export function normalizePaymentRequest(
  request: PaymentRequest
): PaymentRequest {
  warnIfGooglePayEnvironmentOmitted(request.googlePayEnvironment)
  const { currencyCode } = request
  checkCode('currencyCode', currencyCode, CURRENCY_CODE_PATTERN, 'USD')
  checkCode('countryCode', request.countryCode, COUNTRY_CODE_PATTERN, 'US')
  const paymentItems = normalizeItems(request.paymentItems, currencyCode)

  const total = sumExactly(paymentItems.map((item) => item.amount))
  if (amountSign(total) < 0) {
    throw new Error(`Payment total must not be negative, got ${total}`)
  }

  const { applePayMultiTokenContexts, ...normalized } = {
    ...request,
    paymentItems,
    ...(request.shippingMethods && {
      shippingMethods: normalizeItems(request.shippingMethods, currencyCode),
    }),
    ...normalizeMerchantTokens(request, currencyCode),
  }
  const contexts = normalizeMultiTokenContexts(
    { ...normalized, applePayMultiTokenContexts },
    currencyCode,
    total
  )
  return contexts === undefined
    ? normalized
    : { ...normalized, applePayMultiTokenContexts: contexts }
}
