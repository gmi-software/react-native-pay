# Troubleshooting

Common issues and fixes for React Native Pay.

## Before you debug

- Ensure your cart is not empty. `startPayment()` returns `null` with a "Cart is empty" error when `items.length === 0`.
- Test on a real device whenever possible (simulator/emulator payment support is limited).
- Re-run native generation after plugin changes:

```bash
npx expo prebuild --clean
```

## Reading a failed payment

`startPayment` doesn't throw for a declined, cancelled or misconfigured payment. It resolves with a `PaymentResult` whose `status` and `code` say how it ended; [Error codes](/docs/payment-flow#error-codes) explains each code. When debugging:

- Read `error`: it names the problem, and on Android it ends with Google Pay's status code. Branch on `code` in your app, though: the text may change.
- A `'CANCELLED'` you didn't cause by closing the sheet usually points to setup. See [The Apple Pay sheet closes right away](#the-apple-pay-sheet-closes-right-away) and [Cancelled on a device without a Google account](#cancelled-on-a-device-without-a-google-account).

## iOS (Apple Pay)

### App crashes at launch with `folly dynamic.cpp:378 Check failed: 0`

On React Native 0.80+ (e.g. Expo SDK 57), the app can abort at startup with a stack
ending in `folly::dynamic::get<bool>()` / `BaseViewProps`. Linking the library is
enough; no pay button needs to be on screen.

Cause: `NitroPay.podspec` defined `FOLLY_NO_CONFIG`, mismatching React Native core's
folly config. **Fixed after 0.0.16** — upgrade, then rebuild:

```bash
npx expo prebuild --clean
```

### Apple Pay button not showing

- **Merchant ID mismatch:** The Expo plugin `merchantIdentifier` must exactly match your Apple Developer Merchant ID.
- **Missing entitlement/capability:** Confirm "Apple Pay Payment Processing" is enabled in Xcode and linked to the same Merchant ID.
- **Wrong device context:** Prefer a real iPhone with Wallet configured.

### "Cannot make payments" or payment sheet fails

- Add a valid card in **Settings -> Wallet & Apple Pay**.
- Confirm the App ID has Apple Pay enabled and linked to your Merchant ID.
- For production, ensure your Payment Processing Certificate is created and installed in your gateway.

### The Apple Pay sheet closes right away

`startPayment` resolves with `status: 'cancelled'` whenever the sheet closes before the user authorizes. PassKit doesn't tell the app why the sheet closed, so a sheet that closes by itself, or barely appears, reports the same cancel. One reported cause is a merchant ID that Apple Pay isn't set up for:

- The merchant ID in the request, or the first one in your app's entitlements, must be listed under the **Apple Pay Payment Processing** capability in Xcode and in your App ID.
- Rebuild after changing the Expo plugin's `merchantIdentifier`: `npx expo prebuild --clean`.

See [Apple Pay button not showing](#apple-pay-button-not-showing) for the full checklist.

### "Unknown merchant capability"

The payment fails with `code: 'CONFIGURATION'` and `Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"` when `merchantCapabilities` contains any other value, on Android too. Case doesn't matter (`'3ds'` works). See [MerchantCapability](/docs/api/types#merchantcapability).

### Invalid Apple button type/style errors

Use only supported Apple button values:

- `buttonType`: `'buy' | 'setUp' | 'book' | 'donate' | 'continue' | 'reload' | 'addMoney' | 'topUp' | 'order' | 'rent' | 'support' | 'contribute' | 'tip'`
- `buttonStyle`: `'white' | 'whiteOutline' | 'black'`

## Android (Google Pay)

### Google Pay button not showing

- Set `enableGooglePay: true` in your Expo plugin config.
- Ensure Google Play Services is available (real device or Play-enabled emulator).
- Render only the Android button on Android (`Platform.OS === 'android'`).

### "Google Pay unavailable"

- Add at least one card in Google Pay on the device.
- Use `googlePayEnvironment: 'TEST'` for test flows.
- Verify `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId`.

### `hasActiveCard` is `true` without a card

The check asked the Google Pay `TEST` environment, which reports a card whether or not there is one. Pass `googlePayEnvironment: 'PRODUCTION'` to `usePaymentCheckout` or `payServiceStatus`. An emulator with no Google account signed in reports `false` even in `TEST`. See [Check availability](/docs/guides/availability).

### Cancelled on a device without a Google account

Google Pay asks the user to sign in to a Google account before it shows the sheet. Dismissing that prompt returns the same result as closing the sheet, so `startPayment` resolves with `status: 'cancelled'`. Sign in to a Google account on the device or emulator, and add a card to it.

### `CONFIGURATION` from Google Pay

When Google Pay reports a setup problem, such as `DEVELOPER_ERROR`, the result has `code: 'CONFIGURATION'` and Google's status code at the end of `error` (for example `(status code 10)`). Google logs the details of merchant setup problems to logcat:

```bash
adb logcat -s WalletMerchantError
```

The `OR_BIBED_*` codes there are explained on Google's [troubleshooting page](https://developers.google.com/pay/api/android/support/troubleshooting), such as `OR_BIBED_06` for the `example` gateway in production.

### Manifest/build issues

- Run `npx expo prebuild --clean` and rebuild.
- Ensure no other plugin overrides Google Pay metadata in `AndroidManifest.xml`.

### No logs from the library

The library writes to logcat in debug builds only. Release builds log nothing, because the payment request holds your merchant IDs, item labels and amounts. To see the logs, run a debug build and filter by tag:

```bash
adb logcat -s HybridPaymentHandler HybridGooglePayButton
```

Payment errors don't depend on logs: they reach your app in `result.error`.

## Pay button `onPress` and `callback()`

`ApplePayButton` and `GooglePayButton` take a plain function as `onPress`. Earlier versions required wrapping it with `callback()` from `react-native-nitro-modules`. That is no longer needed: remove the wrapper, and the `callback` import if nothing else uses it.

```tsx
import { Platform } from 'react-native'
import { ApplePayButton, GooglePayButton } from '@gmisoftware/react-native-pay'

const handlePay = async () => {
  // Call startPayment() from usePaymentCheckout here
}

{Platform.OS === 'ios' ? (
  <ApplePayButton buttonType="buy" buttonStyle="black" onPress={handlePay} />
) : (
  <GooglePayButton buttonType="buy" theme="dark" onPress={handlePay} />
)}
```

A wrapped `onPress` still works, but TypeScript reports `Type 'NitroViewWrappedCallback<...>' is not assignable to type '() => void'`, and development builds log a warning.

## Build / native module issues

### Nitro or native module not found

- Install `react-native-nitro-modules` (required): `bun add react-native-nitro-modules`.
- Rebuild after adding/upgrading the package.

### Clean rebuild

If native build artifacts are stale:

```bash
rm -rf node_modules ios/Pods ios/build android/build android/app/build
bun install
cd ios && pod install
```

Then rebuild the app.

## Still stuck?

- Ensure you are on supported versions in [Compatibility](/docs/compatibility).
- Open an issue: [GitHub Issues](https://github.com/gmi-software/react-native-pay/issues).
