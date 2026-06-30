# Changelog

All notable changes to this project are documented in this file.

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
