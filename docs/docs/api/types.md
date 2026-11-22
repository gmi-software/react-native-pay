# Types

TypeScript types exported from `@gmisoftware/react-native-pay`. Use them for request/result handling and server integration.

## PaymentAmount

A monetary amount in the currency's major unit (dollars, not cents).

```ts
type PaymentAmount = number | string
```

- **Decimal string** (`'19.99'`): exact. Must match `^-?\d+(\.\d+)?$`; no exponents, spaces, or thousands separators.
- **Number** (`19.99`): read as the shortest decimal that round-trips, so `19.99` stays exactly `19.99`. Results of float arithmetic such as `0.1 + 0.2` (`0.30000000000000004`) fail validation instead of being rounded.

Before a payment starts, every amount is validated and sent to native code as a decimal string with the currency's number of decimal places (ISO 4217: 2 for USD, 0 for JPY, 3 for KWD). Native code converts it with `NSDecimalNumber` (iOS) and `BigDecimal` (Android), never through `Double`. A payment does not start when:

- an amount is not a finite number or a plain decimal string (`NaN`, `Infinity`, `'abc'`);
- an amount has more decimal places than the currency allows (`1.005` in USD, `'1200.5'` in JPY);
- the total of `paymentItems` is negative. Negative line items (discounts) are allowed.

Google Pay accepts at most two decimal places, so on Android a three-decimal amount such as `'1.234'` KWD fails with an error.

---

## PaymentItem

A single line item (label, amount, type, and an optional kind).

```ts no-check
interface PaymentItem {
  label: string
  amount: PaymentAmount // number | string
  type: 'final' | 'pending'
  kind?: 'subtotal' | 'tax' | 'discount' // Android only
}
```

`type` is exported as `PaymentItemType`.

- **final** — Confirmed amount (e.g. product price, tax).
- **pending** — Estimate (e.g. shipping that may change).

If any item is `pending`, the total is an estimate too: Google Pay receives `totalPriceStatus: 'ESTIMATED'` and Apple Pay marks the total summary item as `.pending`. Each item is sent to Google Pay as a display item with `status` set to `FINAL` or `PENDING`.

`kind` is exported as `PaymentItemKind`. Google Pay receives it as the display item's type: `'subtotal'` as `SUBTOTAL`, `'tax'` as `TAX` and `'discount'` as `DISCOUNT`. An item without `kind` is a `LINE_ITEM`, and the selected [shipping method](#shippingmethod) is a `SHIPPING_OPTION`. Give a discount a negative amount: `kind` only changes how Google Pay labels the line, not how it is added to the total. iOS ignores `kind`. Any other value throws before the payment starts.

```ts
import type { PaymentItem } from '@gmisoftware/react-native-pay'

const items: PaymentItem[] = [
  { label: 'Coffee beans', amount: '18.00', type: 'final' },
  { label: 'Coupon', amount: '-3.00', type: 'final', kind: 'discount' },
  { label: 'VAT', amount: '3.45', type: 'final', kind: 'tax' },
]
```

---

## PaymentRequest

Full request passed to the native layer (or to `HybridPaymentHandler.startPayment`).

```ts no-check
interface PaymentRequest {
  applePayMerchantIdentifier?: string
  merchantName?: string
  totalLabel?: string              // Google Pay total label, default 'Total'
  countryCode: string              // ISO 3166-1 alpha-2, upper case: 'US'
  currencyCode: string             // ISO 4217, upper case: 'USD'
  paymentItems: PaymentItem[]
  merchantCapabilities: string[]
  supportedNetworks: string[]
  shippingType?: string            // ShippingType value, iOS only
  shippingMethods?: ShippingMethod[] // → PaymentResult.shippingMethod
  billingContactRequired?: boolean  // → PaymentResult.billingContact
  shippingContactRequired?: boolean // → PaymentResult.shippingContact
  emailRequired?: boolean           // → PaymentResult.emailAddress
  phoneNumberRequired?: boolean     // → PaymentResult.phoneNumber
  // At most one: charges after today (see below)
  recurring?: RecurringPaymentRequest
  deferred?: DeferredPaymentRequest
  automaticReload?: AutomaticReloadPaymentRequest
  applePayMultiTokenContexts?: PaymentTokenContext[] // several merchants, iOS 16+
  couponCode?: string               // iOS only, needs onCouponCodeChange
  // Google Pay (Android)
  googlePayMerchantId?: string
  googlePayEnvironment?: 'TEST' | 'PRODUCTION'
  googlePayGateway?: string
  googlePayGatewayMerchantId?: string
  googlePayAllowedAuthMethods?: string[] // GooglePayAuthMethod values
}
```

