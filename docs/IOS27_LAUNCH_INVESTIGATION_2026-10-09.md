# iOS 27 launch investigation — 2026-10-09

## Decision and current gate

**PASS for the reproduced UIScene startup blocker with the pinned Xcode 26.0 build. Overall external beta remains NO-GO.** Retain Expo SDK 54 and `macos-sequoia-15.6-xcode-26.0`. The exact authorized Release simulator artifact launched on both iOS 27.0 and 26.5 without changing AppDelegate or adding a scene manifest. Termination/relaunch, warm launch, background/foreground and login/reset navigation passed. The full routing matrix did not pass: cold deep links lose their destination on both OS versions, and unsolicited Google callback URLs reach an unmatched route. Authenticated provider flows remain unverified.

Only Xcode 27 is installed on this macOS 27 host. Xcode 26 is not listed as supported on macOS 27 in Apple's [Xcode requirements](https://developer.apple.com/xcode/system-requirements). After explicit approval, exactly one EAS simulator build was created and tested. No second build, production build, Git push, Firebase deployment, App Store Connect/TestFlight submission, dependency migration, or production-data mutation was performed.

## Authorized build and artifact identity

Executed exactly once from the existing dirty working tree:

```sh
npx eas-cli@latest build --platform ios --profile beta-simulator --wait
```

