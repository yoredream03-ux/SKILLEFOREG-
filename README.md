# BUILDMATIC OS
Vite + React + Tailwind · Supabase (Auth, Postgres + RLS, Realtime, Edge Function) · Cloudflare Turnstile.

## Setup
1. **Supabase**: create a project → SQL Editor → run `supabase/schema.sql`.
2. Auth → Providers → Email: enable *Confirm email*. Auth → URL Configuration: set Site URL to your domain.
3. **Turnstile**: Cloudflare dashboard → Turnstile → add your domain. Put the *site key* in `VITE_TURNSTILE_SITE_KEY`.
   Supabase → Authentication → Attack Protection (Bot and Abuse Protection) → enable CAPTCHA (Turnstile) and paste the *secret key*.
   **Order matters:** deploy the site with `VITE_TURNSTILE_SITE_KEY` first, THEN enable CAPTCHA in Supabase, otherwise every login fails.
4. **Agent**: `supabase login && supabase link --project-ref <ref> && supabase secrets set ANTHROPIC_API_KEY=... && supabase functions deploy agent --no-verify-jwt`
   (`--no-verify-jwt` is required with the new publishable/secret keys; the function verifies the user itself.)
   `VITE_SUPABASE_ANON_KEY` takes your **publishable key** (`sb_publishable_...`) or the legacy anon key.
5. Local: `cp .env.example .env` (fill) → `npm install` → `npm run dev`
6. **Deploy** (Cloudflare Pages / Vercel / Netlify): build `npm run build`, output `dist`, set the 3 `VITE_` variables, add your domain.
   `public/_headers` holds the CSP (Pages/Netlify); on Vercel move it to `vercel.json`.

## Before launch
- Replace `public/privacy.html` and `terms.html` (lawyer review; CNDP declaration if you operate in Morocco).
- Set a custom SMTP (Resend/Brevo) in Supabase: the default sender is heavily rate-limited.
- Add error tracking and privacy-friendly analytics; enable backups.

## Security model
- `profiles.xp` cannot be edited by the client; only `award_xp()` (max 50 per call, 500 per 24h).
- Elite chat: RLS requires xp >= 3000 to read and write; author name comes from the profile.
- Agent: Edge Function checks the user JWT, 30 requests per 24h per user; the API key never reaches the browser.

## Known gaps
- Skills, vault and sub-skills are saved per user (`user_state`), but are client-trusted JSON.
- Dev News and agent history are still local to the browser.
- Code preview renders with `innerHTML` (own code only): sandbox it before adding any sharing.
- No automated tests yet. Fonts load from Google Fonts: self-host for stricter privacy.

## Test plan before opening to the public
1. Sign up with a fresh email → confirm → sign in → create/save a skill → reload (data persists, XP +10).
2. Forgot password → email link → set a new password.
3. Elite chat: with two accounts, raise both in SQL (`update profiles set xp=3500 where id='<uuid>'`), send messages, check both see them in realtime; a 3rd account under 3000 XP must see the lock and get nothing from the API.
4. Agent: ask 31 questions → the 31st must be refused (quota).
5. Delete account → all rows removed (`profiles`, `user_state`, `elite_messages`).
6. Bots: submit the form without the Turnstile token / with the hidden field filled → must fail.
7. Lighthouse on mobile, and a real phone test of the IDE panel.
Note: with the 500 XP/day cap, reaching 3000 XP takes at least 6 days. Tune `award_xp` if that is too slow.
