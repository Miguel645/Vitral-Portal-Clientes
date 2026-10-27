# Vitral Clients Portal

Web app for Vitral, a fashion accessories shop. It manages client records and will use them to send promotions and manage discount codes.

## About the owner

Miguel is the only user for now. He works as a systems/support engineer and is building this on the side. Reply in English, in simple, plain language, and explain steps clearly. Ask before big changes.

## Stack

- Next.js 15 (App Router, TypeScript), server actions for data changes
- Supabase: Postgres database and email/password login (row level security on)
- Hosting: Vercel, code on GitHub (`Miguel645/Vitral-Portal-Clientes`)
- Secrets stay in `.env.local` (never commit it). Only the public URL and anon key are used in the app. Never use a service_role key in client-side code.

## Decisions made

- One user for now (the owner). No roles or staff accounts yet.
- Client record: name (required), phone (required), email (optional), birth date (optional), promotions consent (tick box).
- Messages: SMS to every client who agreed to promotions; email too, only when the client has an email. Each campaign can also be "SMS only" or "email only".
- Consent matters (EU/Portugal): never message a client without the consent flag, and every message needs an easy way to opt out.
- Planned SMS provider: Twilio. Planned email provider: Resend. Sending must happen on the server, never in the browser.
- Online from day 1.
- Login is on. The login form asks for a username (not an email) and a password; `src/lib/auth.ts` maps the username to an internal email (`<username>@example.com`, domain kept in one constant) and signs in via Supabase `signInWithPassword`. Username must be 3-30 characters: letters, digits, dot, underscore, or hyphen. Any failure (bad format or wrong credentials) shows one generic message, on purpose, so it never reveals which part was wrong. There's no sign-up page, and public sign-ups must stay disabled in Supabase (Authentication settings) — the only way to create an account is directly in the Supabase dashboard. All database policies require `authenticated` only (no more anonymous access).
- All site text is in Portuguese (European).
- Discount codes (replaces the earlier generic percentage/fixed idea): every code is 8 random uppercase characters, excluding confusing characters (0, O, 1, I). Two kinds: `birthday` and `spend`. A code can be checked or marked as used on `/codes`; there is no manual code creation.
- Birthday codes: one per client per calendar year, for clients with `consent = true`, using the percentage and validity-in-days set on `/settings/birthday`. A client born on 29 Feb counts as 28 Feb in non-leap years. Created automatically once a day by the `/api/cron/birthdays` Vercel Cron job (see `vercel.json`), and can also be run on demand from the settings page. "Today" is always calculated in the Europe/Lisbon timezone.
- Spend promotions (`promotions` table): each has an earn window (date range), a minimum spend per purchase, a reward percentage, and a separate reward validity window. Adding a purchase on a client's page checks every active promotion; if the purchase date falls in the earn window and the amount meets the minimum, one reward code is created (never more than one per purchase+promotion pair).
- The birthday cron and the "run now" button use a server-only Supabase client with the `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), since they run without a signed-in session. That key must never have a `NEXT_PUBLIC_` prefix and must never be imported into a client component.
- Campaigns step 1 (SMS, simulation/test only — no "send to all" yet): `src/lib/sms.ts` has one function, `sendSms(to, text)`, server-only. It normalizes the phone number, then either logs the message to `sms_log` as `simulated` (default, nothing is actually sent) or sends it through Twilio when `SMS_MODE=twilio`, logging `sent`/`failed`. Phone numbers: a 9-digit Portuguese number starting with 9 becomes `+351...`; numbers already starting with `+` are kept; anything else is rejected. `{{name}}` in a message template is replaced with the client's first name; every message gets an unsubscribe-link footer appended (`src/lib/smsText.ts`). Every client has an `unsubscribe_token`; the public page `/u/[token]` (allowed without login) sets `consent = false` using the service-role admin client and shows a Portuguese confirmation. `/campaigns/new` has the message composer (live character/SMS-part counter, warns when accents force the more expensive 70-char encoding), recipient count, a preview, and a "send test SMS" button to one phone number only. `/campaigns/log` shows the last 50 `sms_log` rows.

## Plan

1. Client records (done: login, list, search, add, edit, delete)
2. Discount codes (done: birthday codes, spend-promotion reward codes, code list/check/mark-used)
3. Campaigns (in progress): step 1 done — compose a message, test-send to one number, simulate/real SMS sending, opt-out link, send log. Still to do: a "send to all consenting clients" action, and email sending.

## Where things are

- `src/app/` pages and server actions
- `src/app/_components/TopNav.tsx` shared header navigation (Clients, Codes, Promotions, Campaigns, Settings)
- `src/app/u/[token]/` public unsubscribe page (no login required)
- `src/lib/supabase/server.ts` Supabase client for the server (uses the anon key, respects RLS)
- `src/lib/supabase/admin.ts` server-only Supabase client using the service role key (bypasses RLS) — used by the birthday cron/settings "run now" action and the public unsubscribe page
- `src/lib/birthdayCodes.ts` shared birthday-code logic used by the cron route and the settings page
- `src/lib/codes.ts` random code generator (discount codes)
- `src/lib/date.ts` date helpers, including "today in Europe/Lisbon"
- `src/lib/auth.ts` username validation pattern and the username-to-email mapping used for login
- `src/lib/phone.ts` phone number normalization to international format
- `src/lib/smsText.ts` SMS character/part counting (GSM-7 vs UCS-2), `{{name}}` templating, unsubscribe footer — pure, safe to import client-side for the live counter
- `src/lib/sms.ts` the one `sendSms(to, text)` function — server-only, never import from a client component
- `src/middleware.ts` redirects signed-out visitors to `/login`; `/login` and `/u/*` are the only routes allowed without a session
- `supabase/schema.sql` database setup. Add new tables and policies here, and tell Miguel to run them in the Supabase SQL Editor.

## Working rules

- Commit and push to GitHub after each finished change, with a clear message.
- Tell Miguel what changed in one or two plain sentences.
- Run `npm run build` before pushing to catch errors.
