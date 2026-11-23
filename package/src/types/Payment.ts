/**
 * Payment types based on PassKit framework
 * @see https://developer.apple.com/documentation/passkit
 */

import type { CNContact, PaymentContact } from './Contact'

export type PaymentItemType = 'final' | 'pending'

/**
 * What a payment item is, for Google Pay's sheet. Android only; iOS shows
 * every item the same way. Give a discount a negative amount.
 * @see PaymentItem.kind
 */
export type PaymentItemKind = 'subtotal' | 'tax' | 'discount'

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
  | 'conecs'
  | 'elCorteIngles'
  | 'ruPay'
  | 'verve'
  | 'humo'
  | 'uzCard'
  | 'payPak'
  | 'maal'
  | 'elcard'
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
 * The label of the Google Pay sheet's button, sent as
 * `transactionInfo.checkoutOption`. Android only.
 *
 * - `'default'`: Google Pay picks "Continue" or "Pay".
 * - `'completeImmediatePurchase'`: "Pay now", for a payment that completes
 *   when the payer confirms. Not with a `'pending'` payment item: Google Pay
 *   only allows it for a final total.
 * - `'continueToReview'`: "Review Order", when your app shows a review step
 *   after the sheet.
 */
export type GooglePayCheckoutOption =
  | 'default'
  | 'completeImmediatePurchase'
  | 'continueToReview'

/**
 * Who encrypts the Google Pay token. Android only.
 *
 * - `'gateway'`: Google encrypts it for your payment gateway, set with
 *   `googlePayGateway` and `googlePayGatewayMerchantId`. Google Pay calls it
 *   `PAYMENT_GATEWAY`.
 * - `'direct'`: Google encrypts it with your own public key, and your server
 *   decrypts it. Google Pay calls it `DIRECT`. Needs Google's approval and
 *   PCI DSS compliance.
 */
export type GooglePayTokenizationType = 'gateway' | 'direct'

/**
 * How Google Pay tokenizes the card, sent as the card's
 * `tokenizationSpecification`. Android only.
 */
export interface GooglePayTokenization {
  type: GooglePayTokenizationType
  /**
   * Your base64-encoded uncompressed EC public key on the NIST P-256 curve,
   * the one your server decrypts the `ECv2` token with. Required for
   * `'direct'` in every environment, ignored for `'gateway'`. A missing or
   * blank key fails the payment with `'CONFIGURATION'`.
   */
  publicKey?: string
}

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

/**
 * Whether the payer may pay with Apple Pay Later, and if not, why. The sheet
 * tells the payer the reason. iOS only.
 */
export type ApplePayLaterAvailability =
  | 'available'
  | 'itemIneligible'
  | 'recurringTransaction'

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
  /**
   * Sent to Google Pay as the display item's type (`SUBTOTAL`, `TAX` or
   * `DISCOUNT`). Omit it for a regular line (`LINE_ITEM`). Android only.
   */
  kind?: PaymentItemKind
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

/**
 * What Google checked about the card the payer picked. Requested with
 * `PaymentRequest.googlePayAssuranceDetailsRequired`. Android only.
 */
export interface GooglePayAssuranceDetails {
  /** Google validated that the payer possesses the card. */
  accountVerified: boolean
  /**
   * Google authenticated the cardholder (identification and verification).
   * `false` leaves it to your usual risk checks, such as 3-D Secure.
   */
  cardHolderAuthenticated: boolean
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
  /**
   * Set when `PaymentRequest.googlePayAssuranceDetailsRequired` asked for it
   * and Google Pay returned it. Android only.
   */
  assuranceDetails?: GooglePayAssuranceDetails
}

export interface PaymentToken {
  paymentMethod: PaymentMethod
  // Apple's transaction identifier on iOS. Missing on Android: Google Pay
  // doesn't return one.
  transactionIdentifier?: string
  // iOS: base64 of the PKPaymentToken payment data. Android: Google Pay's
  // tokenizationData.token, as is (gateway token JSON or encrypted payload).
  paymentData: string
}

