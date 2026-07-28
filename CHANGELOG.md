# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Fixed

- **iOS startup crash on React Native 0.80+ (`folly dynamic.cpp:378 Check failed: 0`).**
  `NitroPay.podspec` no longer defines `FOLLY_NO_CONFIG` on React Native ≥ 0.80
  (mismatched folly config vs React Native core). Flags remain for React Native < 0.80.

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
