# Changelog

All notable changes to this project are documented in this file.

## Unreleased

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

### Fixed

- **Amounts reach Apple Pay and Google Pay exactly.** iOS converted amounts with `Decimal(Double)`,
  so `19.99` reached PassKit as `19.98999999999999488`. Amounts now cross into native code as
  decimal strings, iOS parses them with `NSDecimalNumber` and Android with `BigDecimal`, and both
  sum them exactly. `calculateTotal` and the hook's `total` use the same exact arithmetic. Google
  Pay prices for zero-decimal currencies validated by `normalizePaymentRequest` are sent without
  decimals (`"1500"` instead of `"1500.00"`), and Android rejects a negative total or a third
  decimal place instead of rounding.
- **Installing the package no longer runs `tsc` in your project.** 0.0.17 and earlier shipped a
  `postinstall` script (`tsc || exit 0`). The package does not include its own `tsconfig.json`, so
  `tsc` picked up the app's `tsconfig.json` and type-checked the whole app on every install; with a
  config that emits, it also wrote `.js` files next to the app's sources. The published package now
  has no install scripts. The contributor build of `lib/` moved to the private monorepo root, so
  `bun install` in this repository still builds it.

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
