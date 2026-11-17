/**
 * Normalization and validation of recurring, deferred and automatic reload
 * requests.
 *
 * The rules are the stricter of Apple Pay's and Google Pay's, so a request
 * that passes works on both platforms.
 *
 * @module merchantTokens
 */

import type {
  AutomaticReloadPaymentRequest,
  DeferredPaymentRequest,
  MerchantTokenPaymentRequest,
  PaymentAmount,
  PaymentRequest,
  RecurringBillingItem,
  RecurringIntervalUnit,
  RecurringPaymentRequest,
} from '../types'
import { amountSign, normalizeAmount, normalizeItem } from './amounts'

const MAX_LABEL_LENGTH = 100
const MAX_BILLING_AGREEMENT_LENGTH = 300

// A Record, so adding a unit to the type fails to compile until it is listed.
const INTERVAL_UNITS: string[] = Object.keys({
  day: true,
  month: true,
  year: true,
} satisfies Record<RecurringIntervalUnit, true>)

// Google Pay: https, no query, fragment or trailing slash.
const URL_PATTERN = /^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/

function fail(message: string): never {
  throw new Error(message)
}

function checkText(field: string, value: unknown, maxLength = Infinity) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${field} must not be empty`)
  }
  if (value.length > maxLength) {
    fail(
      `${field} must be at most ${maxLength} characters, got ${value.length}`
    )
  }
}

function checkUrl(field: string, value: unknown) {
  if (
    typeof value !== 'string' ||
    !URL_PATTERN.test(value) ||
    value.endsWith('/')
  ) {
    fail(
      `${field} must be an https URL without query, fragment or trailing slash, got ${JSON.stringify(value)}`
    )
  }
}

function checkFutureDate(field: string, value: unknown, now: number): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail(`${field} must be a valid Date`)
  }
  if (value.getTime() <= now) {
    fail(`${field} must be in the future, got ${value.toISOString()}`)
  }
  return value
}

function checkPositive(label: string, amount: PaymentAmount) {
  if (amountSign(amount) <= 0) {
    fail(`Amount for "${label}" must be positive, got ${amount}`)
  }
}

function checkNotNegative(label: string, amount: PaymentAmount) {
  if (amountSign(amount) < 0) {
    fail(`Amount for "${label}" must not be negative, got ${amount}`)
  }
}

function checkBase(field: string, request: MerchantTokenPaymentRequest) {
  checkText(`${field}.description`, request.description)
  checkUrl(`${field}.managementUrl`, request.managementUrl)
  if (request.billingAgreement !== undefined) {
    checkText(
      `${field}.billingAgreement`,
      request.billingAgreement,
      MAX_BILLING_AGREEMENT_LENGTH
    )
  }
  if (request.tokenNotificationUrl !== undefined) {
    checkUrl(`${field}.tokenNotificationUrl`, request.tokenNotificationUrl)
  }
}

function normalizeRecurringItem(
  field: string,
  item: RecurringBillingItem,
  currencyCode: string,
  now: number
): RecurringBillingItem {
  checkText(`${field}.label`, item.label, MAX_LABEL_LENGTH)
  if (!INTERVAL_UNITS.includes(item.intervalUnit)) {
    fail(
      `${field}.intervalUnit must be one of ${INTERVAL_UNITS.join(', ')}, got ${JSON.stringify(item.intervalUnit)}`
    )
  }
  if (
    item.intervalCount !== undefined &&
    !(Number.isInteger(item.intervalCount) && item.intervalCount > 0)
  ) {
    fail(
      `${field}.intervalCount must be a positive integer, got ${item.intervalCount}`
    )
  }
  const start =
    item.startDate && checkFutureDate(`${field}.startDate`, item.startDate, now)
  const end =
    item.endDate && checkFutureDate(`${field}.endDate`, item.endDate, now)
  if (start && end && start.getTime() >= end.getTime()) {
    fail(`${field}.startDate must be before its endDate`)
  }
  return normalizeItem(item, currencyCode)
}

function normalizeRecurring(
  recurring: RecurringPaymentRequest,
  currencyCode: string,
  now: number
): RecurringPaymentRequest {
  checkBase('recurring', recurring)
  const regularBilling = normalizeRecurringItem(
    'recurring.regularBilling',
    recurring.regularBilling,
    currencyCode,
    now
  )
  checkPositive(regularBilling.label, regularBilling.amount)
  if (recurring.trialBilling === undefined) {
    return { ...recurring, regularBilling }
  }

  const trialBilling = normalizeRecurringItem(
    'recurring.trialBilling',
    recurring.trialBilling,
    currencyCode,
    now
  )
  checkNotNegative(trialBilling.label, trialBilling.amount)
  if (trialBilling.endDate === undefined) {
    fail('recurring.trialBilling.endDate is required')
  }
  if (
    regularBilling.startDate !== undefined &&
    regularBilling.startDate.getTime() < trialBilling.endDate.getTime()
  ) {
    fail(
      'recurring.regularBilling.startDate must not be before recurring.trialBilling.endDate'
    )
  }
  return { ...recurring, regularBilling, trialBilling }
}

function normalizeDeferred(
  deferred: DeferredPaymentRequest,
  currencyCode: string,
  now: number
): DeferredPaymentRequest {
  checkBase('deferred', deferred)
  checkText(
    'deferred.deferredBilling.label',
    deferred.deferredBilling.label,
    MAX_LABEL_LENGTH
  )
  const deferredBilling = normalizeItem(deferred.deferredBilling, currencyCode)
  checkPositive(deferredBilling.label, deferredBilling.amount)
  checkFutureDate('deferred.deferredBilling.date', deferredBilling.date, now)
  const { freeCancellation } = deferred
  if (freeCancellation !== undefined) {
    checkFutureDate(
      'deferred.freeCancellation.date',
      freeCancellation.date,
      now
    )
    // iOS checks that it names a time zone it knows.
    checkText('deferred.freeCancellation.timeZone', freeCancellation.timeZone)
  }
  return { ...deferred, deferredBilling }
}

function normalizeAutomaticReload(
  automaticReload: AutomaticReloadPaymentRequest,
  currencyCode: string
): AutomaticReloadPaymentRequest {
  checkBase('automaticReload', automaticReload)
  const billing = automaticReload.automaticReloadBilling
  checkText(
    'automaticReload.automaticReloadBilling.label',
    billing.label,
    MAX_LABEL_LENGTH
  )
  const thresholdLabel = `${billing.label} threshold`
  const automaticReloadBilling = {
    ...normalizeItem(billing, currencyCode),
    thresholdAmount: normalizeAmount(
      billing.thresholdAmount,
      currencyCode,
      thresholdLabel
    ),
  }
  checkPositive(billing.label, automaticReloadBilling.amount)
  checkNotNegative(thresholdLabel, automaticReloadBilling.thresholdAmount)
  return { ...automaticReload, automaticReloadBilling }
}

/**
 * Validates the `recurring`, `deferred` or `automaticReload` field of a
 * request and returns it with its amounts normalized. Returns no field for a
 * request without one.
 *
 * @throws Error if more than one is set, or the one set is invalid.
 */
export function normalizeMerchantTokens(
  request: PaymentRequest,
  currencyCode: string
): Pick<PaymentRequest, 'recurring' | 'deferred' | 'automaticReload'> {
  const { recurring, deferred, automaticReload } = request
  const count = [recurring, deferred, automaticReload].filter(
    (value) => value !== undefined
  ).length
  if (count > 1) {
    fail('Set at most one of recurring, deferred and automaticReload')
  }

  const now = Date.now()
  if (recurring !== undefined) {
    return { recurring: normalizeRecurring(recurring, currencyCode, now) }
  }
  if (deferred !== undefined) {
    return { deferred: normalizeDeferred(deferred, currencyCode, now) }
  }
  if (automaticReload !== undefined) {
    return {
      automaticReload: normalizeAutomaticReload(automaticReload, currencyCode),
    }
  }
  return {}
}