/**
 * How often a recurring payment repeats, with
 * `RecurringBillingItem.intervalCount`. No `'week'`: Apple Pay refuses it, so
 * use `'day'` with `intervalCount: 7`.
 */
export type RecurringIntervalUnit = 'day' | 'month' | 'year'

/**
 * One phase of a recurring payment: what the payer is charged, and how often.
 * Dates must be in the future.
 */
export interface RecurringBillingItem {
  /** For example `'Premium Monthly'`. At most 100 characters. */
  label: string
  /** Charged every interval. Must be positive, except for a free trial (`0`). */
  amount: PaymentAmount
  intervalUnit: RecurringIntervalUnit
  /** A positive integer: `7` with `'day'` is every week. Defaults to 1. */
  intervalCount?: number
  /** First charge. Omit to start right away, or right after the trial. */
  startDate?: Date
  /** Last charge. Omit for no end. Required for a trial. */
  endDate?: Date
}

/**
 * Charged later, on one date: a hotel booking or a pre-order.
 * @see DeferredPaymentRequest
 */
export interface DeferredBillingItem {
  /** For example `'Hotel Booking'`. At most 100 characters. */
  label: string
  /** Must be positive. */
  amount: PaymentAmount
  /** When the amount is charged. Must be in the future. */
  date: Date
}

/**
 * Charged whenever a stored balance falls below a threshold: a transit card
 * or a gift card.
 * @see AutomaticReloadPaymentRequest
 */
export interface AutomaticReloadBillingItem {
  /** For example `'Coffee Card Top-Up'`. At most 100 characters. */
  label: string
  /** Charged on each reload. Must be positive. */
  amount: PaymentAmount
  /** The balance that triggers a reload. Must not be negative. */
  thresholdAmount: PaymentAmount
}

/**
 * Fields shared by the recurring, deferred and automatic reload requests.
 * The payment asks for a merchant token, which your payment provider can
 * charge later without the payer. Apple Pay returns a device token instead
 * when the card's network has no merchant tokens, so check with your
 * provider which one you got.
 */
export interface MerchantTokenPaymentRequest {
  /** What the payer agrees to, for example `'Premium membership'`. iOS only. */
  description: string
  /**
   * Where the payer can change or cancel it. An `https:` URL without query,
   * fragment or trailing slash, as Google Pay requires.
   */
  managementUrl: string
  /** The terms the payer agrees to. At most 300 characters. */
  billingAgreement?: string
  /**
   * Where Apple or Google tell your server that the merchant token changed.
   * Same rules as `managementUrl`.
   */
  tokenNotificationUrl?: string
}

/** A subscription. Apple Pay needs iOS 16. */
export interface RecurringPaymentRequest extends MerchantTokenPaymentRequest {
  regularBilling: RecurringBillingItem
  /**
   * A cheaper first phase. Needs an `endDate`; `regularBilling` starts then
   * unless it has its own `startDate`.
   */
  trialBilling?: RecurringBillingItem
}

/** A payment charged later, on one date. Apple Pay needs iOS 16.4. */
export interface DeferredPaymentRequest extends MerchantTokenPaymentRequest {
  deferredBilling: DeferredBillingItem
  /** iOS only; Android ignores it. */
  freeCancellation?: FreeCancellation
}

/**
 * Until when the payer can cancel a deferred payment for free.
 * @see DeferredPaymentRequest.freeCancellation
 */
export interface FreeCancellation {
  /** Must be in the future. */
  date: Date
  /**
   * The IANA time zone of the place being paid for, such as
   * `'Europe/Warsaw'` for a hotel there. The sheet shows `date` in it.
   */
  timeZone: string
}

/** A balance topped up automatically. Apple Pay needs iOS 16. */
export interface AutomaticReloadPaymentRequest
  extends MerchantTokenPaymentRequest {
  automaticReloadBilling: AutomaticReloadBillingItem
}

