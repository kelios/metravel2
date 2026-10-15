## Context

See proposal.md. The architecture decision is frozen in the parent release workspace. Four versioned patches contain required web/Android mechanisms. Checked iOS configuration includes intentional Google modular headers and Facebook privacy overrides.

## Goals / Non-Goals

Goals: supported SDK 57 family, reproducible install, patch preservation, native parity and current release identity. Non-goals: auth-flow changes, SDK/Xcode major migration, private-input/runtime operations, Android store release and renderer replacement.

## Decisions

Align installed packages to Expo 57.0.30 bundledNativeModules.json and RN 0.86.3, letting RN select Hermes 250829098.0.17 transitively. A direct Hermes override or experimental worklets bundle mode would leave unsupported parity. Remove install exclusions for React/DOM/RN so drift is visible. Rebase each complete patch against pristine updated packages, regenerate versioned patches and test mechanisms. Keep unchanged render-html/toast/tr46 patches.

Remove schema-invalid newArchEnabled from app.json and enforce installed SDK/RN plus Podfile.properties and compiled plist architecture instead. Preserve native true and Facebook iOS flags. Refresh Pods without clean prebuild, preserving checked native customizations. Keep Xcode 26.6 cloud image and iOS 16.4 deployment target.

## Risks / Trade-offs

Patch drift → inspect full diff and run direct serializer/native patch tests plus clean install. Dependency types → typecheck/full lint/unit checks. New native binary → exact IPA and TestFlight acceptance required; old evidence remains historical. Render-html directory maintenance warning → retain warning and require article runtime check; no suppression.

## Migration Plan

Implement only in isolated main clone, independently review and transfer owned paths to shared main, commit/push and freeze source. Then testing owns web smoke, local Android patch regression, iPhone/iPad memory/navigation/article/auth and exact TestFlight checks. Runtime and external stages remain unchecked in tasks until actual evidence exists. Rollback only owned changes; never ship affected build 13.
