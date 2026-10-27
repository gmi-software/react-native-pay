# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- **`PaymentResult.status` and `PaymentResult.code` say how a payment ended.** `status` is
  `'success'`, `'cancelled'` or `'failed'`. `code` is set on every other result: `'CANCELLED'`,
  `'IN_PROGRESS'`, `'CONFIGURATION'` (missing merchant ID, invalid amount, Google Pay developer
  error), `'NOT_AVAILABLE'` (the device can't show the sheet), `'PROVIDER_ERROR'` (Apple Pay, Google
  Pay or `onAuthorize` failed, including the `onAuthorize` timeout) or `'UNKNOWN'`. Every native exit
  path of `startPayment` maps to one of them, so apps no longer need to match `error` strings to
  tell a cancel or a setup error from a decline. `success` and `error` stay as before. New types:
  `PaymentStatus` and `PaymentErrorCode`.
- **`HybridPaymentHandler.isPaymentInProgress()`** synchronously returns whether a payment started
  with `startPayment` (directly or by `usePaymentCheckout`) has not settled yet.
- **Billing and shipping addresses, email and phone number come back in the result.** Set
  `billingContactRequired`, `shippingContactRequired`, and the new `emailRequired` and
  `phoneNumberRequired`, in `PaymentRequest` or in the `usePaymentCheckout` config. They fill
  `billingContact`, `shippingContact`, `emailAddress` and `phoneNumber` on `PaymentResult`, on iOS
  and Android. `onAuthorize` receives the same fields as its second argument, so your server can
  check the address before it charges. Google Pay only collects a phone number with an address:
  without `shippingContactRequired`, Android asks for it with at least the billing name, country
  and postal code. New types: `PaymentContact`, `PaymentDetails` and `ShippingType`.
- **Shipping methods.** `PaymentRequest.shippingMethods` now takes `ShippingMethod` values
  (`identifier`, `label`, `amount`, `detail`). The selected method is shown as its own line,
  included in the total, and returned as `PaymentResult.shippingMethod` and in `onAuthorize`. On
  iOS the payer picks one, and the first is selected by default. Google Pay cannot offer a choice
  yet, so Android charges the first method. An empty or repeated `identifier`, a negative
  `amount`, or `paymentItems` that total less than zero without shipping fail the payment.
- **`googlePayAllowedAuthMethods`** in `PaymentRequest` and the `usePaymentCheckout` config
  (`GooglePayAuthMethod[]`: `'PAN_ONLY'`, `'CRYPTOGRAM_3DS'`) limits which Google Pay cards are
  accepted, for example device tokens only under SCA. Both by default, as before.
- **More card networks.** `PaymentNetwork` gains `cartesBancaires`, `chinaUnionPay`, `dankort`,
  `eftpos`, `girocard`, `mada`, `mir`, `quicPay`, `suica`, `vPay`, `waon`, `nanaco`, `bancontact`,
  `postFinance`, `pagoBancomat`, `tmoney`, `meeza`, `napas`, `bankAxept`, `himyan`, `jaywan` and
  `myDebit`, which Apple Pay accepts in `supportedNetworks` and reports in results. Android
  accepts `jcb` and `interac`, and `electron`, `maestro` and `elo` for Brazilian combo cards.
- **`GooglePayButton` takes `supportedNetworks`, `googlePayAllowedAuthMethods` and
  `merchantCapabilities`,** and `PayServiceStatusOptions` takes `googlePayAllowedAuthMethods`, under
  the same names as in `PaymentRequest`. Give them the values of your request, so the button and
  `hasActiveCard` count the same cards as the payment. `usePaymentCheckout` passes its config to
  `payServiceStatus`.
