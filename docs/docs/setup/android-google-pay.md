# Android (Google Pay)

Configure your app and Google Pay for Android.

## 1. Expo plugin

In `app.json` (or `app.config.js`), enable Google Pay:

```json
{
  "expo": {
    "plugins": [
      ["@gmisoftware/react-native-pay", { "enableGooglePay": true }]
    ]
  }
}
```

Use the same plugin with `merchantIdentifier` if you also support iOS.

## 2. Google Cloud / Google Pay API

1. In [Google Cloud Console](https://console.cloud.google.com/), open your project.
2. Enable the **Google Pay API** for the project.

For production, Google must also approve your app in the Google Pay & Wallet Console. See [Production access](/docs/guides/testing#production-access).

## 3. Gateway configuration (in app code)

Google Pay needs a **Google Pay merchant ID** for production, plus your **payment gateway** details (Stripe, Braintree, etc.) and **gateway merchant ID**. Configure them in `usePaymentCheckout` (or in your `PaymentRequest`):

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

usePaymentCheckout({
  merchantName: 'Your Store',      // shown on the Google Pay sheet
  currencyCode: 'USD',
  countryCode: 'US',
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'TEST',   // or 'PRODUCTION'
  googlePayGateway: 'stripe',    // or braintree, square, adyen, etc.
  googlePayGatewayMerchantId: 'your_stripe_merchant_id',
})
```

If you omit `merchantName`, the Google Pay sheet shows your app's label (`android:label` in the manifest).

If you omit `googlePayEnvironment`, Google Pay runs in `TEST`, in release builds too. A release build that omits it logs a warning once per app run when a payment starts, through `usePaymentCheckout`, `HybridPaymentHandler.startPayment` or `createPaymentRequest`. An availability check, and the raw handler from `getPaymentHandler()`, log nothing. Set `'PRODUCTION'` for live payments, or `'TEST'` to keep the test environment without the warning.

Supported gateways include: `stripe`, `braintree`, `square`, `adyen`, `authorizenet`, `checkoutltd`. See [Google Pay Gateway Tokens](https://developers.google.com/pay/api/android/reference/request-objects#gateway) for the full list and exact identifiers.

### Direct tokenization

With a gateway, Google encrypts the token for your gateway, which decrypts it. With `'direct'`, Google encrypts it with your own public key, and your server decrypts it and gets the card data. Use it only when you process card data yourself:

- Your servers must be PCI DSS compliant, and Google must approve the direct integration. Each year you send Google updated PCI documentation and rotate the key.
- Register the public key in the [Google Pay & Wallet Console](https://pay.google.com/business/console), under **Google Pay API** > **Direct integration**.

Generate a key pair on the NIST P-256 curve, and the public key as base64 of its uncompressed point, with the commands in Google's [payment data cryptography guide](https://developers.google.com/pay/api/android/guides/resources/payment-data-cryptography):

```bash
openssl ecparam -name prime256v1 -genkey -noout -out key.pem
openssl ec -in key.pem -pubout -text -noout 2> /dev/null | grep "pub:" -A5 | sed 1d | xxd -r -p | base64 | paste -sd "\0" - | tr -d '\n\r ' > publicKey.txt
```

Keep `key.pem` on your server. Pass the public key as `googlePayTokenization`:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

// From your server, so you can rotate it without an app release.
declare const publicKey: string

usePaymentCheckout({
  googlePayMerchantId: 'your_google_pay_merchant_id',
  googlePayEnvironment: 'PRODUCTION',
  googlePayTokenization: { type: 'direct', publicKey },
})
```

The library sends `{"type":"DIRECT","parameters":{"protocolVersion":"ECv2","publicKey":"…"}}` and ignores `googlePayGateway` and `googlePayGatewayMerchantId`. Without a `publicKey`, the payment fails with `code: 'CONFIGURATION'`, in `TEST` too, since there is no example key like the `example` gateway. To decrypt the token, see [Decrypt the token yourself](/docs/guides/server-processing#decrypt-the-token-yourself-google-pay-direct).

## 4. Prebuild and run

```bash
npx expo prebuild --clean
npx expo run:android
```

## Testing

- Use a **real device** or an **emulator with a Google Play system image**, signed in to a Google account.
- In `googlePayEnvironment: 'TEST'`, Google Pay shows its test cards, and no token can be used for a live charge. See [TEST environment](/docs/guides/testing#test-environment) for what it can't verify and how to get a token your gateway accepts.
- `PRODUCTION` needs Google's approval. See [Production access](/docs/guides/testing#production-access).
- Before each release, run the [release checklist](/docs/guides/testing#release-checklist).

## If Android kills the app during payment

If the user switches to another app while the Google Pay sheet is open, Android can kill your app's process to free memory. When the user comes back and finishes or closes the sheet, your app restarts with a new JS runtime. The `startPayment()` call that opened the sheet no longer exists, so its result is dropped:

- No token reaches your app, so your backend charges nothing.
- The cart and checkout screen are gone unless your app restores them. The user has to start the payment again.

The payment survives a recreated Activity, for example after a configuration change your Activity doesn't handle: the result still reaches `startPayment()`.

To reproduce a process death, open the sheet, press Home, run `adb shell am kill <your.package.name>`, reopen the app from Recents, and close the sheet.

## Card authentication and 3-D Secure

By default, Google Pay accepts both kinds of card ([`googlePayAllowedAuthMethods`](/docs/api/types#googlepayauthmethod)):

- `'CRYPTOGRAM_3DS'` cards are tokenized on the device. The token holds a 3-D Secure cryptogram.
- `'PAN_ONLY'` cards are saved to the payer's Google account. The token holds the card number and no cryptogram, so the payment is not authenticated.

Google requires you to trigger 3-D Secure (step-up authentication) for `PAN_ONLY` payments under the same rules as any other card payment. This matters most where Strong Customer Authentication applies, such as the EEA. Your gateway runs the 3-D Secure step after your backend receives the token; see your gateway's Google Pay guide. See Google's [Android tutorial](https://developers.google.com/pay/api/android/guides/tutorial) and [integration checklist](https://developers.google.com/pay/api/android/guides/test-and-deploy/integration-checklist).

If your gateway cannot run 3-D Secure for Google Pay, accept only device tokens:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

usePaymentCheckout({
  googlePayAllowedAuthMethods: ['CRYPTOGRAM_3DS'],
})
```

Google can also report whether it has already verified the card and authenticated the cardholder. Ask for it with `googlePayAssuranceDetailsRequired`, and read [`token.paymentMethod.assuranceDetails`](/docs/api/types#googlepayassurancedetails). When both `accountVerified` and `cardHolderAuthenticated` are `true`, Google says you don't need to step up the payment:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

const order = { id: 'order_123' } // your order

usePaymentCheckout({
  googlePayAssuranceDetailsRequired: true,
  onAuthorize: async (token) => {
    const assurance = token.paymentMethod.assuranceDetails
    // Your server charges each order at most once, also when the app
    // retries after a lost response.
    const response = await fetch('https://api.yourserver.com/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, orderId: order.id, assurance }),
    })
    return response.ok ? { status: 'success' } : { status: 'failure' }
  },
})
```

The details are not part of the encrypted token: they reach your server through your app, as above, with nothing to prove Google sent them. Treat them as a risk signal, not as the only reason to skip 3-D Secure, and prefer your gateway's own report of them if it has one. See Google's [AssuranceDetailsSpecifications](https://developers.google.com/pay/api/android/reference/response-objects#assurance-details-specifications).

## The `donate` button

`GooglePayButton` with `buttonType="donate"` is only for nonprofits that Google has validated. See the [Google Pay brand guidelines](https://developers.google.com/pay/api/android/guides/brand-guidelines). Get Google's approval before you collect donations with Google Pay.

## Troubleshooting

- **Button not showing:** Ensure `enableGooglePay: true` is set, prebuild was run, and Google Play Services is available.
- **Google Pay unavailable:** Add a card in Google Pay on the device; for testing use `googlePayEnvironment: 'TEST'` and correct gateway config.
- See [Troubleshooting](/docs/troubleshooting#android-google-pay) for more.

If you are integrating with Przelewy24, see [Przelewy24](/docs/integrations/przelewy24) for an end-to-end app + backend flow.
