# LifeOps

LifeOps is a Vite + React workspace for tasks, habits, goals, and personal context. It uses Supabase Auth and a Supabase database for the authenticated workspace while retaining limited browser-local preferences and legacy compatibility data.

## Current architecture

- `src/main.jsx` contains the React UI, Supabase Auth session flow, and domain CRUD.
- `src/styles.css` contains the responsive design system; there are no runtime UI dependencies.
- Supabase Auth manages authentication, including signup/signin, password reset, signout, and session restoration. Account, password, and session credentials are not stored as plaintext localStorage data.
- Supabase stores RLS-protected user-owned tasks, habits, habit completions, goals, and profiles. Active task, habit, goal, and profile data is not sourced from localStorage.
- Browser `localStorage` is limited to onboarding completion, theme preference, and legacy/local compatibility data where the current transition architecture still needs it.
- Supabase project configuration is provided through `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never expose or use a service-role key in the frontend.
- Premium is shown as a placeholder. Nothing is unlocked and no purchase is implied.

Run locally:

```bash
npm install
npm run dev
```

## Closed-test web build

Create and verify the production bundle with:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

The production bundle includes a web app manifest, install icon, service worker, and an offline app shell. The app can retain limited local preferences and shell assets, but synced workspace operations require the configured Supabase services.

### Tester smoke test

1. Complete onboarding, create a Supabase account, and sign in.
2. Create, edit, complete, and delete a task.
3. Create a habit and mark it complete; confirm the streak updates.
4. Create a goal and change its progress.
5. Toggle bright mode, reload, and confirm the preference persists.
6. Sign out, sign back in, and verify the workspace remains.
7. Use Profile to inspect the storage disclosure, clear local browser data, and sign out.

This repository still does not contain an Android project or signed `.aab`. Google Play closed testing requires a native Android/Capacitor wrapper, a unique application ID, Play App Signing, a privacy policy URL, and a completed Data safety form; the PWA build is the verified web test surface until those platform assets are added.

## Production blockers and configuration still needed

This repository does not include an Android project, and the current Supabase-backed app still needs production hardening before shipping:

1. **Android/AAB:** create a Capacitor or native Android project, configure the application ID, app icons/splash, deep links, offline storage strategy, release build variants, and CI for a signed `.aab`.
2. **Supabase operations:** configure the production Supabase project, verify Auth email/password-reset settings and RLS policies, apply migrations through the normal release process, establish backups, conflict handling, monitoring, and an explicit protected data export/delete path.
3. **RevenueCat:** create the RevenueCat project and platform products, add Android/iOS public SDK keys through environment configuration, map entitlements, restore purchases, and verify entitlements server-side. Keep the current Free state until that integration is live.
4. **Signing:** create a protected Android keystore, configure Play App Signing/upload keys and CI secrets, and never commit signing material.
5. **Privacy policy/legal:** publish a real privacy policy, terms, data-retention/deletion details, support contact, and consent/cookie disclosures appropriate to the jurisdictions and analytics/payment providers used.
6. **Hardening:** add automated tests, error reporting, accessibility/device QA, operational monitoring, and a documented migration plan for remaining legacy browser data.