/**
 * One merchant in a payment shared by several merchants, such as a
 * marketplace order or a trip with a flight and a hotel. Apple Pay needs
 * iOS 16.
 * @see PaymentRequest.applePayMultiTokenContexts
 */
export interface PaymentTokenContext {
  /**
   * The merchant's Apple Pay merchant identifier, if it has one. Otherwise,
   * and for your own share, your own. Your server finds this merchant's
   * cryptogram in the token by it.
   */
  merchantIdentifier: string
  /**
   * Your own stable ID for the merchant. Use the same one every time you
   * request a payment for the same merchant.
   */
  externalIdentifier: string
  /** Shown to the payer. */
  merchantName: string
  /** The merchant's top-level domain, for example `'hotel.example.com'`. */
  merchantDomain?: string
  /**
   * What this merchant may charge, in the request's currency. Must be
   * positive.
   */
  amount: PaymentAmount
}

export interface PaymentRequest {
  // Optional Apple Pay override for apps with multiple configured merchant IDs.
  // When omitted, iOS reads the first ID in the Info.plist key
  // `ReactNativePayApplePayMerchantIdentifiers`, which the Expo plugin writes.
  applePayMerchantIdentifier?: string
  // Business name shown to the payer. iOS labels the Apple Pay total with it
  // ("Pay <merchantName>"); both platforms fall back to the app's name.
  merchantName?: string
  /**
   * Labels the total in the Google Pay sheet, for example `'Razem'`.
   * Defaults to `'Total'`. Android only: iOS labels the total with
   * `merchantName`. Google Pay shows no total label for `recurring`,
   * `deferred` and `automaticReload` payments, so it has no effect there.
   */
  totalLabel?: string
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
   * The order matters: the first method is selected by default. On Android
   * the payer can pick another only when the payment has a sheet callback,
   * such as `onShippingMethodChange`; otherwise the first one is charged. Use it with
   * `shippingContactRequired`.
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
  /**
   * Charge again later: a subscription, a payment on a later date, or a
   * balance top-up. Set at most one. `paymentItems` stay what the payer pays
   * today, which may be nothing; the library adds the later charges to the
   * sheet. On iOS versions without support, the payment fails with
   * `'NOT_AVAILABLE'`.
   */
  recurring?: RecurringPaymentRequest
  deferred?: DeferredPaymentRequest
  automaticReload?: AutomaticReloadPaymentRequest
  /**
   * Pay several merchants with one sheet. The payment token holds a
   * cryptogram for each of them, which your server reads after decrypting
   * it. The amounts must add up to exactly the total, so list yourself too
   * for any share you keep, and all `shippingMethods` must cost the same.
   * A `PaymentSheetUpdate` must keep the total, or the sheet keeps its items.
   * Not together with `recurring`, `deferred` or `automaticReload`. iOS
   * only: Android removes it without checking these rules. Below iOS 16, the
   * payment fails with `'NOT_AVAILABLE'`.
   */
  applePayMultiTokenContexts?: PaymentTokenContext[]
  /**
   * A coupon code already applied, shown in the sheet's coupon field.
   * `paymentItems` must already include its discount. Needs
   * `StartPaymentOptions.onCouponCodeChange`, or the payment fails with
   * `'CONFIGURATION'`. iOS only; Android ignores it.
   */
  couponCode?: string
  /**
   * The merchant's ISO 18245 category code, from 0 to 9999, for example
   * `5411` for grocery stores. Apple Pay leaves out the cards that don't
   * accept the category. iOS 18 and later; earlier versions ignore it.
   * Another value, including a fraction, fails the payment with
   * `'CONFIGURATION'` on any iOS version. iOS only; Android ignores it.
   */
  applePayMerchantCategoryCode?: number
  /**
   * An `ApplePayLaterAvailability` value. Hides Apple Pay Later and tells
   * the payer why, for example for gift cards, which must not be paid over
   * time. iOS 17 and later; earlier versions ignore it. An unknown value
   * fails the payment on iOS. Not typed as `ApplePayLaterAvailability` for
   * the same reason as `merchantCapabilities`. iOS only; Android ignores it.
   */
  applePayLaterAvailability?: string
  // Google Pay specific configuration (Android only)
  googlePayMerchantId?: string
  googlePayEnvironment?: GooglePayEnvironment
  /**
   * The gateway for `'gateway'` tokenization, such as `'stripe'`. Required
   * in PRODUCTION for `'gateway'`.
   */
  googlePayGateway?: string
  /** Your merchant ID at the gateway. Required in PRODUCTION for `'gateway'`. */
  googlePayGatewayMerchantId?: string
  /**
   * Who encrypts the token. Omitted, it is `'gateway'`, which uses
   * `googlePayGateway` and `googlePayGatewayMerchantId`. `'direct'` needs
   * `publicKey` and ignores the gateway fields. Android only.
   */
  googlePayTokenization?: GooglePayTokenization
  /**
   * `GooglePayAuthMethod` values, matched ignoring case. Defaults to both.
   * Android only. An unknown value fails the payment. Not typed as
   * `GooglePayAuthMethod` for the same reason as `merchantCapabilities`.
   */
  googlePayAllowedAuthMethods?: string[]
  /**
   * `false` leaves prepaid cards out, so the payer cannot pick one. Defaults
   * to `true`. Android only; Apple Pay has no such option.
   */
  googlePayAllowPrepaidCards?: boolean
  /**
   * `true` asks Google Pay whether it verified the card and authenticated
   * the cardholder, returned as `token.paymentMethod.assuranceDetails`.
   * Defaults to `false`. Android only.
   */
  googlePayAssuranceDetailsRequired?: boolean
  /**
   * The label of the Google Pay sheet's button. Omitted, Google Pay picks
   * "Continue" or "Pay", as with `'default'`. `'completeImmediatePurchase'`
   * with a `'pending'` payment item fails the payment with
   * `'CONFIGURATION'` on Android. No effect on `recurring`, `deferred` and
   * `automaticReload` payments, whose Google Pay objects have no such option.
   * Android only.
   */
  googlePayCheckoutOption?: GooglePayCheckoutOption
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
   * The selected shipping method, as you sent it in
   * `PaymentRequest.shippingMethods` or a later `PaymentSheetUpdate`.
   * On Android, always the first one.
   */
  shippingMethod?: ShippingMethod
  /**
   * The last coupon code `onCouponCodeChange` accepted without an error, or
   * `PaymentRequest.couponCode`. Apple Pay doesn't put it in the token, so
   * charge the discount for this code. iOS only.
   */
  couponCode?: string
}

