# Vitral Clients

Web app to manage Vitral's client records. Built with Next.js and Supabase.

## Run it on your computer

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in the two values from Supabase (Project Settings > API).
3. In Supabase, open SQL Editor, paste the contents of `supabase/schema.sql` and run it.
4. In Supabase, go to Authentication > Users > Add user, and create your login (email and password).
5. Start the app: `npm run dev`, then open http://localhost:3000

## Put it online

Import this repository in Vercel, add the same two environment variables, and deploy.
