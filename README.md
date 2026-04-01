# Ops System

Daily ops reporting app for agents and team leads. Agents upload or paste access codes, submit requeue counts, and team leads review daily or monthly summaries.

## Stack

- Frontend: React + Vite
- Backend: Express + TypeScript
- Database: Supabase
- Email: Resend
- Frontend hosting: Cloudflare Pages
- Backend hosting: separate Node host behind Cloudflare DNS/proxy

## Local development

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env`
3. Start the app:
   `npm run dev`

This starts the Express server on `http://localhost:3000` and serves the Vite app through the same origin, so `VITE_API_BASE_URL` can stay blank locally.

## Environment variables

- `VITE_API_BASE_URL`: Public API origin for the frontend. Set this in production to your Cloudflare-fronted API hostname, for example `https://api.ops.example.com`.
- `FRONTEND_ORIGIN`: Comma-separated browser origins allowed by backend CORS, for example `https://ops.example.com,https://www.ops.example.com`.
- `ADMIN_PASSWORD`: Team lead login password.
- `RESEND_API_KEY`: Resend API key for daily summary emails.
- `TEAM_LEAD_EMAIL`: Recipient address for the daily summary.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: Supabase project credentials used by the backend.

## Cloudflare deployment

### Frontend on Cloudflare Pages

1. Build command: `npm run build`
2. Output directory: `dist`
3. Set the Cloudflare Pages environment variable:
   `VITE_API_BASE_URL=https://api.ops.example.com`
4. Authenticate Wrangler locally:
   `npm run cf:login`
5. Create the Pages project once:
   `npm run cf:pages:create`
6. Deploy from this repo:
   `npm run cf:deploy`

The repo includes `public/_redirects` for SPA route fallback and `public/_headers` for long-lived caching of hashed assets under `/assets`.

### Backend on a separate host

1. Deploy the same repo to your Node host with:
   `npm start`
2. Set the backend environment variables from `.env.production.example`.
3. Point a Cloudflare-managed subdomain such as `api.ops.example.com` at that backend host.
4. Enable Cloudflare proxy and SSL/TLS mode `Full` or `Full (strict)`.

The backend exposes a simple health endpoint at `/api/health` for validation after deployment.

### Cloudflare cache guidance

- Cache static frontend assets only.
- Do not cache API POST routes such as `/api/upload`, `/api/submit`, or `/api/report`.
- Leave dynamic API responses uncached unless you intentionally add a safe GET cache policy later.

## Supabase schema

Run `schema.sql` in your Supabase SQL editor to create the required tables and example seed data.

## Legacy Vercel files

`vercel.json` and `api/[...path].ts` can still support a Vercel deployment path, but the Cloudflare Pages setup does not depend on `vercel.json` rewrites for production frontend traffic.
