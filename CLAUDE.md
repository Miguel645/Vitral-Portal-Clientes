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
- Vales (see the wording note below for the UI-vs-database naming split): every vale is 8 random uppercase characters, excluding confusing characters (0, O, 1, I). Each vale is either a percentage (`percent`, 1-100) or a fixed euro amount (`amount_eur`, > 0) — never both (database check), shown via `formatDiscount` in `src/lib/discount.ts` ("10%" / "5,00 €"). Optional `note` (staff-only description, e.g. "Saldos de Natal"). Two kinds: `birthday` (automatic) and `manual` (UI label "Manual"). A vale can be checked or marked as used on `/codes` (nav label "Vales") or at `/balcao/verificar`.
- Birthday vales: one per client per calendar year, for clients with `consent = true`, using the percentage and validity-in-days set on `/settings/birthday`. A client born on 29 Feb counts as 28 Feb in non-leap years. Created automatically once a day by the `/api/cron/birthdays` Vercel Cron job (see `vercel.json`), and can also be run on demand from the settings page. "Today" is always calculated in the Europe/Lisbon timezone.
- No promotions (removed on purpose — the owner found them pointless). Creating vales is independent: `/codes/new` ("Criar vales") picks percentage or euro amount, validity dates (from/to, default today to today+30), an optional note, who gets them (a search box with a dropdown that filters as you type — picking a client adds them to the list, clears the search and closes the dropdown; or "Todos os clientes"), and how many vales per client (1-10 — the same client can get e.g. two 10% vales). Every vale belongs to a client (no client-less batches). Optionally sends each client one SMS with their code(s) via `sendSms` — only to clients with `consent = true`; the others still get the vale on their record. SMS template placeholders: `{{name}}`, `{{codigo}}` (required; several codes joined with commas), `{{desconto}}`, `{{validade}}`. The default message switches between singular ("Tem um vale…") and plural ("Tem 2 vales…") with the vales-per-client number, unless edited by hand; it avoids accents like á/ó ("Ola", "Codigo", "Valido") so it fits in one 160-character SMS. No hint under the vale SMS text box (owner asked). Vale SMS do NOT get the unsubscribe link (owner decision, 2026-10-28); campaign SMS still do. Action: `createVales` in `src/app/codes/actions.ts`; form: `src/app/codes/NewValesForm.tsx` (client component, `useActionState`). The page sets `maxDuration = 60` because sending to everyone is sequential. Shortcuts: header button on `/codes`, "Criar vale para este cliente" on `/clients/[id]` (`/codes/new?client=<id>` preselects).
- `/balcao` (first nav item) is the till-facing page: two huge buttons, "Criar vale" (goes to `/codes/new`) and "Verificar vale" (`/balcao/verificar` — type a code, get a big green "Válido" or red "Não válido" result with a reason, and a "Marcar como usado" button when valid).
- The birthday cron and the "run now" button use a server-only Supabase client with the `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS), since they run without a signed-in session. That key must never have a `NEXT_PUBLIC_` prefix and must never be imported into a client component.
- Campaigns step 1 (SMS, simulation/test only — no "send to all" yet): `src/lib/sms.ts` has one function, `sendSms(to, text)`, server-only. It normalizes the phone number, then either logs the message to `sms_log` as `simulated` (default, nothing is actually sent) or sends it through Twilio when `SMS_MODE=twilio`, logging `sent`/`failed`. Phone numbers: a 9-digit Portuguese number starting with 9 becomes `+351...`; numbers already starting with `+` are kept; anything else is rejected. `{{name}}` in a message template is replaced with the client's first name; every message gets an unsubscribe-link footer appended (`src/lib/smsText.ts`). Every client has an `unsubscribe_token`; the public page `/u/[token]` (allowed without login) sets `consent = false` using the service-role admin client and shows a Portuguese confirmation. `/campaigns/new` has the message composer (live character/SMS-part counter, warns when accents force the more expensive 70-char encoding), recipient count, a preview, and a "send test SMS" button to one phone number only. `/campaigns/log` shows the last 50 `sms_log` rows.
- Deleting a vale (`/codes`) always goes through a dedicated confirmation page (`/codes/[id]/delete`) — never a browser pop-up. Client deletion still uses the older plain-button flow (no confirmation page) — this is a known inconsistency, not yet brought in line with vales.
- Wording — consent: the `consent` field is always shown as "Recebe mensagens" / "Não recebe mensagens" in the UI (tags, filters, counts), never "aceitou promoções" or "consentimento". The client-form tick box reads "Este cliente quer receber mensagens da Vitral (promoções, saldos e novidades)". Recipient counts read like "142 clientes vão receber esta mensagem". The unsubscribe page says "Já não vai receber mensagens da Vitral." These are UI-only renames — the database column is still `consent` and nothing about how it's used changed.
- Wording — vales: discount codes/vouchers are always called "vale"/"vales" in the UI (masculine: "o vale", "os vales", "vale ativo", "vale usado"), never "código", **except** the literal 8-character text itself, which is labelled "código do vale" (e.g. "Código do vale: ABCD1234") — that's the one place "código" is still correct. This is a UI-only rename: the database table is still `discount_codes`, the nav/page route is still `/codes`, and `src/app/codes/`, `codes.ts`, `codeStatus` etc. keep their existing names — only on-screen text changed. Vale statuses: "Ativo" / "Por começar" / "Expirado" / "Já usado". Dates are always dd/mm/aaaa (`formatDate` in `src/lib/date.ts`). Every field has one short hint (a few words saying what to put there, e.g. "Número de 9 dígitos."), but never examples — no "Exemplo: ..." text or "Ex.: ..." placeholders.

## Interface rules (apply to every screen, not just where first introduced)

- Base text size is 19-20px, set via `:root { font-size: 20px }` (19px on phones) so every other size — defined in `rem` in `globals.css` — scales with it and still respects browser zoom. Form labels are at least 1rem and use `var(--ink)` (dark, not `var(--muted)`) for contrast; hints under fields are at least 0.95rem.
- Every button and form control has `min-height: 48px` and generous spacing — easy to tap on a phone, not just a mouse.
- One clear primary button per screen (`.btn.primary`); everything else is a quieter plain `.btn`. A destructive "Eliminar" button never sits in the same row as "Guardar" — it lives in its own `.danger-zone` block (visually separated, below the main actions) or, for vales, is reached only via the confirmation page described above.
- Status is never colour-only: every `.tag` always contains a word ("Ativo", "Expirado", "Já usado", etc.), colour is just reinforcement.
- Spacing scale: `--sp-4/8/12/16/24/32/48/64` in `globals.css`. All margin/padding/gap values use one of these — never an arbitrary px number. Cards use `--sp-24` padding, form fields (`label`) have `--sp-24` margin-bottom, buttons in an `.actions` row have `--sp-16` gap, list rows are at least 64px tall. `main > * + *` automatically adds `--sp-32` between top-level sections of a page, so pages don't need manual spacing between stacked cards.
- Three page-width containers, applied to `<main>` — pick exactly one per page: `.page-wide` (1100px: lists/dashboards — clients, vales, campaigns log), `.page-medium` (680px: forms — client form, campaigns composer, settings, balcão, vale creation), `.page-narrow` (460px: login, the unsubscribe page, and the vale delete confirmation). All three use `--sp-24` side padding on desktop, `--sp-16` on phones.
- Consistent page header: `<header className="top">` with the title on the left and the single primary action button on the right (wraps below on phones via flex-wrap); only add a header button when there's one clear primary action for that screen.
- The client edit page (`/clients/[id]`) uses `.client-layout` (a 2-column CSS grid: form left, vales right) inside `.page-wide`; it collapses to one column under 900px. `.cards-grid` is an auto-fit grid (min 280px per card) used for the balcão buttons so they sit side by side on wider screens and stack on phones.
- Main navigation is `src/app/_components/TopBar.tsx`, rendered once by the root layout (not per-page) — a "use client" component that reads the URL with `usePathname()` to decide both whether to render at all (hidden on `/login` and `/u/*`) and which nav item is active. Sticky, full width, thin bottom border, inner content capped at the wide container's 1100px/`--sp-24`. Desktop shows all links in a row (`.topbar-link`, active = bold + underline + `aria-current="page"`, never colour alone); under 900px they collapse into a `<details>/<summary>` "Menu" button opening a full-width panel of big links that closes on selection. "Sair" sits on the right, small (0.85rem) and in `var(--warn)`, with a ≥44px tap target, separated from the nav links.
- After every save/delete, redirect back with a `message` query param and show it as `<p className="notice">` at the top of the destination page (e.g. "Cliente guardado.", "Vale eliminado."). Error messages state what to do next, not just that something failed (e.g. "Verifique e tente novamente.").
- Keep forms single-column, one screen's worth of related fields at a time; keep rarely-used things (like `/settings/birthday`) off the main flow, reachable from the nav but not front-and-centre.

## Plan

1. Client records (done: login, list, search, add, edit, delete)
2. Vales (done): birthday vales, independent vale creation (percentage or euro amount, for one/several/all clients, optional SMS), vale list/check/mark-used, a dedicated till page (`/balcao`). No purchase tracking — staff decide eligibility themselves.
3. Campaigns (in progress): step 1 done — compose a message, test-send to one number, simulate/real SMS sending, opt-out link, send log. Still to do: a "send to all consenting clients" action, and email sending.

## Where things are

- `src/app/` pages and server actions
- `src/app/_components/TopBar.tsx` shared sticky top bar, rendered once by `layout.tsx` (Balcão, Clientes, Vales, Campanhas, Definições, plus "Sair")
- `src/app/_components/CopyButton.tsx` small client component, copies a vale code to the clipboard
- `src/app/balcao/` till-facing pages: `page.tsx` (two big buttons), `verificar/` (check/mark a vale used), `actions.ts`
- `src/app/u/[token]/` public unsubscribe page (no login required)
- `src/lib/supabase/server.ts` Supabase client for the server (uses the anon key, respects RLS)
- `src/lib/supabase/admin.ts` server-only Supabase client using the service role key (bypasses RLS) — used by the birthday cron/settings "run now" action and the public unsubscribe page
- `src/lib/birthdayCodes.ts` shared birthday-code logic used by the cron route and the settings page
- `src/lib/codes.ts` random code generator (vales), `generateUniqueCodes` for many at once
- `src/lib/date.ts` date helpers: "today in Europe/Lisbon", dd/mm/aaaa formatting, datetime formatting
- `src/lib/auth.ts` username validation pattern and the username-to-email mapping used for login
- `src/lib/phone.ts` phone number normalization to international format
- `src/lib/smsText.ts` SMS character/part counting (GSM-7 vs UCS-2), `{{name}}` templating, unsubscribe footer — pure, safe to import client-side for the live counter
- `src/lib/sms.ts` the one `sendSms(to, text, clientId?)` function — server-only, never import from a client component
- `src/middleware.ts` redirects signed-out visitors to `/login`; `/login` and `/u/*` are the only routes allowed without a session
- `supabase/schema.sql` database setup. Add new tables and policies here, and tell Miguel to run them in the Supabase SQL Editor.

## Working rules

- Commit and push to GitHub after each finished change, with a clear message.
- Tell Miguel what changed in one or two plain sentences.
- Run `npm run build` before pushing to catch errors.
