# Vitral Clients Portal

Web app for Vitral, a fashion accessories shop. It manages client records and creates/manages discount vouchers ("vales"). The app does not track purchases — staff decide at the till when a client qualifies for a vale.

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
- Vales (discount vouchers, called "código"/`discount_codes` in the database for historical reasons): every vale is 8 random uppercase characters, excluding confusing characters (0, O, 1, I). Two kinds: `birthday` and `promotion`. A vale can be checked or marked as used on `/codes` (nav label "Vales") or at `/balcao/verificar`.
- Birthday vales: one per client per calendar year, for clients with `consent = true`, using the percentage and validity-in-days set on `/settings/birthday`. A client born on 29 Feb counts as 28 Feb in non-leap years. Created automatically once a day by the `/api/cron/birthdays` Vercel Cron job (see `vercel.json`), and can also be run on demand from the settings page. "Today" is always calculated in the Europe/Lisbon timezone.
- Promoções de vales (`promotions` table): simple templates, not enforced workflows. Fields: name, an optional free-text `condition` shown to staff only (e.g. "Compras de 100 € ou mais entre 01/12 e 24/12" — purely descriptive, the app does not check it), a discount percentage, a reward validity window (`reward_valid_from`/`reward_valid_to`), and `active` (used as a pause flag: paused promotions can't create new vales, but vales already created keep working regardless). There is no purchase tracking and no earn window/minimum spend — staff judge eligibility themselves at the till.
- Creating vales: from a promotion, "Criar vale" (`/promotions/[id]/criar-vale`) creates one vale with an optional client (searchable by name/phone). "Criar vários vales" (`/promotions/[id]/criar-varios`) bulk-creates 1-500 vales with no client, shown as a list and downloadable as CSV (`/api/vales/csv`) — the bulk page re-queries `discount_codes` by `promotion_id` + `created_at >= since` rather than storing a batch id, since this is a single-user tool with no concurrent writes.
- `/balcao` (first nav item) is the till-facing page: two huge buttons, "Criar vale" (pick a running promotion, then the same `criar-vale` flow) and "Verificar vale" (`/balcao/verificar` — type a code, get a big green "Válido" or red "Não válido" result with a reason, and a "Marcar como usado" button when valid).
- The birthday cron and the "run now" button use a server-only Supabase client with the `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), since they run without a signed-in session. That key must never have a `NEXT_PUBLIC_` prefix and must never be imported into a client component.
- Campaigns step 1 (SMS, simulation/test only — no "send to all" yet): `src/lib/sms.ts` has one function, `sendSms(to, text)`, server-only. It normalizes the phone number, then either logs the message to `sms_log` as `simulated` (default, nothing is actually sent) or sends it through Twilio when `SMS_MODE=twilio`, logging `sent`/`failed`. Phone numbers: a 9-digit Portuguese number starting with 9 becomes `+351...`; numbers already starting with `+` are kept; anything else is rejected. `{{name}}` in a message template is replaced with the client's first name; every message gets an unsubscribe-link footer appended (`src/lib/smsText.ts`). Every client has an `unsubscribe_token`; the public page `/u/[token]` (allowed without login) sets `consent = false` using the service-role admin client and shows a Portuguese confirmation. `/campaigns/new` has the message composer (live character/SMS-part counter, warns when accents force the more expensive 70-char encoding), recipient count, a preview, and a "send test SMS" button to one phone number only. `/campaigns/log` shows the last 50 `sms_log` rows.
- Deleting a discount code (`/codes`) or a promotion (`/promotions`, list row or edit page) always goes through a dedicated confirmation page (`/codes/[id]/delete`, `/promotions/[id]/delete`) — never a browser pop-up. The promotion confirmation also shows how many codes it created and makes clear those codes are kept and stay valid (deleting a promotion sets `discount_codes.promotion_id` to null via the existing `on delete set null`; the codes themselves are never touched). Client deletion still uses the older plain-button flow (no confirmation page) — this is a known inconsistency, not yet brought in line with codes/promotions.
- Wording: discount codes are always called "vale"/"vales" in the UI (singular/plural), never "código" (that word is reserved for the login username's technical sense). Use the same everyday Portuguese word for the same thing on every screen — "Aceitou promoções" / "Não aceitou promoções" (not "consentimento"), vale statuses "Ativo" / "Por começar" / "Expirado" / "Já usado", promotion statuses "A decorrer" / "Ainda não começou" / "Terminou" / "Pausada". Dates are always dd/mm/aaaa (`formatDate` in `src/lib/date.ts`). Every field has a hint with a concrete example, not just a description of the format.

## Interface rules (apply to every screen, not just where first introduced)

- Base text size is 19-20px, set via `:root { font-size: 20px }` (19px on phones) so every other size — defined in `rem` in `globals.css` — scales with it and still respects browser zoom. Form labels are at least 1rem and use `var(--ink)` (dark, not `var(--muted)`) for contrast; hints under fields are at least 0.95rem.
- Every button and form control has `min-height: 48px` and generous spacing (`.actions`, `.bar`, `.topnav`, `label` margins) — easy to tap on a phone, not just a mouse.
- One clear primary button per screen (`.btn.primary`); everything else is a quieter plain `.btn`. A destructive "Eliminar" button never sits in the same row as "Guardar" — it lives in its own `.danger-zone` block (visually separated, below the main actions) or, for codes/promotions, is reached only via the confirmation page described above.
- Status is never colour-only: every `.tag` always contains a word ("Ativo", "Expirado", "Já usado", etc.), colour is just reinforcement.
- Main navigation (`TopNav.tsx`) renders as a row of big labelled buttons (`.navbtn`, 48px tall) that wraps on phones; the current page is bold **and** underlined, not just coloured differently (`aria-current="page"` too).
- After every save/delete, redirect back with a `message` query param and show it as `<p className="notice">` at the top of the destination page (e.g. "Cliente guardado.", "Código eliminado."). Error messages state what to do next, not just that something failed (e.g. "Verifique e tente novamente.").
- Keep forms single-column, one screen's worth of related fields at a time; keep rarely-used things (like `/settings/birthday`) off the main flow, reachable from the nav but not front-and-centre.

## Plan

1. Client records (done: login, list, search, add, edit, delete)
2. Vales (done): birthday vales, promotion-based vale creation (single or bulk/CSV), vale list/check/mark-used, a dedicated till page (`/balcao`). No purchase tracking — staff decide eligibility themselves.
3. Campaigns (in progress): step 1 done — compose a message, test-send to one number, simulate/real SMS sending, opt-out link, send log. Still to do: a "send to all consenting clients" action, and email sending.

## Where things are

- `src/app/` pages and server actions
- `src/app/_components/TopNav.tsx` shared header navigation (Balcão, Clientes, Vales, Promoções, Campanhas, Definições)
- `src/app/_components/CopyButton.tsx` small client component, copies a vale code to the clipboard
- `src/app/balcao/` till-facing pages: `page.tsx` (two big buttons), `criar-vale/` (pick a running promotion), `verificar/` (check/mark a vale used), `actions.ts`
- `src/app/promotions/status.ts` promotion lifecycle status (A decorrer/Ainda não começou/Terminou/Pausada)
- `src/app/promotions/valeActions.ts` `criarVale` (single, optional client) and `criarVariosVales` (bulk) — separate from `actions.ts` (promotion CRUD)
- `src/app/api/vales/csv/route.ts` CSV download for a bulk vale batch
- `src/app/u/[token]/` public unsubscribe page (no login required)
- `src/lib/supabase/server.ts` Supabase client for the server (uses the anon key, respects RLS)
- `src/lib/supabase/admin.ts` server-only Supabase client using the service role key (bypasses RLS) — used by the birthday cron/settings "run now" action and the public unsubscribe page
- `src/lib/birthdayCodes.ts` shared birthday-code logic used by the cron route and the settings page
- `src/lib/codes.ts` random code generator (vales)
- `src/lib/date.ts` date helpers: "today in Europe/Lisbon", dd/mm/aaaa formatting, datetime formatting
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
