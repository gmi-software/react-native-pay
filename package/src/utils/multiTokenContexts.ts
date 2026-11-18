/**
 * Normalization and validation of `applePayMultiTokenContexts`.
 *
 * @module multiTokenContexts
 */

import { Platform } from 'react-native'
import type { PaymentRequest, PaymentTokenContext } from '../types'
import {
  amountSign,
  compareAmounts,
  normalizeAmount,
  sumExactly,
} from './amounts'

function fail(message: string): never {
  throw new Error(message)
}

function checkText(field: string, value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`applePayMultiTokenContexts[].${field} must not be empty`)
  }
}

function normalizeContext(
  context: PaymentTokenContext | undefined,
  currencyCode: string
): PaymentTokenContext {
  if (typeof context !== 'object' || context === null) {
    fail('applePayMultiTokenContexts entries must be objects')
  }
  checkText('merchantIdentifier', context.merchantIdentifier)
  checkText('externalIdentifier', context.externalIdentifier)
  checkText('merchantName', context.merchantName)
  if (context.merchantDomain !== undefined) {
    checkText('merchantDomain', context.merchantDomain)
  }
  const amount = normalizeAmount(
    context.amount,
    currencyCode,
    context.merchantName
  )
  if (amountSign(amount) <= 0) {
    fail(`Amount for "${context.merchantName}" must be positive, got ${amount}`)
  }
  return { ...context, amount }
}

/**
 * Validates `applePayMultiTokenContexts` and returns it with its amounts
 * normalized. Returns `undefined` for a request without contexts, and on
 * platforms other than iOS, which ignore them.
 *
 * The amounts must add up to exactly the total: `paymentItems` plus the
 * shipping method. Apple's documentation allows less, but PassKit refuses
 * the request ("The sum of all payment token context amounts must be equal to
 * the PKPaymentRequest total"). Shipping methods must all cost the same, so
 * that the total can't change in the sheet.
 *
 * @param paymentItemsTotal The sum of the normalized `paymentItems`.
 * @throws Error if a context is invalid, the amounts don't add up to the
 *   total, shipping methods differ in amount, or the request also sets
 *   `recurring`, `deferred` or `automaticReload`.
 */
export function normalizeMultiTokenContexts(
  request: PaymentRequest,
  currencyCode: string,
  paymentItemsTotal: string
): PaymentTokenContext[] | undefined {
  const contexts = request.applePayMultiTokenContexts
  if (Platform.OS !== 'ios' || contexts === undefined) {
    return undefined
  }
  if (!Array.isArray(contexts)) {
    fail('applePayMultiTokenContexts must be an array')
  }
  if (contexts.length === 0) {
    return undefined
  }
  if (
    request.recurring !== undefined ||
    request.deferred !== undefined ||
    request.automaticReload !== undefined
  ) {
    fail(
      "applePayMultiTokenContexts can't be combined with recurring, deferred or automaticReload"
    )
  }

  const shippingAmounts = (request.shippingMethods ?? []).map(
    (method) => method.amount
  )
  const [shippingAmount = 0] = shippingAmounts
  if (
    shippingAmounts.some(
      (amount) => compareAmounts(amount, shippingAmount) !== 0
    )
  ) {
    fail(
      'With applePayMultiTokenContexts, all shipping methods must cost the same: another method would change the total'
    )
  }

  // By index, so the holes of a sparse array, which map skips, fail too.
  const normalized = Array.from({ length: contexts.length }, (_, index) =>
    normalizeContext(contexts[index], currencyCode)
  )
  const total = sumExactly([paymentItemsTotal, shippingAmount])
  const sum = sumExactly(normalized.map((context) => context.amount))
  if (compareAmounts(sum, total) !== 0) {
    fail(
      `applePayMultiTokenContexts amounts must add up to the total of ${total}, got ${sum}`
    )
  }
  return normalized
}
