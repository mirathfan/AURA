# Native Release Configuration

Last audited: 2026-10-09

AURA commits native `ios/` and `android/` projects. EAS therefore builds the committed native projects and does not automatically synchronize every `app.json` config-plugin value. Do not assume changing `app.json` alone changes an App Store build.

## iOS Effective Configuration

| Setting | Effective native value | Source parity |
|---|---|---|
| Display name | `AURA` | Matches `app.json` |
| Bundle identifier | `com.kasat.aura` | Matches `app.json` and Firebase plist |
| Marketing version | `1.0.0` in `Info.plist` | Matches `app.json` |
| Current build | `9` in `Info.plist` | Matches `app.json` |
| Deep-link scheme | `aura` | Matches `app.json` |
| Google reversed client scheme | Firebase iOS client for `com.kasat.aura` | Matches root/native Firebase plist and EAS iOS client ID |
| Sign in with Apple | `com.apple.developer.applesignin = Default` | Matches `usesAppleSignIn` |
| Deployment target | iOS `17.0` for the app target | Matches `expo-build-properties` and `Podfile.properties.json` |
| New architecture | Enabled | Matches `app.json` |
| Usage descriptions | Location, calendar, reminders, camera, photos, microphone, and speech present | Matches `app.json` |
| Firebase config | `ios/AURA/GoogleService-Info.plist`, bundle `com.kasat.aura` | Matches root Firebase plist |

Native dependency integration is present through CocoaPods for Apple Authentication, Google Sign-In, Expo Audio, Image Picker, voice, the local Vision module, and the other installed Expo/React Native packages. Sentry is initialized from JavaScript and configured through the installed Expo/native package; source-map upload still depends on optional Sentry organization/project/token configuration.

## Android Effective Configuration

- Application ID and namespace: `com.kasat.aura`.
- Display name: `AURA`.
- Version: `1.0.0` / version code `1`.
- Deep-link scheme: `aura`.
- Camera, location, calendar, media, and audio permissions are present in the committed manifest.
- `android/app/google-services.json` includes the `com.kasat.aura` Firebase client.

Android is not the target of the current iOS beta release, so its version code remains unchanged.

## Build Number Ownership

`eas.json` uses local version ownership and automatic increments for both store-distribution profiles (`preview` and `production`). The reviewed baseline is now build `9` in app config, Info.plist, and the Xcode target. EAS history inspected on 2026-10-09 already contains a finished production build `9` from 2026-09-01. The previous local baseline `8` would have reused `9` on the next production build.

The next EAS store build should therefore increment to `10`. Recheck App Store Connect and EAS history immediately before an approved build, since another release may reserve that number. No build was submitted or created in EAS by this audit.

The Podfile now raises pod targets to at least the configured iOS 17 minimum, including resource/privacy bundles which Xcode 27 rejects when they retain older targets. `pod install` synchronized the native lockfile with the already-installed Expo, Constants, and FileSystem patch versions; no JavaScript dependency versions were changed by this audit.

Do not run a destructive `expo prebuild --clean` against this repository. When app config or native plugins change, audit and reconcile the committed native files intentionally.


## Validated SDK compatibility path

Keep Expo SDK 54 and pin `macos-sequoia-15.6-xcode-26.0` in the store profiles. The authorized `beta-simulator` build `adc8a66b-74df-4174-8862-118b7684c45b` used that exact image and produced version 1.0.0 (9), without incrementing the build number. Its unchanged Release simulator artifact passed cold launch, termination/relaunch, warm launch, background/foreground, and login/reset navigation on iOS 27.0 and 26.5. **PASS for the reproduced UIScene startup blocker with this toolchain.** No AppDelegate, scene manifest, or dependency migration was needed.

The Xcode 27-built SDK 54 binary still terminates on iOS 27. EAS's image pin does not change the local Xcode selection. Do not build a release with Xcode 27 until a supported scene migration is separately completed and validated.

This simulator result is not signed-device or complete beta approval. In that pre-P1-02 artifact, cold auth deep links lose their destination on both tested OS versions and unsolicited provider callbacks route to an unmatched page. The P1-02 source fixes now pass automated Router tests and local JS export, but have not been built/launched in a new native artifact; authenticated OAuth completion remains unverified. See the P1-02 section of [release readiness](TESTFLIGHT_READINESS_2026-10-09.md) for current code/test evidence. Physical-device validation and the other release gates remain open. See [the launch investigation](IOS27_LAUNCH_INVESTIGATION_2026-10-09.md) for exact source/artifact hashes, logs, matrix, and compatibility limits. Overall external beta remains **NO-GO**.
