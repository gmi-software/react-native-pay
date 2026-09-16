# Changelog

All notable changes to this project are documented in this file.

## Unreleased

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