- **Android honours a debit-only `merchantCapabilities`.** `'Debit'` without `'Credit'` now leaves
  credit cards out of the Google Pay request (`allowCreditCards: false`), as UK gambling merchants
  must. Prepaid cards stay allowed. Google Pay cannot leave debit cards out, so `'Credit'` alone
  still accepts every card type on Android; `'3DS'` and `'EMV'` have no effect there. The button
  and the readiness check leave credit cards out too.

- **`disabled` on `ApplePayButton` and `GooglePayButton`** ignores taps, for example while a
  payment is in progress. The button looks the same: Apple's guidelines ask not to make the Apple
  Pay button appear unavailable, and Google's do not allow changing the Google Pay button's color.
- **`ApplePayButtonType`, `ApplePayButtonStyle`, `GooglePayButtonType`, `GooglePayButtonTheme`,
  `ApplePayButtonProps` and `GooglePayButtonProps` are exported.**

### Changed

- **`usePaymentCheckout` no longer treats a cancel as an error.** When the user closes the sheet,
  the hook sets `result` to the cancelled result and leaves `error` as `null`, so UIs that render
  `error` no longer show "Payment failed" for a cancel. Use `result.status` to tell the outcomes
  apart. Failures still set `error`.
- **iOS: every close of the sheet before authorization is a cancel.** iOS used to report
  `'Payment sheet was dismissed before authorization'` instead of `'Payment cancelled by user'`
  when the sheet closed within 0.75 seconds of appearing. Both now report `status: 'cancelled'` and
  `'Payment cancelled by user'`.
- **`PaymentResult` requires `status`.** Code that builds a `PaymentResult` itself, such as a test
  mock of `startPayment`, needs to add it.
- **`PaymentToken.transactionIdentifier` is optional, and missing on Android.** Android used to
  fill it with a random UUID generated on the device; Google Pay doesn't return a transaction
  identifier. Code that reads it as a `string` no longer type-checks. If your server uses it as an
  idempotency key, key idempotency on your order ID instead. On iOS it is still Apple's identifier.
- **`PaymentNetwork` has a new `'unknown'` value,** reported for a card on a network the library
  cannot name. Both platforms used to report such cards as `'visa'`. Code that switches over
  `token.paymentMethod.network` needs a case for it.
- **An unknown name in `supportedNetworks` fails the payment** on both platforms, with an `error`
  that contains `Unknown payment network "<value>". Use a PaymentNetwork value such as "visa" or
  "mastercard"`. iOS used to drop it silently. Names now match ignoring case, so `'Visa'` works,
  and a network the platform does not offer is left out; the payment fails when none is left.
  `payServiceStatus` rejects with the same configuration error for a value the payment would
  refuse, instead of answering `hasActiveCard: false`.
- **An unknown value in `merchantCapabilities` fails the payment on Android too,** with the same
  `error` as on iOS: `Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or
  "Debit"`. Android used to ignore the field.
- **Android: `PaymentMethod.displayName` is the wallet's description of the card** (Google Pay's
  `paymentMethodData.description`, for example "Visa •••• 1234") instead of `"VISA 1234"`. Google
  Pay asks apps not to show `cardNetwork` to the payer. Use `network` for logic.

- **`PaymentRequest.shippingMethods` is `ShippingMethod[]`, not `PaymentItem[]`.** Neither
  platform ever read the old field, so only the type changes: give each method an `identifier`
  and drop `type`.

- **Amounts can be decimal strings, and `PaymentItem.amount` is now `number | string`**
  (`PaymentAmount`). Code that reads `item.amount` as a number no longer type-checks; display
  amounts with `formatAmount(item.amount, currencyCode)`, which now accepts strings and an optional
  currency code. Requests from `createPaymentRequest` hold their amount as a decimal string.
- **Payments with invalid amounts no longer start.** `usePaymentCheckout().startPayment()` sets
  `error` and returns `null`, and `createPaymentRequest` throws, when an amount is `NaN` or
  infinite, has more decimal places than the currency allows (ISO 4217: `1.005` USD, `1200.5`
  JPY, including float results such as `0.1 + 0.2`), or the total is negative. Negative line items
  (discounts) are still allowed. For requests built by hand, call the new
  `normalizePaymentRequest` before `HybridPaymentHandler.startPayment`.
