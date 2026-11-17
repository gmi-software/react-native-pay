# Subscriptions and later payments

Charge the payer again later, without them: a subscription, a hotel booking charged on arrival, or a balance topped up when it runs low. Set one of these fields on the `PaymentRequest`:

| Field | For | Apple Pay | Google Pay | Example |
| --- | --- | --- | --- | --- |
| `recurring` | Subscriptions | iOS 16 | `recurringTransactionInfo` | $9.99 a month after a free trial |
| `deferred` | One charge on a later date | iOS 16.4 | `deferredTransactionInfo` | $240.00 on the day of arrival |
| `automaticReload` | Top-ups when a balance runs low | iOS 16 | `automaticReloadTransactionInfo` | $25.00 whenever the balance drops below $5.00 |

The sheet shows the schedule and your management URL, and the payment asks Apple Pay for a **merchant token** instead of a device token. Your payment provider can charge a merchant token later, and it is not tied to the payer's device. Since iOS 26, the payer also sees the payment in Wallet under Preauthorized Payments.

A merchant token is not guaranteed: when the card's network doesn't offer merchant tokens, Apple Pay returns a device token, as for a one-off payment. Ask your payment provider how it tells the two apart and which one it can charge later.

These requests need `HybridPaymentHandler.startPayment`. `usePaymentCheckout` does not take them.

## What is charged today

`paymentItems` are what the payer pays **now**. The later charges come from `recurring`, `deferred` or `automaticReload`, and the library adds them to the sheet as their own lines, outside the total.

So the total can be zero: a free trial, or a booking without a deposit. When the first period is charged right away, put it in both places: in `paymentItems` for today, and in `regularBilling` for the schedule.

## On Android

Google Pay calls these Merchant Initiated Transactions. The request sends `recurringTransactionInfo`, `deferredTransactionInfo` or `automaticReloadTransactionInfo` in place of the usual `transactionInfo`, and `paymentItems` with the first shipping method become its `immediateTotalPrice` and `immediateDisplayItems`.

- A `recurring` request sends only `immediateTotalPrice`. Google Pay doesn't allow regular charges in `immediateDisplayItems`, and a first period paid today is a payment item like a setup fee, so the sheet shows the amount due today without its lines.

- A free trial becomes an introductory period that ends on its `endDate`. Google Pay doesn't show the trial's interval, only its end. A paid trial is its own billing phase before `regularBilling`.
- `description` and `freeCancellation` are iOS only.
- With `deferred` or `automaticReload`, a `pending` payment item stays pending in the sheet, but these requests have no estimated total on Android.
- Google's guide mentions an early access program for Merchant Initiated Transactions. Check in the [Google Pay & Wallet Console](https://pay.google.com/business/console) and with your gateway that your account can use them in `PRODUCTION`, and test the sheet in `TEST` first.

## Subscription

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

const DAY = 24 * 60 * 60 * 1000

export async function subscribe() {
  const trialEnd = new Date(Date.now() + 7 * DAY)

  const result = await HybridPaymentHandler.startPayment({
    merchantName: 'Coffee Club',
    countryCode: 'US',
    currencyCode: 'USD',
    merchantCapabilities: ['3DS'],
    supportedNetworks: ['visa', 'mastercard', 'amex'],
    paymentItems: [], // nothing today
    recurring: {
      description: 'Coffee Club membership',
      managementUrl: 'https://example.com/account/membership',
      billingAgreement: 'Renews monthly until you cancel.',
      tokenNotificationUrl: 'https://api.example.com/apple-pay/tokens',
      trialBilling: {
        label: 'Free trial',
        amount: '0.00',
        intervalUnit: 'day',
        intervalCount: 7,
        endDate: trialEnd,
      },
      regularBilling: {
        label: 'Coffee Club Monthly',
        amount: '9.99',
        intervalUnit: 'month',
      },
    },
  })

  if (result.status === 'success') {
    // Send result.token to your server; your payment provider tells it
    // whether this is a merchant token it can charge later.
  }
}
```

`regularBilling` starts when the trial ends, unless you give it a `startDate`. Without a trial and a `startDate`, it starts now. `intervalCount` defaults to 1, so `intervalUnit: 'month'` is every month. There is no `'week'` unit, because Apple Pay refuses it: for a weekly plan, use `intervalUnit: 'day'` with `intervalCount: 7`.

## Payment on a later date

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

export async function bookRoom(arrival: Date, cancelUntil: Date) {
  return HybridPaymentHandler.startPayment({
    merchantName: 'Seaside Hotel',
    countryCode: 'PL',
    currencyCode: 'PLN',
    merchantCapabilities: ['3DS'],
    supportedNetworks: ['visa', 'mastercard'],
    paymentItems: [],
    deferred: {
      description: 'Seaside Hotel, 2 nights',
      managementUrl: 'https://example.com/bookings',
      deferredBilling: {
        label: 'Room, 2 nights',
        amount: '960.00',
        date: arrival,
      },
      // iOS shows it in the hotel's time zone.
      freeCancellation: { date: cancelUntil, timeZone: 'Europe/Warsaw' },
    },
  })
}
```

