## 1. Correct source family

- [x] 1.1 Align supported SDK 57 dependencies/lock and remove hidden React/RN install exclusions.
- [x] 1.2 Rebase four complete patches and verify frozen install application.
- [x] 1.3 Synchronize build 14 and enforce SDK/native New Architecture and Hermes parity.
- [x] 1.4 Refresh native Pods while preserving privacy/signing customizations.

## 2. Source verification

- [x] 2.1 Add regression rejection tests and run targeted config/native/serializer tests.
- [x] 2.2 Close the full-unit baseline: initial1799suites had1797pass and two failures; the missing ignored font fixture was restored and70/70 cases passed, then current main fixed the direct CLI calls through the canonical helper. The final combined SDK14 main gate passed4suites/200tests including CLI policy and the latest auth/helper sources. Install/check, typecheck, lint, Swift static checks, prompt audit and strict validation passed; Doctor1.21.4 retains only the renderer-maintenance warning.
- [ ] 2.3 Independent complete-diff review and code review gate.

## 3. Testing and operator handoff

- [ ] 3.1 Verify production web lazy chunks/article desktop and mobile.
- [ ] 3.2 Verify local Android launch/image blur/system bars after patch rebase.
- [ ] 3.3 Verify iPhone/iPad exact candidate memory/navigation/images/article/auth and locales.
- [ ] 3.4 Audit signed build 14 IPA, processed TestFlight and required release acceptance before submission.
