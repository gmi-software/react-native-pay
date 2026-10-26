/**
 * Exact monetary amounts.
 *
 * Amounts are validated in JS and sent to native code as decimal strings
 * scaled to the currency (`'19.90'`, `'1000'`, `'1.230'`), so they never pass
 * through binary floating point on the way to PassKit or Google Pay.
 *
 * @module amounts
 */

import type { PaymentAmount, PaymentItem, PaymentRequest } from '../types'

/**
 * ISO 4217 currencies whose minor unit is not two digits.
 */
const CURRENCY_MINOR_UNITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
}

const DEFAULT_MINOR_UNITS = 2

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/

const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO = BigInt(2)

/**
 * `value = units / 10^scale`
 */
interface ExactDecimal {
  units: bigint
  scale: number
}

/**
 * Returns the number of decimal places the currency allows (ISO 4217).
 * Unknown codes default to 2.
 *
 * @example
 * ```typescript
 * getCurrencyMinorUnits('USD') // 2
 * getCurrencyMinorUnits('JPY') // 0
 * getCurrencyMinorUnits('KWD') // 3
 * ```
 */
export function getCurrencyMinorUnits(currencyCode: string): number {
  return CURRENCY_MINOR_UNITS[currencyCode.toUpperCase()] ?? DEFAULT_MINOR_UNITS
}

function powerOfTen(exponent: number): bigint {
  return BigInt('1'.padEnd(exponent + 1, '0'))
}

function parseDecimal(amount: PaymentAmount): ExactDecimal | null {
  let text: string
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return null
    // Shortest round-trip form: 19.99 -> "19.99". Exponent forms such as
    // "1e+21" or "1e-7" do not match the pattern and are rejected.
    text = String(amount)
  } else if (typeof amount === 'string') {
    text = amount
  } else {
    return null
  }

  const match = DECIMAL_PATTERN.exec(text)
  if (!match) return null

  const [, sign, whole = '', fraction = ''] = match
  const magnitude = BigInt(whole + fraction)
  return { units: sign ? -magnitude : magnitude, scale: fraction.length }
}

function rescale(value: ExactDecimal, scale: number): bigint {
  return value.units * powerOfTen(scale - value.scale)
}

function formatDecimal(units: bigint, scale: number): string {
  const negative = units < ZERO
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0')
  const whole = digits.slice(0, digits.length - scale)
  const fraction = digits.slice(digits.length - scale)
  return (negative ? '-' : '') + whole + (scale > 0 ? `.${fraction}` : '')
}

function sum(values: ExactDecimal[]): ExactDecimal {
  const scale = Math.max(0, ...values.map((value) => value.scale))
  const units = values.reduce(
    (total, value) => total + rescale(value, scale),
    ZERO
  )
  return { units, scale }
}

function describeAmount(amount: unknown): string {
  return typeof amount === 'string' ? `"${amount}"` : String(amount)
}

/**
 * Validates an amount and returns it as a decimal string with exactly as many
 * decimal places as the currency allows.
 *
 * @throws Error if the amount is not a finite number or a plain decimal
 *   string, or has more decimal places than the currency allows.
 *
 * @example
 * ```typescript
 * normalizeAmount(19.9, 'USD')     // "19.90"
 * normalizeAmount('1000', 'JPY')   // "1000"
 * normalizeAmount(1.005, 'USD')    // throws: more than 2 decimal places
 * normalizeAmount(0.1 + 0.2, 'USD') // throws: 0.30000000000000004
 * ```
 */
export function normalizeAmount(
  amount: PaymentAmount,
  currencyCode: string,
  label?: string
): string {
  const subject = label === undefined ? 'Amount' : `Amount for "${label}"`
  const value = parseDecimal(amount)
  if (value === null) {
    throw new Error(
      `${subject} must be a finite number or a decimal string like "19.99", got ${describeAmount(amount)}`
    )
  }

  const minorUnits = getCurrencyMinorUnits(currencyCode)
  if (value.scale <= minorUnits) {
    return formatDecimal(rescale(value, minorUnits), minorUnits)
  }

  const divisor = powerOfTen(value.scale - minorUnits)
  if (value.units % divisor !== ZERO) {
    throw new Error(
      `${subject} has more than ${minorUnits} decimal places, which ${currencyCode} allows, got ${describeAmount(amount)}`
    )
  }
  return formatDecimal(value.units / divisor, minorUnits)
}

function normalizeItems<Item extends Pick<PaymentItem, 'label' | 'amount'>>(
  items: Item[],
  currencyCode: string
): Item[] {
  return items.map((item) => ({
    ...item,
    amount: normalizeAmount(item.amount, currencyCode, item.label),
  }))
}

/**
 * Validates every amount in a payment request and returns a copy whose
 * amounts are exact decimal strings. Call it before passing a hand-built
 * request to `HybridPaymentHandler.startPayment`; `createPaymentRequest` and
 * `usePaymentCheckout` already do.
 *
 * Line items may be negative (discounts), but the total may not.
 *
 * @throws Error if an amount is invalid or the total is negative.
 */
export function normalizePaymentRequest(
  request: PaymentRequest
): PaymentRequest {
  const { currencyCode } = request
  const paymentItems = normalizeItems(request.paymentItems, currencyCode)

  const total = sum(
    paymentItems.map((item) => parseDecimal(item.amount) as ExactDecimal)
  )
  if (total.units < ZERO) {
    throw new Error(
      `Payment total must not be negative, got ${formatDecimal(total.units, total.scale)}`
    )
  }

  return {
    ...request,
    paymentItems,
    ...(request.shippingMethods && {
      shippingMethods: normalizeItems(request.shippingMethods, currencyCode),
    }),
  }
}

/**
 * Sums amounts exactly. Returns `NaN` if any amount is invalid.
 */
export function sumAmounts(amounts: PaymentAmount[]): number {
  const values = amounts.map(parseDecimal)
  if (values.some((value) => value === null)) return NaN

  const total = sum(values as ExactDecimal[])
  return Number(formatDecimal(total.units, total.scale))
}

/**
 * Rounds an amount half away from zero to the currency's decimal places.
 * Returns `'NaN'` if the amount is invalid.
 */
export function roundAmount(
  amount: PaymentAmount,
  currencyCode?: string
): string {
  const value = parseDecimal(amount)
  if (value === null) return 'NaN'

  const minorUnits =
    currencyCode === undefined
      ? DEFAULT_MINOR_UNITS
      : getCurrencyMinorUnits(currencyCode)
  if (value.scale <= minorUnits) {
    return formatDecimal(rescale(value, minorUnits), minorUnits)
  }

  const divisor = powerOfTen(value.scale - minorUnits)
  const remainder = value.units % divisor
  const absoluteRemainder = remainder < ZERO ? -remainder : remainder
  let units = value.units / divisor
  if (absoluteRemainder * TWO >= divisor) {
    units += value.units < ZERO ? -ONE : ONE
  }
  return formatDecimal(units, minorUnits)
}