On iOS, `applePayMerchantIdentifier` is optional. Without it, iOS uses the first Merchant ID in the Info.plist key `ReactNativePayApplePayMerchantIdentifiers`, which the [Expo plugin](/docs/setup/expo-plugin) writes from `merchantIdentifier` (in a bare app, add it yourself: see [Bare React Native](/docs/setup/bare-react-native)).

Without `googlePayEnvironment`, Android uses `'TEST'`. When it is omitted, an Android release build logs a warning once per app run from `normalizePaymentRequest`, which `usePaymentCheckout`, `HybridPaymentHandler.startPayment` and `createPaymentRequest` run before a payment. `payServiceStatus`, and the raw handler from `getPaymentHandler()`, log nothing.

`merchantName` is the business name shown to the payer: the name on the Google Pay sheet and the label of the Apple Pay total. Apple Pay shows the last summary item as the total ("Pay *label*"), so on iOS the library appends a total item labelled with `merchantName` after your `paymentItems`, also when there is only one item. Don't add your own "Total" item. If `merchantName` is missing or blank, Android uses the app's label from the manifest and iOS uses the app's display name (`CFBundleDisplayName`, then `CFBundleName`).

`totalLabel` labels the total in the Google Pay sheet, for example `'Razem'` for a Polish sheet. It defaults to `'Total'` and must not be blank. Android only: iOS labels the total with `merchantName`. Google Pay shows no total label for `recurring`, `deferred` and `automaticReload` payments, so it has no effect on them.

