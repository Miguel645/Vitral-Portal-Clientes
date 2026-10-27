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
- Login is temporarily switched off (middleware redirect commented out) and the database policies allow the `anon` role too, so the site works without signing in. This is open to anyone with the site URL for now — re-enable both together when ready.

## Plan

1. Client records (done: login, list, search, add, edit, delete)
2. Discount codes: percentage or fixed amount, expiry date, usage limit, optionally tied to a client or campaign (for example a birthday code)
3. Campaigns: write a message, choose who receives it, send by SMS and/or email

## Where things are

- `src/app/` pages and server actions
- `src/lib/supabase/server.ts` Supabase client for the server
- `src/middleware.ts` redirects signed-out visitors to `/login`
- `supabase/schema.sql` database setup. Add new tables and policies here, and tell Miguel to run them in the Supabase SQL Editor.

## Working rules

- Commit and push to GitHub after each finished change, with a clear message.
- Tell Miguel what changed in one or two plain sentences.
- Run `npm run build` before pushing to catch errors.