- **`merchantCapabilities` is typed as `MerchantCapability[]`** (`'3DS' | 'EMV' | 'Credit' |
  'Debit'`) in the `usePaymentCheckout` config and in `createPaymentRequest`. Passing a `string[]`
  no longer type-checks. `PaymentRequest.merchantCapabilities` stays `string[]`.
- **`usePaymentCheckout().startPayment()` leaves the hook state alone when a payment is already in
  flight.** If `HybridPaymentHandler.startPayment()` or another `usePaymentCheckout` started that
  payment, the hook used to set `isProcessing` to `true`, clear `result` and `error`, and then store
  the "A payment is already in progress" failure in them. It now returns that failure without
  touching `isProcessing`, `result` or `error`, as it already did for its own payment. On iOS,
  `startPayment` now marks the payment in progress as soon as it is called, as on Android, instead
  of when it starts presenting the sheet, so `isPaymentInProgress()` sees a payment started in the
  same JS tick.
- **Availability checks are asynchronous and report `isSupported` and `hasActiveCard`.**
  `HybridPaymentHandler.payServiceStatus()` now returns a Promise, and `PayServiceStatus` is
  `{ isSupported, hasActiveCard }` instead of `{ canMakePayments, canSetupCards }`, which meant
  different things on each platform. `usePaymentCheckout` returns `isSupported`, `hasActiveCard`
  and a new `refreshStatus()` instead of `canMakePayments` and `canSetupCards`. The check takes the
  networks, merchant capabilities and Google Pay environment to check against; the hook passes
  those of its payment request. To migrate, `await` the call and read `isSupported` where you read
  `canMakePayments` (the same check on iOS, and the one Google recommends for showing the button on
  Android). See
  [Check availability](https://gmi-software.github.io/react-native-pay/docs/guides/availability).
- **`HybridPaymentHandler.canMakePayments(networks)` is removed.** It answered the same question as
  `hasActiveCard`: call `payServiceStatus({ supportedNetworks: networks })` and read
  `hasActiveCard`. On Android it never asked the device, so `['visa']` was always `true`.
- **iOS: `HybridPaymentHandler.openPaymentSetup()`** opens Wallet so the user can add a card, for a
  "Set up Apple Pay" button (`ApplePayButton` with `buttonType="setUp"`). It does nothing on Android.

- **The pay buttons take a plain function as `onPress`: remove `callback()`.** `ApplePayButton`
  and `GooglePayButton` are now React components around the native views, so
  `onPress={callback(handlePay)}` becomes `onPress={handlePay}`, and the `react-native-nitro-modules`
  import can go. A wrapped `onPress` still works, but no longer type-checks, and logs a warning in
  development. The props are `ViewProps` plus the button's own; `hybridRef` is gone.
- **Each pay button renders nothing on the other platform,** with a warning in development, instead
  of failing, since that native view does not exist there.

### Deprecated

- **`PaymentResult.transactionId`.** It is a random ID generated on the device for each successful
  result, not an identifier from Apple, Google or the gateway, and it changes on every attempt. The
  docs no longer suggest it as an idempotency key; use your order ID. It is still set for now.

### Fixed

- **Expo plugin: works without options and keeps an existing Google Pay manifest entry.** Listing
  `"@gmisoftware/react-native-pay"` without an options object crashed `expo prebuild` with
  `Cannot read properties of undefined (reading 'enableGooglePay')`. When `enableGooglePay` was
  omitted, the plugin also removed `com.google.android.gms.wallet.api.enabled` from the Android
  manifest, even if another plugin, such as Stripe's, had added it. The plugin now adds the entry
  when `enableGooglePay` is `true`, removes it when it is `false`, and leaves the manifest alone
  when it is omitted. Prebuild also warns when a `merchantIdentifier` does not start with
  `merchant.`.
- **iOS: `ApplePayButton` keeps its `PKPaymentButton` across re-renders.** Every prop update
  removed the button and created a new one, so an `onPress` with a new identity on each render
  rebuilt it on every parent re-render. It is now rebuilt only when `buttonType` or `buttonStyle`
  changes.
- **Android: `GooglePayButton`'s `radius` is in dp, as documented.** It was passed to Google Pay as
  pixels, so corners were about a third of the requested size on a typical phone. Apps that
  enlarged `radius` to compensate should set it back.
- **iOS: a payment no longer hangs when the Apple Pay sheet cannot stay on screen.** The sheet
  was presented from the app's top view controller. When `startPayment()` ran while that view
  controller was being dismissed, for example while a modal closed, UIKit closed the sheet with
  it, or refused to show it, and PassKit never called back. The promise never settled, and every
  later call returned "A payment is already in progress" until the app restarted. The sheet now
  opens in its own window (`PKPaymentAuthorizationController`), so the app's view controllers
  cannot refuse or close it. If PassKit still cannot show it, `startPayment` resolves with
  `status: 'failed'`, `code: 'NOT_AVAILABLE'` and
  `error: 'Unable to present payment authorization'`, and the next call opens a new sheet.
- **Android: `supportedNetworks` limits the cards the payer can choose.** Android ignored it and
  always offered Visa, Mastercard, Amex and Discover, so a merchant whose gateway refuses Amex
  still received Amex tokens, and JCB or Interac could not be enabled. The payment request, the
  `GooglePayButton` and the readiness check behind `payServiceStatus` now use the same networks
  and auth methods.
- **Android: `PaymentMethod.type` reports the card's funding source.** It was always
  `'unknown'`. It now reads Google Pay's `cardFundingSource`, so a result reports `'credit'`,
  `'debit'` or `'prepaid'`, and `'unknown'` only when Google Pay does not know. `'store'` stays
  iOS only.
- **Requested contact details are no longer lost.** iOS asked for the billing and shipping
  address but never returned them, and Android ignored `billingContactRequired` and
  `shippingContactRequired`. See Added.
- **iOS: an unknown `shippingType` fails the payment** with `Unknown shipping type "<value>". Use
  "shipping", "delivery", "storePickup" or "servicePickup"` instead of silently becoming
  `"shipping"`. Android ignores `shippingType`.
- **Android: availability checks no longer block the JS thread.** `payServiceStatus()` made two
  `isReadyToPay` calls one after the other and waited up to 5 seconds for each on the JS thread, so
  every checkout screen froze touches, animations and timers until Google Play services answered.
  Both calls now run at once and resolve the Promise when they finish; one that takes longer than
  5 seconds counts as `false`. On iOS, the PassKit checks run off the JS thread too.
- **Android: availability is checked in the environment you pay in.** The check always used `TEST`
  until a payment had started, and in `TEST` Google Pay reports a card whether or not there is one,
  so production apps showed the pay button for users without a card. It now uses
  `googlePayEnvironment` from the hook config or the options.
- **iOS: Apple Pay requests always include 3DS or EMV.** PassKit needs one of them, but iOS
  matched only the exact strings `3DS`, `EMV`, `Credit` and `Debit` and dropped everything else,
  so `[]`, `['Credit']` or `['3ds']` built a request with neither. Values are now matched
  case-insensitively, `3DS` is added when neither protocol is given, and an unknown value fails the
  payment with `Unknown merchant capability "<value>". Use "3DS", "EMV", "Credit" or "Debit"`.
- **`usePaymentCheckout` no longer rebuilds `paymentRequest` and `startPayment` on every render.**
  Both depended on the identity of the config object, and apps usually pass an inline one, so
  effects, memoized children and the pay button's `onPress` that used them changed on every render
  too. The hook now compares the config's values, and `supportedNetworks` and
  `merchantCapabilities` by content. An inline `onAuthorize` no longer changes `startPayment`, which
  uses the `onAuthorize` from the latest render; a payment keeps the one it started with until it
  settles.
- **Amounts reach Apple Pay and Google Pay exactly.** iOS converted amounts with `Decimal(Double)`,
  so `19.99` reached PassKit as `19.98999999999999488`. Amounts now cross into native code as
  decimal strings, iOS parses them with `NSDecimalNumber` and Android with `BigDecimal`, and both
  sum them exactly. `calculateTotal` and the hook's `total` use the same exact arithmetic. Google
  Pay prices for zero-decimal currencies validated by `normalizePaymentRequest` are sent without
  decimals (`"1500"` instead of `"1500.00"`), and Android rejects a negative total or a third
  decimal place instead of rounding.
- **iOS: the Apple Pay sheet now names the merchant in the total.** PassKit shows the last summary
  item as the total ("Pay *label*"). A one-item cart sent that item as the total, so the sheet read
  "Pay Coffee"; a cart with several items and no `merchantName` read "Pay Total". The library now
  always appends a total labelled with `merchantName`, and falls back to the app's display name
  (`CFBundleDisplayName`, then `CFBundleName`). A one-item cart now shows the item line and then
  "Pay *merchant*". If you passed your own "Total" item, remove it: it now appears as a line item
  above the total.
- **Installing the package no longer runs `tsc` in your project.** 0.0.17 and earlier shipped a
  `postinstall` script (`tsc || exit 0`). The package does not include its own `tsconfig.json`, so
  `tsc` picked up the app's `tsconfig.json` and type-checked the whole app on every install; with a
  config that emits, it also wrote `.js` files next to the app's sources. The published package now
  has no install scripts. The contributor build of `lib/` moved to the private monorepo root, so
  `bun install` in this repository still builds it.
- **The published package no longer includes the library's tests.** 0.0.17 shipped
  `src/**/__tests__` and their compiled copies under `lib/**/__tests__` (21 files).
- **Android: release builds no longer write payment requests to logcat.** The payment handler
  logged the full Google Pay request (merchant ID, gateway merchant ID, item labels and amounts)
  with `Log.d`, which release builds keep, and the Google Pay button logged on every prop update.
  `HybridPaymentHandler` and `HybridGooglePayButton` now log in debug builds only. Payment errors
  still reach your app in `result.error`.
- **Android: the payment handler no longer stays registered on the React context.** Each handler
  added an activity result listener when it was created and never removed it, so the context kept
  every handler alive. The listener is now registered only while the Google Pay sheet is open.
- **Android: Google Pay no longer uses the deprecated `AutoResolveHelper.resolveTask`.** The sheet
  is shown with `ResolvableApiException.startResolutionForResult`, and results and error messages
  are unchanged. If Android kills the app while the sheet is open, the payment is dropped and
  nothing is charged; see
  [Android (Google Pay)](https://gmi-software.github.io/react-native-pay/docs/setup/android-google-pay#if-android-kills-the-app-during-payment).
- **Build files.** The podspec's `source` points to this repository instead of the Nitro template,
  the unused `GOOGLE_PAY_ENVIRONMENT` Gradle property is gone (the environment comes from
  `googlePayEnvironment`), and the Android build uses `lint {}` and Gradle's assignment syntax.
  Java and Kotlin now both target 17. React Native's Gradle plugin already compiled the library
  for 17, so this changes nothing unless your app sets `react.internal.disableJavaVersionAlignment`.

## 0.0.17 — 2026-09-16

### Fixed

- **iOS startup crash on React Native 0.80+ (`folly dynamic.cpp:378 Check failed: 0`).**
  `NitroPay.podspec` no longer defines `FOLLY_NO_CONFIG` on React Native ≥ 0.80
  (mismatched folly config vs React Native core). Flags remain for React Native < 0.80.
  The podspec now resolves React Native via `Open3` (no shell interpolation of the
  installation path) and fails `pod install` with an explicit error when React Native
  or its version cannot be determined, instead of silently applying the wrong flags.
- **iOS crash from a double Promise resolve on Apple Pay.** Nitro fatals when the same
  payment settles twice on sheet dismiss. Settling is now one-shot (matching Android),
  and success/cancel resolve only from `didFinish`.
- **iOS: overlapping Apple Pay requests.** A second `startPayment` while one is in flight
  no longer replaces the shared completion/delegate state and delivers the first result to
  the wrong Promise. Overlapping calls are rejected with `A payment is already in progress`.
- **Android build failure on AGP 9 (`Cannot add extension with name 'kotlin'`).**
  AGP 9 ships built-in Kotlin support and registers the `kotlin` extension itself, so the
  Kotlin plugin is now applied only when nothing has registered that extension. This needs
  no AGP version table and also covers AGP 10, where the `android.builtInKotlin` opt-out is removed.
- **Missing TypeScript declarations in the published package.** 0.0.16 shipped `lib/` without
  `.d.ts` files even though `types` pointed at `lib/index.d.ts`, so importing the package raised
  `TS7016` under `noImplicitAny`/`strict` and silently fell back to `any` otherwise — no
  autocomplete and no type checking against the library. **Runtime was not affected:** Metro
  resolves the `react-native` field to the bundled `src/`, and `main` resolves to the bundled
  `lib/*.js`, so apps built and ran normally. The cause was a stale, committed
  `tsconfig.tsbuildinfo` that turned the incremental `tsc` run into a no-op; the build state is
  no longer committed and `prepack` now rebuilds `lib/` from scratch.

### Changed

- npm `homepage` now points to https://gmi.software/open-source.

## 0.0.16 — 2026-07-07

### Breaking changes

- Regenerated Nitrogen bindings for **react-native-nitro-modules 0.36+** (Expo SDK 57 / React Native 0.86).
- Peer dependency `react-native-nitro-modules` is now **>= 0.36.0** (was >= 0.35.0).

### Changed

- Example app upgraded to **Expo SDK 57** (React Native 0.86, React 19.2.3).
- `nitrogen` devDependency bumped to ^0.36.1; `react-native-nitro-modules` devDependency ^0.36.1.

### Migration

1. Upgrade `react-native-nitro-modules` to **0.36.1** (or newer 0.36.x).
2. If using Expo, upgrade to **SDK 57** (`npx expo install expo@^57.0.0 --fix`).
3. Run `npx expo prebuild --clean` and rebuild.

## 0.0.15 — 2026-06-30

### Breaking changes

- Regenerated Nitrogen bindings for **react-native-nitro-modules 0.35+** (JavaPart / CxxPart JNI model).
- Peer dependency `react-native-nitro-modules` is now **>= 0.35.0** (was >= 0.31.4).
- **Android minSdkVersion 26+** is required (Nitro Modules prefab / HardwareBuffer).

### Changed

- `NitroPay_minSdkVersion` set to 26; `NitroPay_ndkVersion` updated to 29.0.14206865.
- `nitrogen` devDependency pinned to ^0.35.9; `react-native-nitro-modules` devDependency ^0.35.10.
- Updated `cpp-adapter.cpp` to call `registerAllNatives()` (nitro 0.35 JNI_OnLoad pattern).

### Migration

1. Upgrade `react-native-nitro-modules` to **0.35.10** (or newer 0.35.x).
2. Set Android `minSdkVersion` to **26** in `expo-build-properties` or `build.gradle`.
3. Remove any consumer-side patches for `@gmisoftware/react-native-pay@0.0.14` nitrogen Android codegen.
4. Run `npx expo prebuild --clean` and rebuild.
