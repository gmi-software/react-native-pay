# Troubleshooting

Common issues and fixes for React Native Pay.

## Before you debug

- Ensure your cart is not empty. `startPayment()` fails with `code: 'CONFIGURATION'` and a "Cart is empty" error when `items.length === 0`.
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
folly config. **Fixed in 0.0.17** — upgrade, then rebuild:

```bash
npx expo prebuild --clean
```

### Apple Pay button not showing

`ApplePayButton` renders on iOS whatever the Apple Pay setup, and renders nothing on Android. If it's missing on iOS, your app hid it: check what `isSupported` and `hasActiveCard` returned (see [Check availability](/docs/guides/availability)). On a device without Wallet set up, `isSupported` can be `true` while `hasActiveCard` is `false`.

### The Apple Pay sheet doesn't open or the payment fails

- **Merchant ID mismatch:** The Expo plugin `merchantIdentifier` must exactly match your Apple Developer Merchant ID.
- **Missing capability:** Confirm "Apple Pay Payment Processing" is enabled in Xcode and linked to the same Merchant ID.
- **No merchant ID in the app:** `code: 'CONFIGURATION'` with an error starting "No Apple Pay merchant identifier configured" means neither `applePayMerchantIdentifier` nor the Info.plist key `ReactNativePayApplePayMerchantIdentifiers` is set. The Expo plugin writes the key; in a bare app, see [Bare React Native](/docs/setup/bare-react-native).
- Add a valid card in **Settings -> Wallet & Apple Pay**.
- Confirm the App ID has Apple Pay enabled and linked to your Merchant ID.
- For production, ensure your Payment Processing Certificate is created and installed in your gateway.

### The Apple Pay sheet closes right away

`startPayment` resolves with `status: 'cancelled'` whenever the sheet closes before the user authorizes. PassKit doesn't tell the app why the sheet closed, so a sheet that closes by itself, or barely appears, reports the same cancel. One reported cause is a merchant ID that Apple Pay isn't set up for:

- The merchant ID in the request, or the first one in the Info.plist key `ReactNativePayApplePayMerchantIdentifiers`, must be listed under the **Apple Pay Payment Processing** capability in Xcode and in your App ID.
- Rebuild after changing the Expo plugin's `merchantIdentifier`: `npx expo prebuild --clean`.

In a debug build, the library logs a warning when the sheet closes less than 1 second after it appeared, before the user authorized. The result is still `status: 'cancelled'` and `code: 'CANCELLED'`, and a user who closes the sheet that fast gets the same warning. The warning starts with `[NitroPay] The Apple Pay sheet closed` and appears in the Xcode console, not in Metro. Without Xcode, stream the simulator's log:

```bash
xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "[NitroPay]"'
```

On a physical device, open Console.app on the Mac, select the device and search for `[NitroPay]`.

Release builds log nothing, because the payment request holds your merchant IDs, item labels and amounts.

See [Apple Pay button not showing](#apple-pay-button-not-showing) for the full checklist.

### "Unable to present payment authorization"

`startPayment` resolves with `status: 'failed'`, `code: 'NOT_AVAILABLE'` and this `error` when PassKit could not show the Apple Pay sheet. No sheet appeared and nothing was charged. The payment has ended, so the next `startPayment` call opens a new sheet. If you see it while the app is in the foreground, [open an issue](https://github.com/gmi-software/react-native-pay/issues) with the iOS version and what was on screen.

### "Unknown merchant capability"

The payment fails with `code: 'CONFIGURATION'` and `Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"` when `merchantCapabilities` contains any other value, on Android too. Case doesn't matter (`'3ds'` works). See [MerchantCapability](/docs/api/types#merchantcapability).

### Invalid Apple button type/style errors

Use only supported Apple button values:

- `buttonType`: `'buy' | 'setUp' | 'book' | 'donate' | 'continue' | 'reload' | 'addMoney' | 'topUp' | 'order' | 'rent' | 'support' | 'contribute' | 'tip'`
- `buttonStyle`: `'white' | 'whiteOutline' | 'black'`

## Android (Google Pay)

### Google Pay button not showing

`GooglePayButton` renders on Android whatever the Google Pay setup, and renders nothing on iOS. If it's missing on Android, your app hid it: check what `isSupported` and `hasActiveCard` returned (see [Check availability](/docs/guides/availability)).

### `isSupported` or `hasActiveCard` is `false` on Android

- Set `enableGooglePay: true` in your Expo plugin config.
- Ensure Google Play Services is available (real device or Play-enabled emulator).

- Add at least one card in Google Pay on the device.
- Use `googlePayEnvironment: 'TEST'` for test flows.
- Verify `googlePayMerchantId`, `googlePayGateway`, and `googlePayGatewayMerchantId`, or with `'direct'` tokenization, `googlePayTokenization.publicKey` and the key registered in the Google Pay & Wallet Console.

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

If an app throws `React Native Pay: the native PaymentHandler is not available`, the app runs without the native module:

- Install `react-native-nitro-modules` (required): `bun add react-native-nitro-modules`.
- Rebuild after adding/upgrading the package. With Expo, run `npx expo prebuild` and use a development build: Expo Go doesn't include the native module.
- On web there is no native module. Importing the package works there, `usePaymentCheckout` reports `isSupported: false`, and both pay buttons render nothing.

### Jest tests

Importing the package doesn't need the native module, so tests of code that only uses helpers such as `formatAmount` run without a mock. Tests that call `HybridPaymentHandler`, run a payment through `usePaymentCheckout`, or render a pay button on its platform need a mock of `react-native-nitro-modules`:

```ts no-check
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => ({
      payServiceStatus: async () => ({ isSupported: true, hasActiveCard: true }),
      isPaymentInProgress: () => false,
      startPayment: async () => ({ status: 'success', success: true }),
      openPaymentSetup: () => {},
    }),
  },
  getHostComponent: (name: string) => name,
  callback: (func: unknown) => ({ f: func }),
}))
```

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
