/**
 * Validation of a whole payment request before it reaches native code.
 *
 * @module paymentRequest
 */

import type { PaymentItem, PaymentItemKind, PaymentRequest } from '../types'
import { amountSign, normalizeItems, sumExactly } from './amounts'
import { warnIfGooglePayEnvironmentOmitted } from './googlePayEnvironment'
import { normalizeMerchantTokens } from './merchantTokens'

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/
const PAYMENT_ITEM_KINDS: readonly PaymentItemKind[] = [
  'subtotal',
  'tax',
  'discount',
]

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

// Native code would reject an unknown kind without naming the item.
function checkItemKinds(items: PaymentItem[]) {
  for (const { label, kind } of items) {
    if (kind !== undefined && !PAYMENT_ITEM_KINDS.includes(kind)) {
      throw new Error(
        `kind for "${label}" must be one of ${PAYMENT_ITEM_KINDS.map((k) => `"${k}"`).join(', ')}, got ${JSON.stringify(kind)}`
      )
    }
  }
}

// Google Pay requires a total label whenever the sheet lists the items.
function checkTotalLabel(totalLabel: unknown) {
  if (
    totalLabel !== undefined &&
    (typeof totalLabel !== 'string' || totalLabel.trim() === '')
  ) {
    throw new Error(
      `totalLabel must be a non-empty string, got ${JSON.stringify(totalLabel)}`
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
 * negative (discounts), but the total may not. An item's `kind` must be a
 * `PaymentItemKind`, and `totalLabel` must not be blank. An Android release
 * build warns once if `googlePayEnvironment` is omitted.
 *
 * `recurring`, `deferred` and `automaticReload` follow the stricter of Apple
 * Pay's and Google Pay's rules, so a request that passes works on both: dates
 * in the future, `https` URLs without query or trailing slash, labels of at
 * most 100 characters.
 *
 * @throws Error if a code, an amount, a `kind` or `totalLabel` is invalid,
 *   the total is negative, or a recurring, deferred or automatic reload
 *   request is invalid.
 */
export function normalizePaymentRequest(
  request: PaymentRequest
): PaymentRequest {
  warnIfGooglePayEnvironmentOmitted(request.googlePayEnvironment)
  const { currencyCode } = request
  checkCode('currencyCode', currencyCode, CURRENCY_CODE_PATTERN, 'USD')
  checkCode('countryCode', request.countryCode, COUNTRY_CODE_PATTERN, 'US')
  checkTotalLabel(request.totalLabel)
  checkItemKinds(request.paymentItems)
  const paymentItems = normalizeItems(request.paymentItems, currencyCode)

  const total = sumExactly(paymentItems.map((item) => item.amount))
  if (amountSign(total) < 0) {
    throw new Error(`Payment total must not be negative, got ${total}`)
  }

  return {
    ...request,
    paymentItems,
    ...(request.shippingMethods && {
      shippingMethods: normalizeItems(request.shippingMethods, currencyCode),
    }),
    ...normalizeMerchantTokens(request, currencyCode),
  }
}
