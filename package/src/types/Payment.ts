/**
 * Payment types based on PassKit framework
 * @see https://developer.apple.com/documentation/passkit
 */

import type { CNContact, PaymentContact } from './Contact'

export type PaymentItemType = 'final' | 'pending'

export type PaymentMethodType =
  | 'unknown'
  | 'debit'
  | 'credit'
  | 'prepaid'
  | 'store'

/**
 * A card network. Use these names in `PaymentRequest.supportedNetworks`.
 *
 * Google Pay offers `visa`, `mastercard`, `amex`, `discover`, `jcb` and
 * `interac`, plus `electron`, `maestro` and `elo` for Brazilian combo cards.
 * Apple Pay offers all of them, some only on newer iOS versions.
 *
 * `'unknown'` only appears in results, for a network this library cannot name.
 */
export type PaymentNetwork =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'jcb'
  | 'maestro'
  | 'electron'
  | 'elo'
  | 'idcredit'
  | 'interac'
  | 'privateLabel'
  | 'cartesBancaires'
  | 'chinaUnionPay'
  | 'dankort'
  | 'eftpos'
  | 'girocard'
  | 'mada'
  | 'mir'
  | 'quicPay'
  | 'suica'
  | 'vPay'
  | 'waon'
  | 'nanaco'
  | 'bancontact'
  | 'postFinance'
  | 'pagoBancomat'
  | 'tmoney'
  | 'meeza'
  | 'napas'
  | 'bankAxept'
  | 'himyan'
  | 'jaywan'
  | 'myDebit'
  | 'unknown'

export type PassActivationState =
  | 'activated'
  | 'requiresActivation'
  | 'activating'
  | 'suspended'
  | 'deactivated'

export type GooglePayEnvironment = 'TEST' | 'PRODUCTION'

/**
 * How Google Pay may authenticate a card. `'PAN_ONLY'` covers cards saved
 * to the Google account and returns the card number; `'CRYPTOGRAM_3DS'`
 * covers cards tokenized on the device and returns a 3-D Secure cryptogram.
 * Google Pay does not offer `jcb` or `discover` with `'CRYPTOGRAM_3DS'`.
 */
export type GooglePayAuthMethod = 'PAN_ONLY' | 'CRYPTOGRAM_3DS'

/**
 * Merchant capability. `'3DS'` and `'EMV'` are Apple Pay payment protocols
 * (EMV only covers China UnionPay); `'Credit'` and `'Debit'` limit the
 * accepted card types. iOS adds `'3DS'` when neither protocol is given.
 * Android only reads `'Debit'` without `'Credit'`, which leaves credit cards
 * out: Google Pay cannot leave debit cards out.
 */
export type MerchantCapability = '3DS' | 'EMV' | 'Credit' | 'Debit'

/**
 * How Apple Pay labels the shipping address and the shipping methods, for
 * example "Delivery Address" for `'delivery'`. iOS only.
 */
export type ShippingType =
  | 'shipping'
  | 'delivery'
  | 'storePickup'
  | 'servicePickup'

export interface PKPass {
  passTypeIdentifier: string
  serialNumber: string
  organizationName?: string
}

export interface PKSecureElementPass extends PKPass {
  primaryAccountIdentifier: string
  primaryAccountNumberSuffix: string
  deviceAccountIdentifier: string
  deviceAccountNumberSuffix: string
  passActivationState: PassActivationState
  devicePassIdentifier?: string
  pairedTerminalIdentifier?: string
}

/**
 * A monetary amount in the currency's major unit: `'19.99'` or `19.99`.
 *
 * Decimal strings are exact. Numbers are read as the shortest decimal that
 * round-trips (`19.99`, never `19.98999…`), so float arithmetic results such
 * as `0.1 + 0.2` fail validation instead of being rounded silently.
 */
export type PaymentAmount = number | string

export interface PaymentItem {
  label: string
  amount: PaymentAmount
  type: PaymentItemType
}

/**
 * A delivery option the payer can choose in the payment sheet.
 * @see PaymentRequest.shippingMethods
 */
export interface ShippingMethod {
  /**
   * Identifies the method in `PaymentResult.shippingMethod`. Must be unique
   * within the request.
   */
  identifier: string
  /** For example `'Express'`. */
  label: string
  /** Added to the total while the method is selected. Must not be negative. */
  amount: PaymentAmount
  /** Shown with the label, for example `'Arrives in 1–2 days'`. */
  detail?: string
}

export interface PaymentMethod {
  /**
   * Describes the card to the payer, for example `'Visa 1234'`. Comes from
   * the wallet; don't parse it.
   */
  displayName?: string
  /** `'unknown'` for a network this library cannot name. */
  network?: PaymentNetwork
  type: PaymentMethodType
  secureElementPass?: PKSecureElementPass // Available from iOS 13.4+
  billingAddress?: CNContact // Available from iOS 13.0+
}

export interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier: string
  paymentData: string // Base64 encoded Data from PKPaymentToken
}
export interface PaymentRequest {
  // Optional Apple Pay override for apps with multiple configured merchant IDs.
  // When omitted, iOS resolves the first configured entitlement automatically.
  applePayMerchantIdentifier?: string
  // Business name shown to the payer. iOS labels the Apple Pay total with it
  // ("Pay <merchantName>"); both platforms fall back to the app's name.
  merchantName?: string
  countryCode: string
  currencyCode: string
  paymentItems: PaymentItem[]
  // `MerchantCapability` values. Not typed as such: Nitro would generate a
  // native enum that rejects `'3ds'` or unknown values without a message.
  // On Android, only `'Debit'` without `'Credit'` has an effect.
  merchantCapabilities: string[]
  /**
   * `PaymentNetwork` values, matched ignoring case. An unknown name fails the
   * payment. A network the platform does not offer is left out, and the
   * payment fails when none is left: Google Pay has no `cartesBancaires`,
   * for example, and Apple Pay has no `bancontact` before iOS 16.
   */
  supportedNetworks: string[]
  /**
   * A `ShippingType` value. iOS only; Android ignores it. An unknown value
   * fails the payment on iOS. Not typed as `ShippingType` for the same
   * reason as `merchantCapabilities`.
   */
  shippingType?: string
  /**
   * Delivery options for the payer. The selected method is added to the
   * total as its own line and returned as `PaymentResult.shippingMethod`.
   * The order matters: the first method is selected by default on iOS, and
   * is the one charged on Android, where Google Pay cannot offer a choice
   * yet. Use it with `shippingContactRequired`.
   */
  shippingMethods?: ShippingMethod[]
  /**
   * Ask for the billing name and postal address, returned as
   * `PaymentResult.billingContact`.
   */
  billingContactRequired?: boolean
  /**
   * Ask for the shipping name and postal address, returned as
   * `PaymentResult.shippingContact`.
   */
  shippingContactRequired?: boolean
  /** Ask for an email address, returned as `PaymentResult.emailAddress`. */
  emailRequired?: boolean
  /**
   * Ask for a phone number, returned as `PaymentResult.phoneNumber`.
   * Google Pay only collects a phone number with an address. Without
   * `shippingContactRequired`, Android asks for it with the billing address,
   * and asks for at least the billing name, country and postal code even
   * when `billingContactRequired` is off.
   */
  phoneNumberRequired?: boolean
  // Google Pay specific configuration (Android only)
  googlePayMerchantId?: string
  googlePayEnvironment?: GooglePayEnvironment
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
  /**
   * `GooglePayAuthMethod` values, matched ignoring case. Defaults to both.
   * Android only. An unknown value fails the payment. Not typed as
   * `GooglePayAuthMethod` for the same reason as `merchantCapabilities`.
   */
  googlePayAllowedAuthMethods?: string[]
}

/**
 * What the payer chose in the payment sheet besides the card. Each field is
 * set only when the `PaymentRequest` asked for it.
 *
 * Passed to `StartPaymentOptions.onAuthorize` and included in `PaymentResult`.
 */
export interface PaymentDetails {
  /** Requested with `PaymentRequest.billingContactRequired`. */
  billingContact?: PaymentContact
  /** Requested with `PaymentRequest.shippingContactRequired`. */
  shippingContact?: PaymentContact
  /** Requested with `PaymentRequest.emailRequired`. */
  emailAddress?: string
  /** As the payer entered it. Requested with `PaymentRequest.phoneNumberRequired`. */
  phoneNumber?: string
  /**
   * The selected entry of `PaymentRequest.shippingMethods`, as you sent it.
   * On Android, always the first one.
   */
  shippingMethod?: ShippingMethod
}

export interface PaymentResult extends PaymentDetails {
  success: boolean
  transactionId?: string
  token?: PaymentToken
  error?: string
}

export type PaymentAuthorizationStatus = 'success' | 'failure'

/**
 * What your server decided about an authorized payment. Returned from
 * `StartPaymentOptions.onAuthorize`.
 */
export interface PaymentAuthorizationResult {
  status: PaymentAuthorizationStatus
  // Reported as `PaymentResult.error` when `status` is `'failure'`.
  error?: string
}

export interface StartPaymentOptions {
  /**
   * Called with the token after the user authorizes the payment. Charge it on
   * your server and resolve with the outcome. On iOS the Apple Pay sheet stays
   * up until this settles and then shows success or failure. On Android it
   * runs after the Google Pay sheet has closed.
   * It must settle within 25 seconds, or the payment fails with a timeout and
   * its later result is ignored. A rejection counts as `'failure'`.
   * On iOS, after a `'failure'` or a timeout the user can retry from the same
   * sheet, which calls this again with a new token. Make the charge idempotent
   * per order ID, not per token.
   * `details` holds the contact details and shipping method the request
   * asked for, so you can check them before charging.
   */
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
}

export interface PayServiceStatus {
  canMakePayments: boolean
  canSetupCards: boolean
}

/**
 * The cards `payServiceStatus` asks about. Pass the values of your
 * `PaymentRequest`, so the check matches the payment. Android asks Google
 * Pay about these cards; iOS only rejects unknown values.
 */
export interface PayServiceStatusOptions {
  /**
   * As `PaymentRequest.supportedNetworks`. Defaults to `visa`, `mastercard`,
   * `amex` and `discover`.
   */
  supportedNetworks?: string[]
  /** As `PaymentRequest.googlePayAllowedAuthMethods`. Defaults to both. */
  googlePayAllowedAuthMethods?: string[]
  /**
   * As `PaymentRequest.merchantCapabilities`. On Android, `'Debit'` without
   * `'Credit'` leaves credit cards out.
   */
  merchantCapabilities?: string[]
}

// Backward compatibility alias
export type ApplePayStatus = PayServiceStatus
