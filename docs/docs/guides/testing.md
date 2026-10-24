# Testing payments

Before you release, run a payment end to end on both platforms: in the Apple Pay sandbox on an iPhone, and in the Google Pay `TEST` environment on Android. This page covers both setups, the production access Google requires, and the flows to check before every release.

## What each environment can verify

No test environment proves that a real charge goes through. Each one covers part of the flow:

| Environment | Verifies | Cannot verify |
|---|---|---|
| iOS Simulator | The sheet opens and shows your line items and the "Pay *merchantName*" total. Cancel, [`onAuthorize`](/docs/guides/server-processing#charge-before-the-sheet-closes) success and failure, and the double-tap guard. No card or account needed. | A token your gateway can charge. Apple doesn't document what the Simulator's token contains, and developers report that its `paymentData` is empty. Apple also says the Simulator doesn't support every Apple Pay feature, without listing which. |
| iPhone with a sandbox tester | The full sheet with Apple's test cards, Face ID or passcode, and a token your payment processor can test decrypting. | A completed charge. Apple says sandbox transactions are declined before fulfillment, because the test key doesn't match your production key. |
| Android, `TEST` environment | The Google Pay sheet with Google's test cards, the result handling, and `onAuthorize`. No Google Pay merchant ID needed. | Availability: `canMakePayments` is always `true` in `TEST`. A live charge: `TEST` tokens never carry real card data, so only your gateway's test environment can process them. Your production request: the merchant ID and the `PRODUCTION` checks only run in `PRODUCTION`. |
| Android, `PRODUCTION` | Everything, with real cards. | Nothing, but it only works after Google grants your app [production access](#production-access). |

Availability is hard to test on both platforms. On iOS, `canMakePayments` comes from `PKPaymentAuthorizationViewController.canMakePayments()`, which Apple documents as `true` when the device supports payments, even with no card in Wallet. On Android, the library checks availability against the `TEST` environment until a payment has started, even in a `PRODUCTION` build ([#16](https://github.com/gmi-software/react-native-pay/issues/16)).

## Apple Pay

### iOS Simulator

The Simulator runs the Apple Pay sheet without a card in Wallet or a sandbox account:

```bash
npx expo run:ios
```

Use it to check the sheet's contents and your app's handling of each result (see the [release checklist](#release-checklist)). Don't send the Simulator's token to your gateway, and test anything that depends on a real token, such as your server's charge, on a device.

### Sandbox on an iPhone

Apple's [sandbox testing page](https://developer.apple.com/apple-pay/sandbox-testing/) lists the supported regions and the test card numbers. To run a sandbox payment:

1. **Create a sandbox tester.** In [App Store Connect](https://appstoreconnect.apple.com/), open **Users and Access**, then **Sandbox**, then **Testers**, and click **+**. Use an email address that isn't already an Apple Account.
2. **Sign the device in as the tester.** On the iPhone, sign out of your Apple Account in Settings, then sign in with the sandbox tester. For Apple Pay the tester must be the device's Apple Account, not only the App Store's sandbox account.
3. **Set a supported region.** In **Settings → General → Language & Region**, pick a region where Apple Pay sandbox is supported. Amex test cards only work with the UK or US region.
4. **Add a test card.** In Wallet, tap **+**, choose a debit or credit card, and enter one of Apple's test cards manually. If Wallet asks for a verification code, enter `111111`.
5. **Install a development build** with Developer Mode on:

   ```bash
   npx expo run:ios --device
   ```

   The Merchant ID in your plugin config must belong to your Apple Developer team. The example app's Merchant ID (`merchant.pl.sfd.sklep`) won't sign with yours, so replace it before you run the example on a device.
6. **Pay.** The sheet shows your test card. After you authorize, `startPayment` resolves with a sandbox token.

What you do with the sandbox token depends on your gateway. Apple says your processor can use it to test decrypting the payment data, but the charge itself is declined. Some gateways don't take sandbox tokens at all: Stripe, for example, [asks you to test](https://docs.stripe.com/apple-pay?platform=ios) with a real card in Wallet and its test API keys, and doesn't charge the card. Check your gateway's Apple Pay docs.

Test cards only work in the sandbox, and real cards only work in production. Before release, sign the device back in to a regular Apple Account and pay once with a real card. If your gateway has a test mode for real cards, use it. If not, make a small charge and refund it.

## Google Pay

### TEST environment

Android uses the `TEST` environment unless you set `googlePayEnvironment: 'PRODUCTION'`. You need:

- A real device, or an emulator with a Google Play system image, signed in to a Google account.
- Google Wallet with a payment method. Google's [setup page](https://developers.google.com/pay/api/android/guides/setup) asks you to add one.

Then run a development build:

```bash
npx expo run:android
```

In `TEST`, Google Pay shows a [suite of test cards](https://developers.google.com/pay/api/android/guides/resources/test-card-suite) by default. You don't need to join anything. To see your account's real cards in `TEST` instead, join the [googlepay-test-mode-real-data](https://groups.google.com/g/googlepay-test-mode-real-data) group. Real cards return placeholder data in `TEST` and are never charged.

The sheet labels you as an unverified merchant in `TEST`. That is expected.

**Get a token your gateway accepts.** If you leave `googlePayGateway` and `googlePayGatewayMerchantId` empty in `TEST`, the library sends Google's `example` gateway with `exampleGatewayMerchantId`. Google says the `example` gateway [returns no card data capable of a transaction](https://developers.google.com/pay/api/android/guides/tutorial), so your server can't charge it. To send a token to your gateway's test environment, set its test values:

```ts
import { usePaymentCheckout } from '@gmisoftware/react-native-pay'

usePaymentCheckout({
  googlePayEnvironment: 'TEST',
  googlePayGateway: 'your_gateway',
  googlePayGatewayMerchantId: 'your_test_gateway_merchant_id',
})
```

Some gateways, such as Stripe, Braintree, and Adyen, show their own test cards in the sheet when the request carries their test parameters, and their test environment returns realistic responses. The library sends only `gateway` and `gatewayMerchantId` as tokenization parameters, so check [your gateway's entry](https://developers.google.com/pay/api/android/reference/request-objects#gateway) for the parameters it expects.

**What `TEST` can't verify:**

- **Availability.** With `existingPaymentMethodRequired`, `isReadyToPay` [always returns `true` in `TEST`](https://developers.google.com/pay/api/android/reference/request-objects#IsReadyToPayRequest), so `canMakePayments` is `true` even with no card. You can't test the "no card" path in `TEST`.
- **A live charge.** `TEST` tokens never carry real card data. With your gateway's test values, its test environment can process them, but nothing is charged.
- **Your production request.** The library sends `googlePayMerchantId` and requires `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId` only in `PRODUCTION`. A missing value fails with, for example, `googlePayMerchantId is required in PRODUCTION`, which you only see in a `PRODUCTION` build.

### Production access

Google Pay only works in `PRODUCTION` after Google approves your app. Google's [publishing guide](https://developers.google.com/pay/api/android/guides/test-and-deploy/publish-your-integration) has the full steps. In short:

1. In the [Google Pay & Wallet Console](https://pay.google.com/business/console), choose the **Merchant** business type and complete your business profile.
2. Open **Google Pay API**, then **Get started**, and accept the Google Pay API Terms of Service and Acceptable Use Policy. Your Google Pay merchant ID then appears in the Console. Pass it as `googlePayMerchantId`.
3. Go through the [integration checklist](https://developers.google.com/pay/api/android/guides/test-and-deploy/integration-checklist) against your `TEST` build.
4. Under **Google Pay API → Integrations → Integrate with your Android app**, pick your app and the **Gateway** integration type. The Console only lists apps published on Google Play under the same Google account.
5. Upload screenshots of your `TEST` integration, and submit the app for approval.
6. Once approved, set `googlePayEnvironment: 'PRODUCTION'` and your production gateway values, sign the app with your release key, and publish it on Google Play. Google says the debug key doesn't work in `PRODUCTION`.

Until your app has production access, the sheet shows an "Unrecognized App" error. To find out why a `PRODUCTION` request fails, read the merchant error log:

```bash
adb logcat -s WalletMerchantError
```

Google's [troubleshooting page](https://developers.google.com/pay/api/android/support/troubleshooting) lists the error codes, such as `OR_BIBED_06` for the `example` gateway in production, and `OR_BIBED_13` for a signing key that doesn't match.

## Release checklist

Run these flows on an iPhone and on an Android device before every release, with the build configuration you ship. The example app's **Simulated Server (onAuthorize)** button rehearses them without a backend: tap it to cycle between `off`, `approve`, and `decline`. In `approve` and `decline` it waits 1.5 seconds and then resolves like a server that charged or declined the token.

In your own app, use your server against your gateway's test mode, and your gateway's decline test cards or amounts for the decline flow.

- [ ] **Success.** Pay with a test card.
  - `startPayment` resolves with `success: true` and a `token`, and your server charges once.
  - With `onAuthorize`, the Apple Pay sheet shows its checkmark only after your server answers. On Android, the Google Pay sheet closes first and `onAuthorize` runs after.
- [ ] **User cancel.** Open the sheet and close it without paying.
  - `startPayment` resolves with `success: false` and `error: 'Payment cancelled by user'`. Your server is not called.
  - On iOS, a sheet closed within 0.75 seconds of appearing reports `'Payment sheet was dismissed before authorization'`.
  - The hook also sets `error` for a cancel, so check that your UI doesn't show it as a failed payment.
- [ ] **Decline through `onAuthorize`.** Set the example app to `decline`, or make your server decline.
  - On iOS, the sheet shows the failure and lets the user retry, which calls `onAuthorize` again with a new token. Closing the sheet resolves `startPayment` with `success: false` and your `error`.
  - On Android, the sheet has already closed, and `startPayment` resolves with `success: false` and your `error`.
  - The order isn't marked paid, and a retry doesn't charge twice. Make the charge idempotent per order ID, not per token.
- [ ] **Slow server.** Make your server take longer than 25 seconds to answer `onAuthorize`.
  - `startPayment` resolves with `success: false` and `error: 'Payment authorization timed out'`. On iOS, the user can first retry from the sheet.
  - Your server may still charge after the app has given up. Check that your backend can reconcile that order.
- [ ] **Double tap.** Tap the pay button twice quickly.
  - Only one sheet opens. The second call resolves at once with `success: false` and `error: 'A payment is already in progress'`, and the first payment settles normally.
  - Your UI doesn't show the second result as a failed payment, and your server charges once.
- [ ] **Backgrounding.** Open the sheet, go to the home screen, and return to the app. Repeat after switching to another app.
  - `startPayment` settles exactly once, `isProcessing` returns to `false`, and the next tap opens a new sheet.
  - If the next payment reports `'A payment is already in progress'`, or the app stays in its processing state, [open an issue](https://github.com/gmi-software/react-native-pay/issues) with the platform and OS version.

Then check the release configuration:

- [ ] **iOS:** the Merchant ID in your plugin config is the one whose Payment Processing Certificate is installed in your gateway, and your server uses the gateway's live keys.
- [ ] **Android:** `googlePayEnvironment` is `'PRODUCTION'`, since an omitted value means `TEST`. `googlePayMerchantId` is your Console merchant ID, the gateway values are your live ones, Google has approved the app, and the build is signed with your release key.
- [ ] **Both:** `merchantName` is the business name you want on the sheet.
