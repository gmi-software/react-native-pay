/**
 * Utility functions for payment operations
 *
 * This module provides helper functions for creating and formatting
 * payment requests and related data structures.
 *
 * @module paymentHelpers
 *
 * @example
 * ```typescript
 * import { createPaymentRequest, calculateTotal } from 'react-native-pay'
 *
 * const request = createPaymentRequest({
 *   merchantIdentifier: 'merchant.com.example',
 *   amount: 29.99,
 *   label: 'Coffee Subscription'
 * })
 * ```
 */

import type { PaymentItem, PaymentRequest, PaymentNetwork } from '../types'

/**
 * Payment networks supported by both Apple Pay and Google Pay
 */
export const CommonNetworks = {
  VISA: 'visa',
  MASTERCARD: 'mastercard',
  AMEX: 'amex',
  DISCOVER: 'discover',
} as const

/**
 * Creates a payment item with the specified label, amount, and type.
 *
 * @param label - Display label for the payment item
 * @param amount - Amount in the payment currency
 * @param type - Item type: 'final' for confirmed amounts, 'pending' for estimates
 * @returns A PaymentItem object
 *
 * @example
 * ```typescript
 * const item = createPaymentItem('Subscription', 29.99, 'final')
 * const shipping = createPaymentItem('Shipping', 5.00, 'pending')
 * ```
 */
export function createPaymentItem(
  label: string,
  amount: number,
  type: 'final' | 'pending' = 'final'
): PaymentItem {
  return { label, amount, type }
}

/**
 * Calculates the total amount from an array of payment items.
 *
 * @param items - Array of payment items to sum
 * @returns Total amount
 *
 * @example
 * ```typescript
 * const items = [
 *   createPaymentItem('Product', 29.99),
 *   createPaymentItem('Tax', 2.40)
 * ]
 * const total = calculateTotal(items) // 32.39
 * ```
 */
export function calculateTotal(items: PaymentItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

/**
 * Creates a payment request with sensible defaults.
 *
 * Default values:
 * - countryCode: 'US'
 * - currencyCode: 'USD'
 * - supportedNetworks: ['visa', 'mastercard', 'amex', 'discover']
 * - merchantCapabilities: ['3DS']
 *
 * @param options - Payment request options (merchantIdentifier, amount, label required)
 * @returns Complete PaymentRequest object
 *
 * @example
 * ```typescript
 * const request = createPaymentRequest({
 *   merchantIdentifier: 'merchant.com.example',
 *   amount: 29.99,
 *   label: 'Coffee Subscription',
 *   countryCode: 'CA', // override default
 *   currencyCode: 'CAD' // override default
 * })
 * ```
 */
export function createPaymentRequest(
  options: Partial<PaymentRequest> & {
    merchantIdentifier: string
    amount: number
    label: string
  }
): PaymentRequest {
  const {
    merchantIdentifier,
    amount,
    label,
    countryCode = 'US',
    currencyCode = 'USD',
    supportedNetworks = [
      CommonNetworks.VISA,
      CommonNetworks.MASTERCARD,
      CommonNetworks.AMEX,
      CommonNetworks.DISCOVER,
    ],
    merchantCapabilities = ['3DS'],
    ...rest
  } = options

  return {
    merchantIdentifier,
    countryCode,
    currencyCode,
    paymentItems: [createPaymentItem(label, amount, 'final')],
    supportedNetworks,
    merchantCapabilities,
    ...rest,
  }
}

/**
 * Formats an amount to 2 decimal places.
 *
 * @param amount - Numeric amount to format
 * @returns Formatted amount string
 *
 * @example
 * ```typescript
 * formatAmount(29.9) // "29.90"
 * formatAmount(100) // "100.00"
 * ```
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

/**
 * Parses an amount string to a number.
 *
 * @param amountString - String representation of amount
 * @returns Parsed numeric amount
 *
 * @example
 * ```typescript
 * parseAmount("29.99") // 29.99
 * parseAmount("100") // 100
 * ```
 */
export function parseAmount(amountString: string): number {
  return parseFloat(amountString)
}

/**
 * Checks if a payment network is supported.
 * Case-insensitive comparison.
 *
 * @param network - Network to check
 * @param supportedNetworks - Array of supported networks
 * @returns True if network is supported
 *
 * @example
 * ```typescript
 * isNetworkSupported('visa', ['visa', 'mastercard']) // true
 * isNetworkSupported('AMEX', ['visa', 'amex']) // true
 * isNetworkSupported('discover', ['visa', 'mastercard']) // false
 * ```
 */
export function isNetworkSupported(
  network: string,
  supportedNetworks: string[]
): boolean {
  return supportedNetworks.some(
    (supported) => supported.toLowerCase() === network.toLowerCase()
  )
}

/**
 * Formats a payment network identifier for human-readable display.
 *
 * @param network - Payment network identifier
 * @returns Formatted network name
 *
 * @example
 * ```typescript
 * formatNetworkName('visa') // "Visa"
 * formatNetworkName('amex') // "American Express"
 * formatNetworkName('mastercard') // "Mastercard"
 * ```
 */
export function formatNetworkName(network: PaymentNetwork): string {
  const networkNames: Record<PaymentNetwork, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    jcb: 'JCB',
    maestro: 'Maestro',
    electron: 'Visa Electron',
    elo: 'Elo',
    idcredit: 'iD Credit',
    interac: 'Interac',
    privateLabel: 'Private Label',
  }
  return networkNames[network] || network
}
