# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- **`HybridPaymentHandler.isPaymentInProgress()`** synchronously returns whether a payment started
  with `startPayment` (directly or by `usePaymentCheckout`) has not settled yet.

### Changed

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

### Fixed

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
