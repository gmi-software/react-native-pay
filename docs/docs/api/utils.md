# Utility functions

Helpers for building payment requests, items, and formatting. All are exported from `@gmisoftware/react-native-pay`.

## When to use these helpers

Use these functions when you are building a manual or low-level flow (usually with `HybridPaymentHandler`) and need to assemble `PaymentRequest` data yourself.

If you use `usePaymentCheckout`, cart state and request building are handled for you internally, so these helpers are optional.

## createPaymentRequest(options)

Builds a full `PaymentRequest` with one line item and sensible defaults.

**Required:** `amount`, `label`.

**Defaults:** `countryCode: 'US'`, `currencyCode: 'USD'`, `supportedNetworks: [CommonNetworks]`, `merchantCapabilities: ['3DS']`.

The amount is validated with [`normalizePaymentRequest`](#normalizepaymentrequestrequest), so `createPaymentRequest` throws for an invalid amount, and the returned request holds it as a decimal string.

```ts
import { createPaymentRequest } from '@gmisoftware/react-native-pay'

const request = createPaymentRequest({
  amount: 29.99, // or '29.99'
  label: 'Coffee Subscription',
  merchantName: 'Your Store',
  countryCode: 'US',
  currencyCode: 'USD',
  // Optional: applePayMerchantIdentifier, googlePayMerchantId,
  // googlePayEnvironment, googlePayGateway, googlePayGatewayMerchantId, etc.
})
// request.paymentItems is a single item: [{ label: 'Coffee Subscription', amount: '29.99', type: 'final' }]
```

Use with `HybridPaymentHandler.startPayment(request)` for a manual flow.

---

## normalizePaymentRequest(request)

Validates every amount in `paymentItems` and `shippingMethods` and returns a copy in which each amount is a decimal string with the currency's number of decimal places. See [`PaymentAmount`](./types.md#paymentamount) for the rules.

Call it before passing a request you built yourself to `HybridPaymentHandler.startPayment`. `createPaymentRequest` and `usePaymentCheckout` already call it.

```ts
import { HybridPaymentHandler, normalizePaymentRequest } from '@gmisoftware/react-native-pay'

const request = normalizePaymentRequest({
  countryCode: 'US',
  currencyCode: 'USD',
  paymentItems: [
    { label: 'Book', amount: 19.9, type: 'final' },
    { label: 'Discount', amount: '-5', type: 'final' },
  ],
  supportedNetworks: ['visa', 'mastercard'],
  merchantCapabilities: ['3DS'],
})
// request.paymentItems amounts: '19.90', '-5.00'

await HybridPaymentHandler.startPayment(request)

normalizePaymentRequest({ ...request, paymentItems: [{ label: 'Fee', amount: 1.005, type: 'final' }] })
// throws: Amount for "Fee" has more than 2 decimal places, which USD allows, got 1.005
```

---

## createPaymentItem(label, amount, type?)

Creates a single `PaymentItem`.

```ts
import { createPaymentItem } from '@gmisoftware/react-native-pay'

createPaymentItem('Subscription', 29.99, 'final')
createPaymentItem('Shipping', '5.00', 'pending')
// type defaults to 'final'
```

The amount is stored as given and validated when the payment starts.

---

## calculateTotal(items)

Sums the `amount` of all items with exact decimal arithmetic, the same as native code, and returns the sum as a number. Returns `NaN` if an amount is invalid.

```ts
import { calculateTotal, createPaymentItem } from '@gmisoftware/react-native-pay'

const items = [
  createPaymentItem('Product', 29.99),
  createPaymentItem('Tax', '2.40'),
]
calculateTotal(items) // 32.39

calculateTotal([createPaymentItem('A', 0.1), createPaymentItem('B', 0.2)]) // 0.3, not 0.30000000000000004
```

---

## formatAmount(amount, currencyCode?)

Formats a number or decimal string with the currency's number of decimal places (two when `currencyCode` is omitted), rounding half away from zero. Returns `'NaN'` for an invalid amount.

```ts
import { formatAmount } from '@gmisoftware/react-native-pay'

formatAmount(29.9)          // "29.90"
formatAmount('100')         // "100.00"
formatAmount(1.005)         // "1.01"
formatAmount(1500, 'JPY')   // "1500"
```

---

## parseAmount(amountString)

Parses a string to a number.

```ts
import { parseAmount } from '@gmisoftware/react-native-pay'

parseAmount('29.99')  // 29.99
parseAmount('100')    // 100
```

---

## isNetworkSupported(network, supportedNetworks)

Returns whether `network` is in `supportedNetworks` (case-insensitive).

```ts
import { isNetworkSupported } from '@gmisoftware/react-native-pay'

isNetworkSupported('visa', ['visa', 'mastercard'])   // true
isNetworkSupported('AMEX', ['visa', 'amex'])        // true
isNetworkSupported('discover', ['visa', 'mastercard']) // false
```

---

## formatNetworkName(network)

Returns a human-readable name for a payment network.

```ts
import { formatNetworkName } from '@gmisoftware/react-native-pay'

formatNetworkName('visa')       // "Visa"
formatNetworkName('amex')      // "American Express"
formatNetworkName('mastercard') // "Mastercard"
```

---

## CommonNetworks

Constants for common network IDs (for building `supportedNetworks`):

```ts
import { CommonNetworks } from '@gmisoftware/react-native-pay'

CommonNetworks.VISA       // 'visa'
CommonNetworks.MASTERCARD // 'mastercard'
CommonNetworks.AMEX       // 'amex'
CommonNetworks.DISCOVER   // 'discover'
```

Use with `createPaymentRequest` or when building a `PaymentRequest` by hand.