/**
 * How a payment ended. `'cancelled'` means the user closed the sheet before
 * authorizing; it is not an error.
 */
export type PaymentStatus = 'success' | 'cancelled' | 'failed'

/**
 * Why a payment did not succeed. Set on every result whose `status` is not
 * `'success'`.
 *
 * - `'CANCELLED'`: the user closed the sheet before authorizing.
 * - `'IN_PROGRESS'`: another payment is still in flight. No sheet was shown.
 * - `'CONFIGURATION'`: the request or the app's setup is invalid, such as a
 *   missing merchant ID or an invalid amount. Retrying won't help.
 * - `'NOT_AVAILABLE'`: the device can't show the payment sheet right now.
 * - `'PROVIDER_ERROR'`: Apple Pay, Google Pay or your `onAuthorize` reported a
 *   failure, including an `onAuthorize` timeout.
 * - `'UNKNOWN'`: anything else.
 */
export type PaymentErrorCode =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'CONFIGURATION'
  | 'NOT_AVAILABLE'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN'

export interface PaymentResult extends PaymentDetails {
  status: PaymentStatus
  code?: PaymentErrorCode
  // `status === 'success'`. Kept for compatibility.
  success: boolean
  token?: PaymentToken
  // A message for logs. Also set when `status` is `'cancelled'`.
  error?: string
}

