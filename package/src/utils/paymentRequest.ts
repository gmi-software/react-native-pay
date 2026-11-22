/**
 * Validation of a whole payment request before it reaches native code.
 *
 * @module paymentRequest
 */

import type {
  GooglePayCheckoutOption,
  PaymentItem,
  PaymentItemKind,
  PaymentRequest,
  PaymentSheetError,
  PaymentSheetErrorCode,
  PaymentSheetUpdate,
} from '../types'
import {
  amountSign,
  compareAmounts,
  normalizeItems,
  sumExactly,
} from './amounts'
import { warnIfGooglePayEnvironmentOmitted } from './googlePayEnvironment'
import { normalizeMerchantTokens } from './merchantTokens'
import { normalizeMultiTokenContexts } from './multiTokenContexts'

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/
const PAYMENT_ITEM_KINDS: readonly PaymentItemKind[] = [
  'subtotal',
  'tax',
  'discount',
]
const GOOGLE_PAY_CHECKOUT_OPTIONS: readonly GooglePayCheckoutOption[] = [
  'default',
  'completeImmediatePurchase',
  'continueToReview',
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

// Native code would reject an unknown value without naming the field.
function checkGooglePayCheckoutOption(option: unknown) {
  if (
    option !== undefined &&
    !GOOGLE_PAY_CHECKOUT_OPTIONS.includes(option as GooglePayCheckoutOption)
  ) {
    throw new Error(
      `googlePayCheckoutOption must be one of ${GOOGLE_PAY_CHECKOUT_OPTIONS.map((o) => `"${o}"`).join(', ')}, got ${JSON.stringify(option)}`
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
 * `PaymentItemKind`, `googlePayCheckoutOption` a `GooglePayCheckoutOption`,
 * and `totalLabel` must not be blank. An Android release build warns once if
 * `googlePayEnvironment` is omitted.
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
 * @throws Error if a code, an amount, a `kind`, `totalLabel` or
 *   `googlePayCheckoutOption` is invalid,
 *   the total is negative, a recurring, deferred or automatic reload request
 *   is invalid, or `applePayMultiTokenContexts` is invalid.
 */
export function normalizePaymentRequest(
  request: PaymentRequest
): PaymentRequest {
  warnIfGooglePayEnvironmentOmitted(request.googlePayEnvironment)
  const { currencyCode } = request
  checkCode('currencyCode', currencyCode, CURRENCY_CODE_PATTERN, 'USD')
  checkCode('countryCode', request.countryCode, COUNTRY_CODE_PATTERN, 'US')
  checkTotalLabel(request.totalLabel)
  checkGooglePayCheckoutOption(request.googlePayCheckoutOption)
  const paymentItems = normalizePaymentItems(request.paymentItems, currencyCode)
  const total = sumExactly(paymentItems.map((item) => item.amount))

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

/**
 * Line items may be negative (discounts), but their total may not. A `kind`
 * must be a `PaymentItemKind`.
 */
function normalizePaymentItems(
  items: PaymentItem[],
  currencyCode: string
): PaymentItem[] {
  checkItemKinds(items)
  const paymentItems = normalizeItems(items, currencyCode)
  const total = sumExactly(paymentItems.map((item) => item.amount))
  if (amountSign(total) < 0) {
    throw new Error(`Payment total must not be negative, got ${total}`)
  }
  return paymentItems
}

const SHEET_ERROR_CODES: string[] = Object.keys({
  shippingAddressInvalid: true,
  shippingAddressUnserviceable: true,
  couponCodeInvalid: true,
  couponCodeExpired: true,
  other: true,
} satisfies Record<PaymentSheetErrorCode, true>)

function checkSheetError(error: PaymentSheetError): PaymentSheetError {
  if (!SHEET_ERROR_CODES.includes(error.code)) {
    throw new Error(
      `error.code must be one of ${SHEET_ERROR_CODES.join(', ')}, got ${JSON.stringify(error.code)}`
    )
  }
  if (typeof error.message !== 'string' || error.message.trim() === '') {
    throw new Error('error.message must be a message for the payer')
  }
  return { code: error.code, message: error.message }
}

/**
 * With `applePayMultiTokenContexts`, PassKit needs the total to stay equal to
 * the contexts' sum, so an update may change the items and the shipping
 * methods but not what they add up to.
 */
function checkFixedTotal(update: PaymentSheetUpdate, request: PaymentRequest) {
  if (!request.applePayMultiTokenContexts?.length) {
    return
  }
  const { paymentItems, shippingMethods } = update
  if (paymentItems) {
    const expected = sumExactly(request.paymentItems.map((i) => i.amount))
    const got = sumExactly(paymentItems.map((item) => item.amount))
    if (compareAmounts(got, expected) !== 0) {
      throw new Error(
        `With applePayMultiTokenContexts, paymentItems must still add up to ${expected}, got ${got}: the total can't change in the sheet`
      )
    }
  }
  const shippingAmount = request.shippingMethods?.[0]?.amount ?? 0
  if (
    shippingMethods?.some(
      (method) => compareAmounts(method.amount, shippingAmount) !== 0
    )
  ) {
    throw new Error(
      `With applePayMultiTokenContexts, every shipping method must cost ${sumExactly([shippingAmount])}: the total can't change in the sheet`
    )
  }
}

/**
 * Validates what a sheet callback returned, with the rules of
 * `normalizePaymentRequest`, and returns a copy whose amounts are exact
 * decimal strings.
 *
 * @param request The request as `normalizePaymentRequest` returned it.
 * @throws Error if it isn't an object, an amount or a `kind` is invalid, the
 *   total is negative, `shippingMethods` is empty, the error is invalid, or
 *   with `applePayMultiTokenContexts` the update changes the total.
 */
export function normalizePaymentSheetUpdate(
  update: PaymentSheetUpdate,
  request: PaymentRequest
): PaymentSheetUpdate {
  const { currencyCode } = request
  if (typeof update !== 'object' || update === null || Array.isArray(update)) {
    const got = Array.isArray(update) ? 'an array' : String(update)
    throw new Error(`A sheet callback must resolve with an object, got ${got}`)
  }
  const { paymentItems, shippingMethods, error } = update
  if (shippingMethods?.length === 0) {
    throw new Error('shippingMethods must not be empty')
  }
  const normalized: PaymentSheetUpdate = {
    ...(paymentItems && {
      paymentItems: normalizePaymentItems(paymentItems, currencyCode),
    }),
    ...(shippingMethods && {
      shippingMethods: normalizeItems(shippingMethods, currencyCode),
    }),
    ...(error && { error: checkSheetError(error) }),
  }
  checkFixedTotal(normalized, request)
  return normalized
}