| Evidence | Observed value |
| --- | --- |
| EAS build | [`adc8a66b-74df-4174-8862-118b7684c45b`](https://expo.dev/accounts/mirathfan/projects/aura-ai-personal-stylist/builds/adc8a66b-74df-4174-8862-118b7684c45b) — FINISHED; command exit 0 |
| Time, UTC | Created 2026-10-10 00:57:55.698; completed 01:05:27.378 (October 9 in America/Chicago) |
| CLI | eas-cli 24.12.1, resolved from `@latest` |
| Source revision | `06ece001c69cb6a84787cebddd521f883ffccb66` plus preserved tracked modifications and untracked files; not a clean-commit build |
| Source state evidence | `working-tree-before.txt`, `application-source-manifest.json`, `source-provenance.json` in the artifact directory |
| Application manifest | 743 files, SHA-256 `1af9f3960a3f2c846c6ff4ed19922c86182d1584f7514c1700372fbc39bfbdaf` |
| EAS fingerprint | `7711f75193de75cb80ce9ba86ec95c12705b7b57` |
| Resolved profile | `beta-simulator`; image `macos-sequoia-15.6-xcode-26.0`; simulator true; Release; internal distribution; autoIncrement false |
| Actual build environment | Xcode 26.0 (17A324), macOS Sequoia 15.6, Node 20.19.4; confirmed in downloaded build logs |
| App identity | `com.kasat.aura`, version 1.0.0 (9); build number unchanged |
| Artifact | [`AURA-simulator.tar.gz`](https://expo.dev/artifacts/eas/DvfuQuVAHEvNg8fnuU410Nbzn5txqSckovMopB7xB6Q.tar.gz), 41,799,029 bytes |
| Archive SHA-256 | `eb1a0600bb376b09a0c6cf5302444e1a72d73c8d96b90191407be3bd1c1cb170` |
| Executable SHA-256 | `6b333ac4877d3ff5a83917bda6e0ed5d5bc3c38fe06c783db0ecbc40bfb117b1` |
| JavaScript bundle SHA-256 | `0dbed6973ecf6b948b3f3424b1acbaeeb9a63a26871daa2d15e8f9103d7c794a` |
| Native metadata | DTXcode 2600; DTSDKName iphonesimulator26.0; DTSDKBuild 23A339; arm64 and x86_64 Mach-O slices both SDK 26.0/minimum 17.0; no scene manifest |

Before building, the latest EAS CLI resolved and validated the profile and created a local archive inspection. The 771-file inspection includes generated `.git` metadata; the 743-file application manifest excludes that metadata. A filename/content scan found no local credentials, env files, signing keys, service accounts, or recognized secret tokens. The sole private-key pattern was the literal placeholder in `website/.env.example`, manually reviewed as non-secret. Required public Firebase client configuration remains intentionally included. All application upload files still matched their recorded hashes after runtime testing, before these report updates.

Full command output, two downloaded EAS build logs, build metadata, source manifests, upload audit, extracted app, and hashes are saved in [`authorized-build`](../../qa-artifacts/ios-lifecycle-2026-10-09/authorized-build/). The exact downloaded app was installed on both fresh simulators; no binary or JavaScript modifications were made between tests. The CLI's optional automatic install prompt was declined so installation could explicitly target the two audit devices.

## Established current state

| Component | Observed value |
| --- | --- |
| Expo / React Native / React | 54.0.37 / 0.81.5 / 19.1.0 |
| Native ownership | Tracked, hand-maintained `ios/`; EAS archive includes its AppDelegate, project, plist and Podfile |
| Architecture / runtime | New Architecture enabled, Hermes |
| Deployment target | iOS 17.0 |
| Native entry point | `ExpoAppDelegate`; creates UIWindow and starts React Native in `didFinishLaunchingWithOptions` |
| Scene support | No scene manifest; installed Expo 54 delegate has no supported scene runtime |
| URL handling | AppDelegate forwards URL and user-activity events through Expo and RCTLinkingManager; `aura` and Google reversed-client schemes registered |
| Local toolchain | Xcode 27.0, build 27A266a; macOS 27.0, build 26A428 |
| Installed test runtimes | iOS 26.5 (23F77) and iOS 27.0 (24A434), plus 26.2/26.4 |
| Prior EAS configuration | No image pin; EAS selects its `auto` image, independently of the local Xcode selection |

Read-only EAS build logs establish:

| Build | ID | Toolchain |
| --- | --- | --- |
| Production 9, finished 2026-09-01 | `f99e432e-1d39-464b-b73d-7aef91cc212b` | `macos-sequoia-15.6-xcode-26.0`; Xcode 26.0 (17A324); Node 20.19.4 |
| Production 8, finished 2026-08-17 | `ac49432c-a19d-4737-a1bc-0309c075f8b9` | Same image, Xcode and Node |

Both are device/store artifacts, not simulator artifacts. Their successful builds establish toolchain history, not successful launch on iOS 27.

## Root cause and candidate configuration

The existing unsigned Release simulator binary has `LC_BUILD_VERSION sdk 27.0`, `DTXcode=2700`, `DTXcodeBuild=27A266a`, and no scene manifest. Relaunch on iOS 27 again produced the UIKit error: “Application failed to launch: UIScene life cycle is required for apps built with this SDK.” `simctl launch` returning a PID is not evidence that the app survives startup.

Apple's [scene lifecycle documentation](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle) ties this requirement to apps built with the new SDK. That makes a real Xcode 26 build a reasonable experiment, but does not prove this app's compatibility. The same Xcode 27 binary previously reached AURA's welcome, login and reset form on iOS 26.5.

Changed `eas.json`:

- Pin both store profiles, `preview` and `production`, to `macos-sequoia-15.6-xcode-26.0`.
- Add `beta-simulator`, inheriting production environment/settings, with `ios.simulator: true`, `ios.buildConfiguration: Release`, internal distribution, and `autoIncrement: false`.
- Preserve build-number ownership, credentials settings, Firebase environment, and existing agent flag. No AppDelegate/plist workaround, binary metadata manipulation, or dependency migration.

Expo still lists this exact image as its [SDK 54 image](https://docs.expo.dev/build-reference/infrastructure/#ios-server-images). An exact image avoids drift from `auto`/`latest`. Apple's [current upload requirements](https://developer.apple.com/news/upcoming-requirements/) permit Xcode 26 and iOS 26 SDK builds as of this investigation. These requirements and image availability must be rechecked before release. The EAS image setting does not change local Xcode, including for EAS local builds.

## Controlled fallback, only if Xcode 26 fails validation

Prefer **SDK 57.0.23 or a later stable 57 patch** with supported scene opt-in before SDK 58 beta. Expo's [scene migration guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md) documents the backport and `expo-build-properties` `ios.enableSceneSupport`. In a hand-maintained project, changing app.json alone is insufficient. Generate a scratch reference and reconcile the supported factory-provider startup and `EXExpoAppSceneDelegate` manifest with the committed native project. Preserve URL forwarding, Firebase configuration, entitlements, and local native modules. Never run destructive prebuild in this working tree.

This is a broad upgrade from 54, even though 56 → 57 is described as small. The published `expo@57.0.23` native-module map differs for 37 current dependencies: React Native becomes 0.86.3, React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1, Skia 2.6.2, Router ~57.0.21, and Sentry ~7.11.0. Google Sign-In, voice, MMKV/Nitro, FastImage, the bg-removal patch and local ExpoVisionBg also need compatibility testing. See the captured dependency-impact JSON.

[SDK 58 beta](https://expo.dev/changelog/sdk-58-beta) uses scene lifecycle by default and adds further framework/platform changes. It offers no demonstrated advantage for this beta blocker over a validated SDK 54 pin or stable SDK 57 opt-in. No upgrade was performed; inability to obtain an approved Xcode 26 build is not evidence that the Xcode 26 path failed.

## Checks completed

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | PASS: 33 suites, 143 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 errors, 9 existing warnings |
| `npx expo install --check` | PASS: dependencies up to date for current SDK |
| `eas config --platform ios --profile beta-simulator --json --non-interactive` | PASS: exact Xcode image, Release simulator, internal distribution, no auto-increment |
| `eas build:inspect --platform ios --profile beta-simulator --stage archive --output /tmp/aura-lifecycle-archive` | PASS: native project retained; no credentials.json, .env/.env.local, p12 or mobileprovision files in archive |
| `git diff --check` | PASS |
| Preservation hashes | package.json/lockfile, AppDelegate, native plist and both Firebase plists unchanged during this investigation |
| Existing Xcode 27 binary on iOS 27 | FAIL, reproduced missing-UIScene termination |
| Authorized Xcode 26 Release simulator build | PASS; exactly one build, exact artifact verified and tested on both runtimes |
| Fresh follow-up JS checks | PASS: 143 tests / 33 suites, typecheck, lint (9 existing warnings) |

The earlier investigation encountered Maestro connection errors. Fresh dedicated simulators resolved that limitation for this authorized run. Actual UI hierarchies, screenshots, process IDs, and app logs now substantiate the results below. Initial deep-link automation needed an explicit conditional tap on the system “Open in AURA?” dialog; failures after that correction are distinguished from the initial harness failure.

## Observed runtime matrix

Both fresh simulators used iPhone 17 Pro hardware profiles. iOS 27.0 (24A434): `D7021D48-0F04-4EF2-BD2A-0E83B77346BA`. iOS 26.5 (23F77): `B39B1E41-7C02-4B5D-AAF3-3F5CF72E451F`. Both were shut down after testing; no pre-existing personal simulator was erased.

| Scenario | iOS 26.5 candidate | iOS 27 candidate | Acceptance |
| --- | --- | --- | --- |
| Fresh install and cold launch | PASS | PASS | Welcome renders; process survives; no missing-UIScene failure |
| Terminate and relaunch | PASS | PASS | New process renders welcome and navigates to login |
| Warm launch | PASS | PASS | Existing process stays responsive |
| Background / foreground | PASS | PASS | `lifecycle-check` input preserved; same PID before/after (53120 on 26.5, 50598 on 27) |
| Cold incoming password-reset link | FAIL | FAIL | Opens welcome instead of requested reset form; grouped URL on both, canonical URL additionally reproduced on 27 |
| Warm incoming auth links | PASS | PASS | Login and reset routes render after system confirmation |
| Login and password-reset navigation | PASS | PASS | Login fields and reset form usable; no credentials or reset email submitted |
| Google auth presentation/cancellation | PASS, limited | PASS, limited | Native permission prompt appears; Cancel clears pending state and returns to usable login |
| Apple auth presentation/error return | PASS, limited | PASS, limited | Native no-Apple-Account prompt appears; Close produces dismissible AURA error alert and returns to login |
| Synthetic Google callback with no active session | Unmatched Route | Unmatched Route | Registered callback scheme opens AURA, but `/oauthredirect` enters Expo Router fallback |
| Authenticated Google/Apple completion and restored sessions | UNVERIFIED | UNVERIFIED | No real credentials, authorization codes, tokens, or accounts used |

Fresh launch/relaunch was verified through both UI rendering and running process state, rather than treating `simctl launch` returning a PID as sufficient. Captured AURA logs contain no `Application failed to launch`, `Unhandled JS Exception`, or uncaught-exception termination markers. Native compilation succeeded with dependency warnings; this is not a signed-device archive/provisioning check.

### Routing findings and smallest next work

Cold reset reproduction: terminate AURA, open `aura:///(auth)/forgot-password`, accept the system Open dialog when present, and observe welcome. The same destination works when the app is already running. `aura://forgot-password` also reproduced cold failure on iOS 27 and warm success on iOS 26.5. Investigate preservation of the initial URL across auth initialization and the conditional root navigator in `app/_layout.tsx`; this is a hypothesis for the source-level cause, not a proven root cause. No routing patch was made to the tested artifact.

After cancelling Google sign-in, a synthetic URL using the configured Google reversed-client scheme with `/oauthredirect?error=access_denied&state=aura-lifecycle-test` opened “Unmatched Route” on both OS versions. There was no active authorization session and no token exchange. This tests out-of-session routing only; it does not establish that a real active OAuth callback fails. On iOS 26.5, Go back restored login and a subsequent warm reset link worked. Harden unmatched provider-callback handling and separately validate real provider completion with approved dedicated test identities.

These are narrower application-routing follow-ups; they do not justify a framework migration to fix startup. The supported SDK 57 fallback remains documented above for a future SDK 27 build requirement, but was neither needed nor attempted in this run. Full release approval still requires these routing checks, physical-device validation, and the other privacy/deletion/reliability gates.

Synthetic callback URLs and OAuth cancellation cannot establish successful token exchange, nonce/state verification, or Firebase sign-in. Full OAuth callbacks and restored authenticated sessions require dedicated approved test accounts on physical iPhones; current code can create/update production records after authentication. Do not sign in using personal or production accounts to fill this gap without approval. A simulator-only pass also does not validate signed provisioning or the final device binary.

## Evidence and scope

Artifacts: [`qa-artifacts/ios-lifecycle-2026-10-09`](../../qa-artifacts/ios-lifecycle-2026-10-09/), including filtered previous build toolchains, resolved simulator profile, JS check logs, SDK 57 dependency comparison, fresh UIKit failure log and screenshot. Original build/runtime evidence remains linked from `TESTFLIGHT_READINESS_2026-10-09.md`.

The configuration pin was prepared in the preceding investigation. This authorized run changed only this report and related release-documentation status, and wrote evidence outside the repository. Existing audit changes, package edits, website work, `.maestro/smoke.yaml`, cards, flatlays, Firebase configuration and screens were preserved. The wider privacy, deletion and indexing blockers remain independent of the now-validated launch workaround. Overall external beta remains **NO-GO**.


## P1-02 source follow-up — native result unchanged

The [release-readiness P1-02 section](TESTFLIGHT_READINESS_2026-10-09.md#p1-02--authentication-and-deep-link-reliability-follow-up) records local fixes for initial-URL recovery, AuthGate pending-route preservation, reset-action validation, and safe unsolicited Google callback routing. The full client suite now passes 40 suites / 217 tests, including real Expo Router integration with mocked native/provider boundaries; TypeScript, lint, and a local iOS JS/Hermes export pass.

**These changes are not in the EAS artifact tested above.** No additional EAS build or native runtime validation was performed. Preserve the historical cold-link and synthetic-callback failures as the pre-fix baseline. P1-02 implementation/automated checks PASS; native release sign-off remains pending. Expo SDK 54 and the Xcode 26.0 pin remain unchanged, and external beta remains **NO-GO**.