export type PaymentAuthorizationStatus = 'success' | 'failure'

/**
 * What your server decided about an authorized payment. Returned from
 * `StartPaymentOptions.onAuthorize`.
 */
export interface PaymentAuthorizationResult {
  status: PaymentAuthorizationStatus
  // Reported as `PaymentResult.error`, with code `'PROVIDER_ERROR'`, when
  // `status` is `'failure'`. On Android the Google Pay sheet also shows it to
  // the payer, so write it for them, such as "Card declined".
  error?: string
}

export interface StartPaymentOptions {
  /**
   * Called with the token after the user authorizes the payment. Charge it on
   * your server and resolve with the outcome. The Apple Pay or Google Pay
   * sheet stays up until this settles and then shows success or failure; on
   * Android the sheet shows your `error`. If Google Pay returns a payment
   * without asking first, this runs after its sheet has closed.
   * It must settle within 25 seconds, or the payment fails with a timeout and
   * its later result is ignored. A rejection counts as `'failure'`.
   * After a `'failure'` or a timeout the user can retry from the same sheet,
   * which calls this again with a new token. Allow one successful charge
   * per order ID, not per token.
   * `details` holds the contact details and shipping method the request
   * asked for, so you can check them before charging.
   */
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
  /**
   * Called when the payer picks a shipping address in the sheet, including
   * the one it opens with, so you can update the cart: tax or delivery by
   * region, or an address you don't deliver to. Needs
   * `PaymentRequest.shippingContactRequired`.
   * The address is redacted until the payer authorizes; the full one comes in
   * `onAuthorize`. On Android, not for recurring, deferred or automatic
   * reload payments, which Google Pay can't update.
   * See `PaymentSheetUpdate` for the rules all sheet callbacks share.
   */
  onShippingAddressChange?: (
    address: PaymentSheetAddress,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  /**
   * Called when the payer picks another shipping method. Without it, the
   * sheet adds the method's amount to the current items itself. On iOS an
   * `error` is not shown: Apple Pay has none for this change. On Android it
   * needs `shippingContactRequired`.
   */
  onShippingMethodChange?: (
    shippingMethod: ShippingMethod,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  /**
   * Called when the payer picks a card, including the one the sheet opens
   * with: for example a surcharge for credit cards. On Android an `error` is
   * not shown: Google Pay has none for a card.
   */
  onPaymentMethodChange?: (
    card: PaymentSheetCard,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  /**
   * Shows a coupon field in the sheet and is called when the payer enters or
   * changes a code; an empty field is `''`. Return `couponCodeInvalid` or
   * `couponCodeExpired` to refuse it. The code accepted last is
   * `PaymentDetails.couponCode`. iOS only; Google Pay has no coupon field.
   */
  onCouponCodeChange?: (
    couponCode: string,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
}

/**
 * Why the sheet refuses the payer's choice. The payer can't pay until they
 * change it.
 *
 * - `'shippingAddressInvalid'`: the address is wrong, for example a postal
 *   code that doesn't match the city.
 * - `'shippingAddressUnserviceable'`: a valid address you don't deliver to.
 * - `'couponCodeInvalid'`, `'couponCodeExpired'`: from `onCouponCodeChange`.
 * - `'other'`: anything else.
 */
export type PaymentSheetErrorCode =
  | 'shippingAddressInvalid'
  | 'shippingAddressUnserviceable'
  | 'couponCodeInvalid'
  | 'couponCodeExpired'
  | 'other'

export interface PaymentSheetError {
  code: PaymentSheetErrorCode
  /** Shown to the payer. */
  message: string
}

/**
 * What a sheet callback changes. A field you leave out stays as it is.
 *
 * As in `PaymentRequest`, return the payment items only: the library adds the
 * selected shipping method, later charges and the total. Amounts follow the
 * same rules as the request.
 *
 * Every sheet callback must settle within 25 seconds, as `onAuthorize`. If it
 * rejects, times out or returns something invalid, the sheet keeps its
 * current items without an error. A rejection or an invalid update is logged
 * in development.
 */
export interface PaymentSheetUpdate {
  /** The new cart, replacing the current one. */
  paymentItems?: PaymentItem[]
  /**
   * The new shipping methods. The selected one stays selected while it is in
   * the list; otherwise the first one is selected. Must not be empty.
   */
  shippingMethods?: ShippingMethod[]
  error?: PaymentSheetError
}

/**
 * A shipping address before the payer authorizes. Apple Pay and Google Pay
 * leave out the street, the name, the email and the phone, and for some
 * countries, such as the UK and Canada, part of the postal code.
 */
export interface PaymentSheetAddress {
  /** ISO 3166-1 alpha-2, such as `'US'`. */
  countryCode: string
  /** A state or province, such as `'CA'`. */
  administrativeArea?: string
  /** A city. */
  locality?: string
  postalCode?: string
}

/** The card the payer picked in the sheet. */
export interface PaymentSheetCard {
  /** `'unknown'` for a network this library cannot name. */
  network?: PaymentNetwork
  type: PaymentMethodType
  /**
   * Describes the card to the payer, for example `'Visa 1234'`. Don't parse
   * it. iOS only.
   */
  displayName?: string
}

/**
 * What the payer has chosen in the sheet so far, passed to every sheet
 * callback, so each one can compute the whole cart: a coupon stays applied
 * when the address changes. Includes the change the callback is called for.
 */
export interface PaymentSheetSelection {
  /** Set once the sheet has reported one. */
  shippingAddress?: PaymentSheetAddress
  shippingMethod?: ShippingMethod
  /** Set once the sheet has reported one. */
  card?: PaymentSheetCard
  /**
   * The last code accepted without an error, or `PaymentRequest.couponCode`.
   * In `onCouponCodeChange`, the code being checked. iOS only.
   */
  couponCode?: string
}

/**
 * Wallet readiness on this device, from `HybridPaymentHandler.payServiceStatus()`.
 */
export interface PayServiceStatus {
  /**
   * The device can pay with Apple Pay or Google Pay, with or without a card.
   * iOS: `PKPaymentAuthorizationViewController.canMakePayments()`.
   * Android: `isReadyToPay` without `existingPaymentMethodRequired`.
   */
  isSupported: boolean
  /**
   * The user has a card ready on one of the checked networks.
   * iOS: `canMakePayments(usingNetworks:capabilities:)`.
   * Android: `isReadyToPay` with `existingPaymentMethodRequired: true`.
   */
  hasActiveCard: boolean
}

/**
 * What `payServiceStatus` checks. Pass the values your payment request uses.
 */
export interface PayServiceStatusOptions {
  // Networks a card must be on to count for `hasActiveCard`, as
  // `PaymentRequest.supportedNetworks`. Defaults to
  // `['visa', 'mastercard', 'amex', 'discover']`.
  supportedNetworks?: string[]
  // `MerchantCapability` values. iOS: what a card must support; defaults to
  // `['3DS']`, and `'3DS'` is added when neither `'3DS'` nor `'EMV'` is given.
  // Android: `'Debit'` without `'Credit'` leaves credit cards out.
  merchantCapabilities?: string[]
  // Android only. As `PaymentRequest.googlePayAllowedAuthMethods`. Defaults
  // to both.
  googlePayAllowedAuthMethods?: string[]
  // Android only. As `PaymentRequest.googlePayAllowPrepaidCards`. Defaults
  // to `true`.
  googlePayAllowPrepaidCards?: boolean
  // Android only. The Google Pay environment to ask. Defaults to `'TEST'`.
  googlePayEnvironment?: GooglePayEnvironment
}

// Backward compatibility alias
export type ApplePayStatus = PayServiceStatus
