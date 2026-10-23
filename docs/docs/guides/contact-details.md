# Shipping and contact details

Ask the payer for an address, an email address or a phone number in the payment sheet, and read what they entered from the result.

## Request

Set any of these flags in the `usePaymentCheckout` config or in a `PaymentRequest`. Each flag fills one field of the result:

| Flag | Result field | iOS (Apple Pay) | Android (Google Pay) |
| --- | --- | --- | --- |
| `billingContactRequired` | `billingContact` | Billing name and postal address | Full billing address of the card |
| `shippingContactRequired` | `shippingContact` | Shipping name and postal address | Full shipping address |
| `emailRequired` | `emailAddress` | Email address | Email address |
| `phoneNumberRequired` | `phoneNumber` | Phone number | Phone number, collected with an address (see below) |

A field is set only when you asked for it. Ask only for what you need to fulfil the order: each one is another step for the payer.

## Use the details

The details are in the result, and `onAuthorize` receives them as its second argument, so your server can check the address before it charges:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

function useShippedOrder() {
  const { startPayment } = usePaymentCheckout({
    currencyCode: 'USD',
    shippingContactRequired: true,
    emailRequired: true,
    onAuthorize: async (token, { shippingContact, emailAddress }) => {
      const response = await fetch('https://api.yourserver.com/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, shippingContact, emailAddress }),
      })
      return response.ok
        ? { status: 'success' }
        : { status: 'failure', error: 'We cannot ship to this address' }
    },
  })

  return async () => {
    const result = await startPayment()
    if (result?.success) {
      console.log('Shipping to', result.shippingContact?.postalAddress?.city)
    }
  }
}
```

With `HybridPaymentHandler`, set the same flags on the `PaymentRequest`; the details are in the `PaymentResult` and in `startPayment(request, { onAuthorize })`.

## What you get

`billingContact` and `shippingContact` are [`PaymentContact`](/docs/api/types#paymentcontact) objects:

- **name**: the full name, for example `'Jane Appleseed'`.
- **givenName**, **familyName**: iOS only. Google Pay returns the name as one string.
- **postalAddress**: `street` (address lines joined with `'\n'`), `city`, `state`, `postalCode`, `country` (iOS only) and `isoCountryCode` (uppercase ISO 3166-1 alpha-2, such as `'US'`).

`emailAddress` and `phoneNumber` are plain strings. The phone number is in the format the payer entered. Parts the payer left empty are omitted, not empty strings.

## Platform differences

- **Phone number on Android:** Google Pay only collects a phone number with an address. With `shippingContactRequired`, the phone number comes with the shipping address. Without it, Android asks for the phone number with the billing address, and asks for at least the billing name, country and postal code even when `billingContactRequired` is off. `billingContact` is still only set when you asked for it.
- **Email and phone on iOS:** Apple Pay returns them as part of the shipping contact, so the library requests them there. Without `shippingContactRequired`, no shipping address is requested.
- **`shippingType`** changes how Apple Pay labels the address, for example "Delivery Address" for `'delivery'`. iOS only. See [ShippingType](/docs/api/types#shippingtype).

## Not supported yet

- **Shipping methods:** `shippingMethods` is ignored on both platforms. Add the shipping cost to `paymentItems` instead.
- **Price updates when the address changes:** the total cannot change while the sheet is open.
- **Limiting shipping countries:** check the country on your server and resolve `onAuthorize` with `'failure'`.
