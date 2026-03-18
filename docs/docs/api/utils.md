# Utility functions

Helpers for building payment requests, items, and formatting. All are exported from `@gmisoftware/react-native-pay`.

## When to use these helpers

Use these functions when you are building a manual or low-level flow (usually with `HybridPaymentHandler`) and need to assemble `PaymentRequest` data yourself.

If you use `usePaymentCheckout`, cart state and request building are handled for you internally, so these helpers are optional.

## createPaymentRequest(options)

Builds a full `PaymentRequest` with one line item and sensible defaults.

**Required:** `amount`, `label`.

**Defaults:** `countryCode: 'US'`, `currencyCode: 'USD'`, `supportedNetworks: [CommonNetworks]`, `merchantCapabilities: ['3DS']`.

```ts
import { createPaymentRequest } from '@gmisoftware/react-native-pay'

const request = createPaymentRequest({
  amount: 29.99,
  label: 'Coffee Subscription',
  countryCode: 'US',
  currencyCode: 'USD',
  // Optional: applePayMerchantIdentifier, googlePayMerchantId,
  // googlePayEnvironment, googlePayGateway, googlePayGatewayMerchantId, etc.
})
// request.paymentItems is a single item: [{ label: 'Coffee Subscription', amount: 29.99, type: 'final' }]
```

Use with `HybridPaymentHandler.startPayment(request)` for a manual flow.

---

## createPaymentItem(label, amount, type?)

Creates a single `PaymentItem`.

```ts
import { createPaymentItem } from '@gmisoftware/react-native-pay'

createPaymentItem('Subscription', 29.99, 'final')
createPaymentItem('Shipping', 5, 'pending')
// type defaults to 'final'
```

---

## calculateTotal(items)

Sums the `amount` of all items.

```ts
import { calculateTotal, createPaymentItem } from '@gmisoftware/react-native-pay'

const items = [
  createPaymentItem('Product', 29.99),
  createPaymentItem('Tax', 2.4),
]
calculateTotal(items) // 32.39
```

---

## formatAmount(amount)

Formats a number to two decimal places.

```ts
import { formatAmount } from '@gmisoftware/react-native-pay'

formatAmount(29.9)  // "29.90"
formatAmount(100)   // "100.00"
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