`freeCancellation` is iOS only.

## Automatic top-up

```ts
import { HybridPaymentHandler } from '@gmisoftware/react-native-pay'

export async function enableTopUp() {
  return HybridPaymentHandler.startPayment({
    merchantName: 'Coffee Card',
    countryCode: 'US',
    currencyCode: 'USD',
    merchantCapabilities: ['3DS'],
    supportedNetworks: ['visa', 'mastercard'],
    paymentItems: [{ label: 'Initial load', amount: '25.00', type: 'final' }],
    automaticReload: {
      description: 'Coffee card auto top-up',
      managementUrl: 'https://example.com/card',
      automaticReloadBilling: {
        label: 'Coffee Card Top-Up',
        amount: '25.00',
        thresholdAmount: '5.00',
      },
    },
  })
}
```

## Rules

`normalizePaymentRequest` checks these before the sheet opens. How a broken rule surfaces depends on what you call:

- `HybridPaymentHandler.startPayment` resolves with `status: 'failed'` and `code: 'CONFIGURATION'`, and the sheet doesn't open.
- `normalizePaymentRequest` and `createPaymentRequest` throw an `Error`. Call them in a `try`/`catch`.

The rules are the stricter of Apple Pay's and Google Pay's, so a request that passes works on both, with one exception below:

- Set at most one of `recurring`, `deferred` and `automaticReload`.
- `description` must not be empty.
- `managementUrl` and `tokenNotificationUrl` must be `https` URLs without query, fragment or trailing slash. Wallet shows the management URL to every payer, so don't put account IDs in it.
- `billingAgreement` has at most 300 characters, each `label` at most 100.
- Dates must be valid and in the future. Build the request when the payer taps, not when the screen loads.
- A `startDate` must be before its `endDate`. A trial needs an `endDate`. `regularBilling` can't start before the trial ends, and without its own `startDate` it must end after the trial does.
- `intervalCount` must be a positive integer, at most 2,147,483,647.
- Amounts follow the currency's decimal places. The regular, deferred and reload amounts must be positive. A trial may be free (`0`), and `thresholdAmount` may be `0`.

One Google Pay limit isn't checked here: it accepts at most two decimal places, so on Android an amount such as `'1.234'` KWD fails with `code: 'CONFIGURATION'`, as it does in a one-off payment. See [`PaymentAmount`](/docs/api/types#paymentamount).

On iOS older than 16 (16.4 for `deferred`), the payment fails with `code: 'NOT_AVAILABLE'` and no sheet. Offer another way to pay.

## On your server

A merchant token only helps if your payment provider can charge it later:

- **Check that your provider supports Apple Pay merchant tokens.** Send it the token as for any Apple Pay payment. It returns a reusable payment method or a token ID, and you charge that on the schedule you showed. If the payment returned a device token instead, ask your provider whether it can still charge it later.
- **Charge what you showed.** The amounts, dates and interval in the sheet are what the payer agreed to. Charge a different amount or earlier, and the payer may dispute it.
- **Handle token notifications.** With `tokenNotificationUrl`, Apple, and Google as `tokenUpdateUrl`, tell that URL when the payer deletes the token or it changes, for example after a card replacement. Stop charging a deleted token.
- **Let the payer cancel.** `managementUrl` must lead to a page where they can change or cancel the plan.

See [Server-side processing](/docs/guides/server-processing) for charging the token itself.
