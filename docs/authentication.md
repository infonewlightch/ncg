# Authentication readiness and recovery

NCG uses the NCG-only Supabase project and PKCE redirects. Google and passwordless email are implemented in the client, but an enabled UI is not evidence that OAuth credentials or email delivery have been configured.

## Current operational state

- Public Auth settings: email enabled, email confirmation required, registrations enabled, Google disabled (checked 2026-09-24 KST).
- The client checks `/auth/v1/settings` using the browser publishable key, no cookies, no cache and an eight-second timeout. Disabled methods cannot be clicked; a failed check presents a retry. Enabling Google at Supabase later is reflected after loading the sign-in page again.
- The email form distinguishes sign-in (`shouldCreateUser: false`) from registration (`true`). It locks duplicate actions, fixes the address used for code verification to the address submitted, and waits at least 60 seconds before resending. No live email has been sent during automated testing.
- Production return routes were configured earlier: `/auth/callback` for members and `/admin.html` for operators. No public navigation exposes the admin page; authorization still requires the server-side administrator role.
- Netlify now checks the four required connection settings before building, requires the NCG project and official HTTPS origin, rejects privileged browser keys, and verifies the public Auth settings with an eight-second timeout. A failed check stops the new deployment rather than publishing a client without authentication. Local `npm run build` remains available without hosted credentials.

## Callback recovery

The installed SDK's `getSession()` does not surface errors returned by initialization. `AuthProvider` awaits `auth.initialize()` and checks its result before cleaning up the callback URL. It retains existing sessions on failed links, and detects an unconsumed code when a browser has no matching PKCE verifier. Users see controlled messages for expired links, cancellation, browser mismatch or unavailable authentication; raw provider descriptions and tokens are never rendered.

Callback destinations are fixed same-origin routes. `next` and arbitrary redirect parameters are ignored. Auth parameters are removed with `history.replaceState` after processing. A later auth event cannot overwrite a newer session with the initial read.

References used to check behavior against the installed SDK:

- [Supabase initialize](https://supabase.com/docs/reference/javascript/auth-initialize)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)

## Validation and remaining work

- Unit coverage includes public settings schema, disabled providers, failed-check retry, closed registration, duplicate email actions/cooldown, expiry/cancellation, nested SDK errors, fixed destinations, unconsumed codes and ordinary non-callback routes.
- Local actual-browser checks: server-derived Google disabled / email enabled; synthetic expired-link and missing-verifier returns show the correct Korean notice and clean the URL to `/#/profile`.
- Actual Google authorization, email delivery, verification code sign-in, two-account/two-device integration and administrator assignment remain unverified. Google OAuth and an operational SMTP provider still require owner configuration; do not mark these complete based on the public settings response alone.
