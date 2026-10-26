# Shipping and contact details

Ask the payer for an address, an email address or a phone number in the payment sheet, offer shipping methods, and read what they chose from the result.

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
import { useEffect } from 'react'
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const order = { label: 'Coffee beans', total: '18.00' } // your order

function useShippedOrder() {
  const { addItem, clearItems, startPayment } = usePaymentCheckout({
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

  useEffect(() => {
    addItem(order.label, order.total)
    return clearItems
  }, [addItem, clearItems])

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

## Shipping methods

Offer delivery options with `shippingMethods`. The hook doesn't take them, because its `total` only covers the cart, so build the request yourself and pass it to `HybridPaymentHandler`:

```ts
import {
  HybridPaymentHandler,
  createPaymentRequest,
} from '@gmisoftware/react-native-pay'

async function payWithShipping() {
  const request = createPaymentRequest({
    label: 'Coffee beans',
    amount: '18.00',
    currencyCode: 'USD',
    shippingContactRequired: true,
    shippingMethods: [
      { identifier: 'standard', label: 'Standard', amount: '0.00', detail: '3–5 business days' },
      { identifier: 'express', label: 'Express', amount: '7.50', detail: 'Next business day' },
    ],
  })

  const result = await HybridPaymentHandler.startPayment(request, {
    onAuthorize: async (token, { shippingMethod, shippingContact }) => {
      const response = await fetch('https://api.yourserver.com/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Your server prices the order from the method identifier, not the client's amount.
        body: JSON.stringify({ token, shipping: shippingMethod?.identifier, shippingContact }),
      })
      return response.ok ? { status: 'success' } : { status: 'failure' }
    },
  })

  if (result.success) {
    console.log('Shipping with', result.shippingMethod?.label)
  }
}
```

- The selected method is shown as its own line, labelled with its `label`, and included in the total. The total is your `paymentItems` plus the method's `amount`.
- The order matters. On iOS the first method is selected when the sheet opens, so put the default first.
- `result.shippingMethod` and the second argument of `onAuthorize` hold the selected entry of `shippingMethods`, as you sent it.
- Every `identifier` must be non-empty and unique, no `amount` may be negative, and the `paymentItems` must not total less than zero on their own: shipping can't make up for a larger discount. Otherwise the payment fails before the sheet opens, with an error such as `Shipping method identifier "express" is used more than once`.
- **Android:** Google Pay can't offer a choice yet (see below), so Android charges the first method: it appears as a line item, is included in the total and is returned as `shippingMethod`.

## Platform differences

- **Phone number on Android:** Google Pay only collects a phone number with an address. With `shippingContactRequired`, the phone number comes with the shipping address. Without it, Android asks for the phone number with the billing address, and asks for at least the billing name, country and postal code even when `billingContactRequired` is off. `billingContact` is still only set when you asked for it.
- **Email and phone on iOS:** Apple Pay returns them as part of the shipping contact, so the library requests them there. Without `shippingContactRequired`, no shipping address is requested.
- **`shippingType`** changes how Apple Pay labels the address, for example "Delivery Address" for `'delivery'`. iOS only. See [ShippingType](/docs/api/types#shippingtype).

## Not supported yet

- **Choosing a shipping method on Android:** Google Pay only offers shipping options through its payment data callbacks, which need play-services-wallet 20. Until the library moves to it, Android charges the first method.
- **Prices or shipping methods that depend on the address:** while the sheet is open, the total only changes when the payer picks another shipping method on iOS.
- **Limiting shipping countries:** check the country on your server and resolve `onAuthorize` with `'failure'`.
