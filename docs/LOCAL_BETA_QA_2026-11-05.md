# Repeatable local beta QA

From the checkout, run:

```sh
node scripts/check-beta-local.cjs
```

The runner uses installed Node entry points for client/backend ESLint, TypeScript (`--noEmit`) and Jest (`--runInBand --watchman=false`). Client lint uses Expo's source directories and extensions. It does not depend on missing `.bin` links and does not install packages, launch emulators, emit backend builds, invoke cloud CLIs or distribute the app. Existing tests use their existing mocked boundaries; this runner is not a network sandbox.

All dependencies are checked before execution. Ordinary failures are collected so the final summary identifies every failed check. A signal stops remaining checks. Exit 0 means all six checks passed, 1 means a check failed/interrupted, and 2 means invalid arguments or missing installed tools. No arguments or arbitrary commands are accepted. Run the guard tests with:

```sh
node --test scripts/test-check-beta-local.cjs
```

## November 5 follow-up results

On Node 22.23.4, the complete runner exited 0:

- Client: 50 suites / **282 tests** passed, TypeScript passed, lint passed with the same nine warnings.
- Backend: 38 suites / **385 tests** passed, TypeScript and lint passed.
- Runner guard tests: **5/5 passed**, including failed-check propagation, missing dependencies, interruption, invalid arguments and installed-entry invocation without a shell.
- An actual `node scripts/check-beta-local.cjs --deploy` invocation exited 2 with usage text before any check ran. There is no deployment mode.

The photo regression from the preceding pass is included in the 282 client tests. Ordinary photo intake/background removal remain available, and optional AI polishing remains disabled. No application/backend implementation was changed by this follow-up.

## Coordination and remaining limits

The prior Codex app/session access denial remains in force. No cross-chat relay, session inspection or messaging was attempted. Active AURA work could not be coordinated through that blocked interface; this pass added only new QA/documentation files and avoided editing shared implementation files. It does not certify that another agent is idle. The QA runner executes once per invocation, not as an unattended background automation.

Fresh emulator integration is not completed: `command -v firebase` returned no path, and the previously documented Java executable at `/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java` does not exist here. No dependencies were installed, existing emulator ports/processes touched, or cached backend output used to claim fresh integration results. Locate or provision the approved local Firebase CLI and compatible Java runtime, then run the existing isolated `demo-aura-beta` harness against a fresh candidate build after coordinating local process ownership.

The [beta handoff](BETA_HANDOFF_2026-11-05.md) still governs cloud/device/disclosure gates. Cloud canary, billing relink, new spending, deployment and external distribution require their separate approvals. Local QA success does not certify real provider behavior, cloud IAM/event delivery, native hardware flows or external beta readiness.