`merchantCapabilities` takes [`MerchantCapability`](#merchantcapability) values.

`supportedNetworks` takes [`PaymentNetwork`](#paymentnetwork) names, matched ignoring case, and limits the cards the payer can choose on both platforms. A name that is not a `PaymentNetwork` fails the payment with `code: 'CONFIGURATION'` and an `error` that contains `Unknown payment network "<value>". Use a PaymentNetwork value such as "visa" or "mastercard"`. A network the platform does not offer is left out, so one cross-platform list works: Android drops `cartesBancaires`, for example. The payment fails when no network is left.

`googlePayAllowedAuthMethods` takes [`GooglePayAuthMethod`](#googlepayauthmethod) values and defaults to both. Android only.

`billingContactRequired`, `shippingContactRequired`, `emailRequired` and `phoneNumberRequired` ask the payer for contact details, which come back in the result as [`PaymentDetails`](#paymentdetails). On Android, a phone number is collected with an address. See [Shipping and contact details](/docs/guides/contact-details).

`shippingType` takes a [`ShippingType`](#shippingtype) value. `shippingMethods` takes [`ShippingMethod`](#shippingmethod) values; the selected one is added to the total. The first is selected by default on iOS and is always the one charged on Android.

`recurring`, `deferred` and `automaticReload` set up charges after today and ask for a merchant token, which Apple Pay returns when the card's network offers one: see [Recurring and later payments](#recurring-and-later-payments). `paymentItems` stay what the payer pays now, which may be nothing.

`applePayMultiTokenContexts` pays several merchants with one sheet: see [Several merchants](#several-merchants). iOS only.

`couponCode` is a code already applied, shown in the sheet's coupon field; `paymentItems` must already include its discount. It needs `StartPaymentOptions.onCouponCodeChange`, or the payment fails with `code: 'CONFIGURATION'`. iOS only; Android ignores it.

---

## PaymentResult

Returned from `startPayment()` (hook or handler).

```ts no-check
interface PaymentResult extends PaymentDetails {
  status: PaymentStatus     // 'success' | 'cancelled' | 'failed'
  code?: PaymentErrorCode   // set when status isn't 'success'
  success: boolean          // status === 'success'
  token?: PaymentToken
  error?: string            // message for logs, also set on a cancel
  // From PaymentDetails, set only when requested:
  // billingContact, shippingContact, emailAddress, phoneNumber, shippingMethod,
  // couponCode
}

type PaymentStatus = 'success' | 'cancelled' | 'failed'

type PaymentErrorCode =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'CONFIGURATION'
  | 'NOT_AVAILABLE'
  | 'PROVIDER_ERROR'
  | 'UNKNOWN'
```

- **status** — `'cancelled'` means the user closed the sheet before authorizing. It is not an error: `usePaymentCheckout` leaves `error` as `null` for it.
- **code** — Why the payment didn't succeed. `'CANCELLED'` for a cancel, one of the others for a failure. See [Error codes](/docs/payment-flow#error-codes) for what each one means and which native cases produce it.
- **success** — Kept for compatibility. Use `status` to tell a cancel from a failure.
- **token** — Set on success. Send it to your backend to complete the charge with your gateway, unless `onAuthorize` already did.
- **Contact details and shipping method** — A successful result also holds the ones the request asked for; see [PaymentDetails](#paymentdetails).
- **error** — A message for logs, such as `'Payment cancelled by user'`. Don't match on it; use `code`.

---

## PaymentError

The `error` that [`usePaymentCheckout`](/docs/api/use-payment-checkout) sets when a payment fails or can't start. It extends `Error`.

```ts no-check
class PaymentError extends Error {
  name: string             // 'PaymentError'
  readonly code: PaymentErrorCode
  cause?: unknown // the error it wraps, if any
}
```

- **code** — The same values as [`PaymentResult.code`](#paymentresult): `'CONFIGURATION'` for an empty cart or an invalid request, `'UNKNOWN'` when native code threw, and the result's `code` for a failed `PaymentResult` (`'UNKNOWN'` if it has none). A cancel and `'IN_PROGRESS'` don't set `error`.
- **cause** — The validation error or the value native code threw. An empty cart and a failed `PaymentResult` have no `cause`.

To branch in the handler that called `startPayment()`, read `code` from the result it returns. A failed result and `error` share the `code`, with two exceptions: a native result without a `code` keeps none while `error.code` is `'UNKNOWN'`, and `'IN_PROGRESS'` leaves `error` as it was, often `null`. `error` is React state, so read it from the hook in the render after `startPayment()` settles, not from the value an event handler captured. The hook types it as `Error | null`; narrow it with `instanceof PaymentError` to read `code`:

```tsx
import { Text } from 'react-native'
import {
  PaymentError,
  usePaymentCheckout,
} from '@gmisoftware/react-native-pay'

function CheckoutError() {
  const { error } = usePaymentCheckout({})

  if (error instanceof PaymentError && error.code === 'CONFIGURATION') {
    // A bug in the app: log it, and show the user a generic message.
    return <Text>Payment is unavailable right now.</Text>
  }
  return error ? <Text>Payment failed. Try again.</Text> : null
}
```

---

## StartPaymentOptions

Optional second argument of `HybridPaymentHandler.startPayment()`. The hook takes these callbacks in its config instead.

```ts no-check
interface StartPaymentOptions {
  onAuthorize?: (
    token: PaymentToken,
    details: PaymentDetails
  ) => Promise<PaymentAuthorizationResult>
  // Sheet callbacks, iOS only for now
  onShippingAddressChange?: (
    address: PaymentSheetAddress,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  onShippingMethodChange?: (
    method: ShippingMethod,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  onPaymentMethodChange?: (
    card: PaymentSheetCard,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
  onCouponCodeChange?: (
    couponCode: string,
    selection: PaymentSheetSelection
  ) => Promise<PaymentSheetUpdate>
}

interface PaymentAuthorizationResult {
  status: 'success' | 'failure'
  error?: string // becomes PaymentResult.error, with code 'PROVIDER_ERROR', on failure; the Google Pay sheet shows it
}
```

See [Charge before the sheet closes](/docs/guides/server-processing#charge-before-the-sheet-closes) for `onAuthorize` and [Update the cart in the sheet](/docs/guides/dynamic-cart#update-the-cart-in-the-sheet) for the sheet callbacks.

---

## Payment sheet updates

What the sheet callbacks of [`StartPaymentOptions`](#startpaymentoptions) get and return. iOS only for now; Android ignores the callbacks until [#72](https://github.com/gmi-software/react-native-pay/issues/72).

```ts no-check
interface PaymentSheetUpdate {
  paymentItems?: PaymentItem[]       // the new cart; left out = unchanged
  shippingMethods?: ShippingMethod[] // the new list; must not be empty
  error?: PaymentSheetError
}

interface PaymentSheetError {
  code: PaymentSheetErrorCode
  message: string // shown to the payer
}

type PaymentSheetErrorCode =
  | 'shippingAddressInvalid'
  | 'shippingAddressUnserviceable'
  | 'couponCodeInvalid'
  | 'couponCodeExpired'
  | 'other'

// Redacted until the payer authorizes: no street, name, email or phone
interface PaymentSheetAddress {
  countryCode: string          // ISO 3166-1 alpha-2: 'US'
  administrativeArea?: string  // state or province
  locality?: string            // city
  postalCode?: string          // only the start in the UK and Canada
}

interface PaymentSheetCard {
  network?: PaymentNetwork
  type: PaymentMethodType      // 'credit', 'debit', 'prepaid', 'store' or 'unknown'
  displayName?: string         // 'Visa 1234'
}

// What the payer chose so far, including the change the callback is called for
interface PaymentSheetSelection {
  shippingAddress?: PaymentSheetAddress
  shippingMethod?: ShippingMethod
  card?: PaymentSheetCard
  couponCode?: string          // the last code accepted without an error; in onCouponCodeChange, the code being checked
}
```

- **PaymentSheetUpdate** — Return payment items only: the library adds the selected shipping method, later charges and the total, as for `PaymentRequest`. Amounts follow the same rules. When new `shippingMethods` still contain the selected one, it stays selected; otherwise the first one is.
- **PaymentSheetError** — The payer can't pay until they change what it refers to. On iOS an error from `onShippingMethodChange` isn't shown: Apple Pay has none for that change.
- **Failures** — Every sheet callback must settle within 25 seconds. If it rejects, times out or returns an invalid update, the sheet keeps its current items without an error. A rejection or an invalid update is logged in development.

---

## PaymentToken

The token you send to your server. **Do not log or expose; treat as sensitive.**

```ts no-check
interface PaymentToken {
  paymentMethod: PaymentMethod
  transactionIdentifier?: string
  paymentData: string  // Opaque token payload (format depends on platform + gateway)
}
```

- **paymentMethod** — Card/network and optional billing contact.
- **transactionIdentifier** — On iOS, Apple's identifier for the payment (`PKPaymentToken.transactionIdentifier`), generated on the device. Missing on Android: Google Pay doesn't return one. Key idempotency on your order ID instead.
- **paymentData** — Opaque payload for your gateway.
  - iOS: Base64-encoded Apple Pay token data.
  - Android: Google Pay tokenization payload (`tokenizationData.token`), gateway-dependent.

---

## PaymentMethod

Describes the selected payment instrument.

```ts no-check
interface PaymentMethod {
  displayName?: string
  network?: PaymentNetwork
  type: PaymentMethodType
  secureElementPass?: PKSecureElementPass  // iOS
  billingAddress?: CNContact                // iOS
}

type PaymentMethodType = 'unknown' | 'debit' | 'credit' | 'prepaid' | 'store'
```

`PaymentMethodType` is exported separately for direct typing.

- **displayName** — Describes the card to the payer, as the wallet words it: `PKPaymentMethod.displayName` on iOS, `paymentMethodData.description` on Android (for example "Visa •••• 1234"). Show it as is; don't parse it.
- **network** — The card's [`PaymentNetwork`](#paymentnetwork), or `'unknown'` for a network the library cannot name. Use `network` rather than `displayName` for logic.
- **type** — How the card is funded: `PKPaymentMethod.type` on iOS, Google Pay's `cardFundingSource` on Android. Android reports `'credit'`, `'debit'` or `'prepaid'`, and `'unknown'` when Google Pay does not know; `'store'` (a store card) is iOS only.

---

## PaymentNetwork

Card networks. Use these names in `supportedNetworks`; results report one of them in `token.paymentMethod.network`.

```ts
type PaymentNetwork =
  | 'visa' | 'mastercard' | 'amex' | 'discover'
  | 'jcb' | 'maestro' | 'electron' | 'elo'
  | 'idcredit' | 'interac' | 'privateLabel'
  | 'cartesBancaires' | 'chinaUnionPay' | 'dankort' | 'eftpos'
  | 'girocard' | 'mada' | 'mir' | 'quicPay' | 'suica' | 'vPay'
  | 'waon' | 'nanaco' | 'bancontact' | 'postFinance' | 'pagoBancomat'
  | 'tmoney' | 'meeza' | 'napas' | 'bankAxept' | 'himyan' | 'jaywan'
  | 'myDebit'
  | 'unknown' // results only
```

| Platform | Offers |
|----------|--------|
| Google Pay | `visa`, `mastercard`, `amex`, `discover`, `jcb`, `interac`, and `electron`, `maestro` and `elo` for Brazilian combo cards |
| Apple Pay | Every network but `unknown`. Some need a newer iOS: `bancontact` 16, `postFinance` 16.4, `pagoBancomat` and `tmoney` 17, `meeza` 17.4, `napas` and `bankAxept` 17.5, `himyan` and `jaywan` 18.4, `myDebit` 26 |

`'unknown'` is never a valid request value. A result reports it for a card on a network that is not listed here, instead of guessing.

---

## PayServiceStatus

Resolved by `HybridPaymentHandler.payServiceStatus()`.

```ts
interface PayServiceStatus {
  isSupported: boolean   // the device can pay with Apple Pay / Google Pay
  hasActiveCard: boolean // a card on the checked networks is ready
}
```

| | iOS | Android |
|---|---|---|
| `isSupported` | `PKPaymentAuthorizationViewController.canMakePayments()` | `isReadyToPay` |
| `hasActiveCard` | `canMakePayments(usingNetworks:capabilities:)` | `isReadyToPay` with `existingPaymentMethodRequired: true` and the request's card parameters |

In the Google Pay `TEST` environment, `hasActiveCard` is `true` whether or not the user has a card. See [Check availability](/docs/guides/availability).

## PayServiceStatusOptions

What `payServiceStatus` checks. Pass the values your payment request uses, so `hasActiveCard` counts only cards the payment accepts.

```ts
interface PayServiceStatusOptions {
  supportedNetworks?: string[]           // default: ['visa', 'mastercard', 'amex', 'discover']
  merchantCapabilities?: string[]        // default: ['3DS']
  googlePayAllowedAuthMethods?: string[] // Android only. Default: both
  googlePayEnvironment?: 'TEST' | 'PRODUCTION' // Android only. Default: 'TEST'
}
```

The values are checked as in `startPayment`, and the Promise rejects with the same configuration error for a value the payment would refuse.

---

## GooglePayEnvironment

Used in config and `PaymentRequest` for Android.

```ts
type GooglePayEnvironment = 'TEST' | 'PRODUCTION'
```

Use `'TEST'` for development/sandbox; `'PRODUCTION'` for live charges. Android uses `'TEST'` when the value is omitted. See [Testing payments](/docs/guides/testing#test-environment).

---

## GooglePayAuthMethod

How Google Pay may authenticate the card, used in `googlePayAllowedAuthMethods` (Android only).

```ts
type GooglePayAuthMethod = 'PAN_ONLY' | 'CRYPTOGRAM_3DS'
```

- `'PAN_ONLY'` — Cards saved to the payer's Google account. The token holds the card number and no 3-D Secure cryptogram, so Google requires you to run 3-D Secure (step-up authentication) for these payments as for any other card payment. See [Card authentication and 3-D Secure](/docs/setup/android-google-pay#card-authentication-and-3-d-secure).
- `'CRYPTOGRAM_3DS'` — Cards tokenized on the device. The token holds a 3-D Secure cryptogram. Google Pay does not offer `jcb` or `discover` with it.

The default is both. Pass `['CRYPTOGRAM_3DS']` when your gateway or Strong Customer Authentication requires device tokens. Android matches the values ignoring case, and any other value fails the payment with `code: 'CONFIGURATION'` and an `error` that contains `Unknown Google Pay auth method "<value>". Use "PAN_ONLY" or "CRYPTOGRAM_3DS"`. They are separate from `merchantCapabilities`: every Apple Pay card is a device token, so iOS has nothing like `'PAN_ONLY'`.

---

## MerchantCapability

Merchant capabilities, used in `merchantCapabilities`. They come from Apple Pay; Android only reads `'Credit'` and `'Debit'`.

```ts
type MerchantCapability = '3DS' | 'EMV' | 'Credit' | 'Debit'
```

- `'3DS'` and `'EMV'` are Apple Pay payment protocols. PassKit needs at least one of them. EMV only covers China UnionPay, so every other card needs 3DS. Android ignores them.
- `'Credit'` and `'Debit'` limit the accepted card types.

Both platforms match the values case-insensitively. Any other value fails the payment: the result has `code: 'CONFIGURATION'` and `error: 'Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"'`.

iOS adds `'3DS'` when neither `'3DS'` nor `'EMV'` is given, so `[]` is sent as 3DS and `['Credit']` as 3DS + Credit.

Google Pay can leave credit cards out, but not debit cards:

| `merchantCapabilities` | iOS accepts | Android accepts |
|---|---|---|
| `['3DS']` | Every card type | Every card type |
| `['3DS', 'Debit']` | Debit cards | Every card type but credit cards |
| `['3DS', 'Credit']` | Credit cards | Every card type |
| `['3DS', 'Credit', 'Debit']` | Credit and debit cards | Every card type |

For `'Debit'` without `'Credit'`, Android sends `allowCreditCards: false` to Google Pay, which UK gambling merchants must do. Prepaid cards stay allowed. To refuse debit cards on Android, check the card on your server before you charge it. Give [`GooglePayButton`](/docs/api/components#googlepaybutton-android-only) and [`payServiceStatus`](#payservicestatusoptions) the same `merchantCapabilities`, so they are sent the same card types as the payment.

---

## ShippingType

How Apple Pay labels the address, used in `PaymentRequest.shippingType` (iOS only; Android ignores the field).

```ts
type ShippingType = 'shipping' | 'delivery' | 'storePickup' | 'servicePickup'
```

For example, `'delivery'` shows "Delivery Address" instead of "Shipping Address". Without `shippingType`, Apple Pay uses `'shipping'`. Any other value fails the payment: the result has `code: 'CONFIGURATION'` and `error: 'Unknown shipping type "<value>". Use "shipping", "delivery", "storePickup" or "servicePickup"'`.

---

## Pass types (iOS)

These iOS-only types appear in payment-related metadata returned by Apple Pay APIs (for example pass details tied to the selected card) and are mostly useful in advanced/native-integrated flows.

```ts
type PassActivationState =
  | 'activated'
  | 'requiresActivation'
  | 'activating'
  | 'suspended'
  | 'deactivated'

interface PKPass {
  passTypeIdentifier: string
  serialNumber: string
  organizationName?: string
}

interface PKSecureElementPass extends PKPass {
  primaryAccountIdentifier: string
  primaryAccountNumberSuffix: string
  deviceAccountIdentifier: string
  deviceAccountNumberSuffix: string
  passActivationState: PassActivationState
  devicePassIdentifier?: string
  pairedTerminalIdentifier?: string
}
```

---

## PaymentDetails

What the payer chose in the payment sheet besides the card, on both platforms. Each field is set only when the `PaymentRequest` asked for it. `PaymentResult` includes these fields, and `onAuthorize` receives them as its second argument. See [Shipping and contact details](/docs/guides/contact-details).

```ts no-check
interface PaymentDetails {
  billingContact?: PaymentContact  // billingContactRequired
  shippingContact?: PaymentContact // shippingContactRequired
  emailAddress?: string            // emailRequired
  phoneNumber?: string             // phoneNumberRequired, as the payer entered it
  shippingMethod?: ShippingMethod  // the selected shipping method
  couponCode?: string              // iOS, the last code onCouponCodeChange accepted
}
```

---

## Recurring and later payments

Set at most one of these on `PaymentRequest`. Use them with `HybridPaymentHandler.startPayment`; see [Subscriptions and later payments](/docs/guides/merchant-tokens) for examples and the validation rules. On Android they become Google Pay's Merchant Initiated Transactions; see [On Android](/docs/guides/merchant-tokens#on-android).

```ts no-check
// Shared by all three
interface MerchantTokenPaymentRequest {
  description: string           // what the payer agrees to; iOS only
  managementUrl: string         // https, no query, fragment or trailing slash
  billingAgreement?: string     // at most 300 characters
  tokenNotificationUrl?: string // where Apple tells your server the token changed
}

interface RecurringPaymentRequest extends MerchantTokenPaymentRequest {
  regularBilling: RecurringBillingItem
  trialBilling?: RecurringBillingItem // needs an endDate
}

interface DeferredPaymentRequest extends MerchantTokenPaymentRequest {
  deferredBilling: DeferredBillingItem
  freeCancellation?: FreeCancellation // iOS only
}

interface AutomaticReloadPaymentRequest extends MerchantTokenPaymentRequest {
  automaticReloadBilling: AutomaticReloadBillingItem
}

interface RecurringBillingItem {
  label: string                       // at most 100 characters
  amount: PaymentAmount               // positive; a trial may be 0
  intervalUnit: RecurringIntervalUnit // 'day' | 'month' | 'year'
  intervalCount?: number              // positive integer, default 1
  startDate?: Date                    // default: now, or the end of the trial
  endDate?: Date                      // default: no end
}

interface DeferredBillingItem {
  label: string
  amount: PaymentAmount // positive
  date: Date            // when it is charged
}

interface AutomaticReloadBillingItem {
  label: string
  amount: PaymentAmount          // charged on each reload; positive
  thresholdAmount: PaymentAmount // balance that triggers a reload; not negative
}

interface FreeCancellation {
  date: Date
  timeZone: string // IANA name, e.g. 'Europe/Warsaw'
}
```

There is no `'week'` unit, because Apple Pay refuses it: use `intervalUnit: 'day'` with `intervalCount: 7`. Amounts are fixed; a price that depends on usage is not supported yet. Dates must be in the future. On iOS the sheet lists the later charges as their own lines, outside the total. Apple Pay needs iOS 16 for `recurring` and `automaticReload` and iOS 16.4 for `deferred`; on older versions the payment fails with `code: 'NOT_AVAILABLE'`.

---

## Several merchants

`PaymentRequest.applePayMultiTokenContexts` takes one context per merchant, mapped to PassKit's `PKPaymentTokenContext`. See [Paying several merchants](/docs/guides/multi-merchant) for an example and the server side.

```ts no-check
interface PaymentTokenContext {
  merchantIdentifier: string // the merchant's Apple Pay merchant ID, or yours
  externalIdentifier: string // your stable ID for the merchant
  merchantName: string       // shown in the sheet's summary
  merchantDomain?: string    // e.g. 'hotel.example.com'
  amount: PaymentAmount      // positive
}
```

The amounts must add up to exactly the total, `paymentItems` plus the shipping method, so list yourself too for any share you keep; all `shippingMethods` must then cost the same. A [sheet update](#payment-sheet-updates) must keep that total, or the sheet keeps its items. The field can't be combined with `recurring`, `deferred` or `automaticReload`; such a request fails with `code: 'CONFIGURATION'` on every iOS version. Without them, Apple Pay needs iOS 16; on older versions the payment fails with `code: 'NOT_AVAILABLE'`. Android removes it without checking these rules. The result still holds one `PaymentToken`: each merchant's cryptogram is in its encrypted payment data, under `authenticationResponses`.

---

## ShippingMethod

A delivery option in `PaymentRequest.shippingMethods`. See [Shipping methods](/docs/guides/contact-details#shipping-methods).

```ts no-check
interface ShippingMethod {
  identifier: string    // unique within the request, returned in PaymentResult.shippingMethod
  label: string         // e.g. 'Express'
  amount: PaymentAmount // added to the total while selected; must not be negative
  detail?: string       // e.g. 'Next business day'
}
```

The selected method appears as its own line in the sheet and is included in the total. `PaymentResult.shippingMethod` is the selected entry as you sent it. On Android, Google Pay cannot offer a choice yet, so the first method is charged and returned.

---

## PaymentContact

A name and postal address the payer chose. Parts the payer left empty are omitted.

```ts no-check
interface PaymentContact {
  name?: string        // full name, e.g. 'Jane Appleseed'
  givenName?: string   // iOS only
  familyName?: string  // iOS only
  postalAddress?: CNPostalAddress
}
```

In `postalAddress`, `street` joins the address lines with `'\n'`, `isoCountryCode` is uppercase ISO 3166-1 alpha-2, and `country` (the country name) is iOS only.

---

## Contact types

`CNPostalAddress` is used by [`PaymentContact`](#paymentcontact). The other types describe `PaymentMethod.billingAddress`, the card's billing contact on iOS. For a billing address on both platforms, use `billingContactRequired` and read `PaymentResult.billingContact`.

```ts
type CNContactType = 'person' | 'organization'

interface CNPhoneNumber {
  stringValue: string
}

interface CNPostalAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  isoCountryCode?: string
}

interface CNLabeledPhoneNumber {
  label?: string
  value: CNPhoneNumber
}

interface CNLabeledEmailAddress {
  label?: string
  value: string
}

interface CNLabeledPostalAddress {
  label?: string
  value: CNPostalAddress
}

interface CNContact {
  identifier: string
  contactType: CNContactType
  namePrefix: string
  givenName: string
  middleName: string
  familyName: string
  previousFamilyName: string
  nameSuffix: string
  nickname: string
  organizationName: string
  departmentName: string
  jobTitle: string
  phoneticGivenName: string
  phoneticMiddleName: string
  phoneticFamilyName: string
  phoneticOrganizationName?: string
  note: string
  imageDataAvailable?: boolean
  phoneNumbers: CNLabeledPhoneNumber[]
  emailAddresses: CNLabeledEmailAddress[]
  postalAddresses: CNLabeledPostalAddress[]
}
```

---

## Backward compatibility alias

```ts no-check
type ApplePayStatus = PayServiceStatus
```
