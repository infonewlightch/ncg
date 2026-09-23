# Limited accessibility review — 2026-09-24 KST

Scope: the Bible reader and signed-out profile in the local production build of `a7e913e`, using the actual in-app Chromium browser. This is a focused keyboard/semantics/contrast check, **not a complete WCAG conformance audit or assistive-technology certification**. No account, email, post or message was created.

## Verified

- Enter opens the Bible passage dialog; its visible name is “Find a passage”. Focus enters the Close button. Shift+Tab remains within the native dialog. Escape closes it and returns focus to the original “Find a passage” button.
- The skip link moves focus to the `main` element without changing the application route.
- Email, display name, nationality, reminder time and time-zone inputs expose names. No visible unnamed button was found on the two inspected screens.
- Tab from the email field reaches the next enabled profile input when sign-in submission is disabled. The focused input has a 3px visible outline. Sign-in readiness errors appear in an alert; unavailable actions remain disabled. Actual authentication was not exercised by this review.
- Scripture language/direction and named navigation landmarks are present. The document language was `en` in the English interface. Current main-navigation links use `aria-current="page"` in source.
- Desktop content width matched the viewport at 1280px. The separate page-recovery check earlier in this session verified a Spanish failure dialog at 390px. A new 320px override attempt did not affect the inspected tab, so no 320px claim is made.

## Measured color pairs

Values were read from the rendered Bible DOM and corresponding background tokens. Ratios use WCAG relative luminance. This samples the listed states only; it is not a scan of every component or theme.

| Element | Foreground / background | Contrast |
|---|---|---|
| Scripture body | `#203249` / `#ffffff` | 13.01:1 |
| Reader secondary text | `#5c6d81` / `#ffffff` | 5.30:1 |
| Small section label | `#936925` / `#fafbfc` | 4.73:1 |
| Selected book/chapter | `#ffffff` / `#123564` | 12.22:1 |
| Navigator focus outline on white | `#b4873e` / `#ffffff` | 3.24:1 |
| Navigator focus outline on selection | `#b4873e` / `#123564` | 3.77:1 |

No blocking defect was found in this limited sample, and no product code changed as a result. References: [W3C keyboard guidance](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html), [W3C minimum text contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).

## Still required

- Actual VoiceOver/NVDA announcements, including asynchronous page changes and long Bible navigation lists.
- 200% text zoom, 320px reflow, full keyboard journeys on real mobile/desktop devices, touch-target and focus-obscuration review.
- All supported languages and themes; authenticated chat, moderation and administrator workflows.
- A complete automated accessibility scan plus manual review. These checks do not establish complete WCAG 2.1 AA compliance.
