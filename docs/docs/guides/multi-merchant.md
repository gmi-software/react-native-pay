# Paying several merchants

One Apple Pay sheet can pay several merchants at once: a marketplace order from several sellers, or a trip with a flight, a hotel and a car rental. Each merchant can then charge its own share. Set `applePayMultiTokenContexts` on the `PaymentRequest`, with one context per merchant. This maps to PassKit's [`multiTokenContexts`](https://developer.apple.com/documentation/passkit/pkpaymentrequest/multitokencontexts).

- **iOS only.** Apple Pay needs iOS 16; on older versions the payment fails with `code: 'NOT_AVAILABLE'`. Android removes the field without checking it, because Google Pay has no equivalent: charge the merchants from your own server there. So test the rules below on iOS.
- **Not together with `recurring`, `deferred` or `automaticReload`.** Apple Pay refuses the combination, so the payment fails with `code: 'CONFIGURATION'`.
- **Use `HybridPaymentHandler.startPayment`.** `usePaymentCheckout` does not take this field.

## Request

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

export async function payForTrip() {
  const result = await HybridPaymentHandler.startPayment({
    merchantName: 'Example Trips',
    countryCode: 'US',
    currencyCode: 'USD',
    merchantCapabilities: ['3DS'],
    supportedNetworks: ['visa', 'mastercard', 'amex'],
    paymentItems: [
      { label: 'Flight', amount: '150.00', type: 'final' },
      { label: 'Hotel, 2 nights', amount: '300.00', type: 'final' },
      { label: 'Booking fee', amount: '10.00', type: 'final' },
    ],
    applePayMultiTokenContexts: [
      {
        merchantIdentifier: 'merchant.com.example.air-travel',
        externalIdentifier: 'air-travel',
        merchantName: 'Air Travel',
        merchantDomain: 'air-travel.example.com',
        amount: '150.00',
      },
      {
        merchantIdentifier: 'merchant.com.example.hotel',
        externalIdentifier: 'hotel',
        merchantName: 'Seaside Hotel',
        merchantDomain: 'hotel.example.com',
        amount: '300.00',
      },
      {
        // Your own share: the booking fee
        merchantIdentifier: 'merchant.com.example.trips',
        externalIdentifier: 'example-trips',
        merchantName: 'Example Trips',
        amount: '10.00',
      },
    ],
  })

  if (result.status === 'success') {
    // Send result.token to your server, as for any payment.
  }
}
```

The payer sees one total and authorizes it once. Apple describes a summary that lists each merchant with its amount; the iOS 26.5 simulator shows only the payment items, so check the sheet on a device.

| Field | Meaning |
| --- | --- |
| `merchantIdentifier` | The merchant's own Apple Pay merchant identifier, if it has one. Otherwise, and for your own share, use yours. |
| `externalIdentifier` | Your stable ID for the merchant. Use the same one every time you request a payment for that merchant. |
| `merchantName` | Shown to the payer. |
| `merchantDomain` | Optional. The merchant's top-level domain. |
| `amount` | What this merchant may charge, in the request's currency. Must be positive. |

## The amounts must add up to the total

The contexts must add up to **exactly** the total, so list yourself too for any share you keep, such as the booking fee above. Apple's documentation says they may add up to less, but PassKit refuses such a request with "The sum of all payment token context amounts must be equal to the PKPaymentRequest total" (seen on iOS 26.5), and the sheet doesn't open. An exact total also meets the documented rule, so it works on any iOS version.

The total is `paymentItems` plus the selected shipping method. Since the payer can pick another method in the sheet, every entry of `shippingMethods` must cost the same; the library can't tell which merchant a different shipping price belongs to.

`normalizePaymentRequest`, which `startPayment` runs, checks both, and the payment fails with `code: 'CONFIGURATION'` when they don't hold.

## The result

`PaymentResult` has the same shape as for any payment: **one** `token`. Apple Pay doesn't return a token per merchant to the app. The merchants' cryptograms are inside the token's encrypted payment data, and only your server can read them.

## On your server

Decrypt `token.paymentData` as for a one-off payment (see Apple's [Payment token format reference](https://developer.apple.com/documentation/passkit/payment-token-format-reference)), or let your payment provider do it. In a multi-merchant payment, the decrypted data has an `authenticationResponses` list, with one entry per context:

| Key | Value |
| --- | --- |
| `merchantIdentifier` | The context's `merchantIdentifier` |
| `authenticationData` | The card network's cryptogram for this merchant |
| `transactionAmount` | The amount the payer authorized for this merchant |

Match each entry to its merchant by `merchantIdentifier`, and charge each merchant's share with its own cryptogram, for no more than its `transactionAmount`.

Ask your payment provider whether it supports Apple Pay multi-merchant payments and how it expects the token: many decrypt it for you and charge each merchant through their own accounts. The [server-side processing](/docs/guides/server-processing) guide applies as for any payment: look up the order and its amounts on the server, and key idempotency on your order ID.
