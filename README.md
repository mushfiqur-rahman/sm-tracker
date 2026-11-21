# SM Tracking — Social Media Tracking & Scheduling SaaS

Multi-tenant SaaS where a business connects all of its social media accounts, then its team writes, approves and schedules posts — minutes or months ahead — from one calendar.

**Stack:** Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind CSS 4 · Prisma 6 · MySQL / MariaDB · Stripe

## Features

- **11 networks:** Facebook Pages, Instagram, Threads, X, LinkedIn, TikTok, YouTube, Pinterest, Bluesky, Mastodon, Google Business Profile — via official OAuth (or app password / token for Bluesky & Mastodon).
- **Composer:** one caption with per-channel overrides, network-specific fields (YouTube title, Pinterest board, TikTok privacy…), image/video upload, live validation of character limits, media counts/sizes and required media, previews.
- **Scheduling:** any date/time in any timezone, quick picks (tomorrow, next Monday, in 1 month), publish now, drafts. A background worker publishes due posts with retries (1 → 5 → 15 min) and token refresh.
- **Teams:** invite employees as Admin / Editor / Contributor / Viewer, optionally restricted to specific channels. Contributors' posts go through an approval queue. Activity log.
- **SaaS billing:** plans metered by posts/month, team seats, channels and media storage (see `src/lib/plans.ts`). Stripe Checkout + Customer Portal + webhooks.
- **UI:** clean responsive layout, light / dark / system theme, multi-script fonts (Latin, Bengali, Arabic, Devanagari, Thai, Hebrew, CJK) so the browser's built-in "Translate this page" works well. Post text is marked `translate="no"` so previews always show exactly what will be published.

## Run locally on Windows with XAMPP

Requirements: **Node.js 20.9+** (22 LTS recommended) and XAMPP with **MySQL** started.

```powershell
cd D:\PROJECT\sm-tracker
git checkout claude/social-media-scheduler-saas-njjhcu
npm install
copy .env.example .env
```

Edit `.env`:

- `DATABASE_URL="mysql://root:@localhost:3306/sm_tracking"` — XAMPP default (user `root`, no password). If you set a root password: `mysql://root:YOURPASS@localhost:3306/sm_tracking`.
- `AUTH_SECRET` — any random string of 32+ characters.

Create the tables (the `sm_tracking` database is created automatically) and load demo data:

```powershell
npm run db:push
npm run db:seed
```

Start the app and the scheduler in **two terminals**:

```powershell
npm run dev
```

```powershell
npm run worker
```

Open http://localhost:3000 and sign in as `owner@demo.test` / `password123` (also `editor@demo.test` and `contributor@demo.test`), or create your own account.

With `DEMO_MODE="true"`, networks without API keys connect as **sandbox accounts** and publishing is simulated, so you can try every flow before registering developer apps.

## Connecting real social networks

Create a developer app on each network, set the redirect URI to `{APP_URL}/api/social/callback/{platform}` (e.g. `https://yourdomain.com/api/social/callback/facebook`), and put the client ID/secret in `.env`:

| Platform | Env prefix | Notes |
|---|---|---|
| Facebook Pages | `FACEBOOK_` | Meta app with `pages_manage_posts`. Requires Meta App Review for public use. |
| Instagram | `INSTAGRAM_` | "Instagram API with Instagram Login"; Business/Creator accounts only. |
| Threads | `THREADS_` | Threads API use case on a Meta app. |
| X | `X_` | OAuth 2.0 with PKCE; paid API tier needed to post. |
| LinkedIn | `LINKEDIN_` | "Share on LinkedIn" + "Sign in with LinkedIn (OpenID)". |
| TikTok | `TIKTOK_` | Content Posting API; verify your media domain. Unaudited apps can only post privately. |
| YouTube / Google Business | `GOOGLE_` | One Google Cloud OAuth client for both. |
| Pinterest | `PINTEREST_` | |
| Bluesky, Mastodon | — | Users connect with an app password / access token; no app needed. |

Instagram, Threads, TikTok, Pinterest and Facebook video **download media from your server**, so in production `APP_URL` must be a public HTTPS URL. Set `DEMO_MODE="false"` in production.

## Billing (Stripe)

Without Stripe keys, plan changes apply instantly (handy for development). For real billing: create three recurring prices, set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER|GROWTH|BUSINESS`, and point a webhook at `/api/stripe/webhook` (events: `checkout.session.completed`, `customer.subscription.*`) with its secret in `STRIPE_WEBHOOK_SECRET`. Edit limits and prices in `src/lib/plans.ts`.

## Production

```bash
npm run build
npm start          # web
npm run worker     # scheduler (keep running, e.g. with pm2 or systemd)
```

Instead of the worker you can call `GET /api/cron/publish` with header `Authorization: Bearer $CRON_SECRET` every minute from any cron service. Uploaded media is stored on disk in `storage/uploads` (`STORAGE_DIR` to change); swap `src/lib/storage.ts` for S3/R2 when running multiple servers.

## Project layout

```
prisma/schema.prisma        data model (MySQL)
src/lib/plans.ts            pricing plans & limits
src/lib/platforms.ts        per-network rules + validation
src/lib/oauth.ts            OAuth connect / refresh for each network
src/lib/publisher/          scheduler engine + one provider per network
src/lib/usage.ts            quota metering
src/worker/scheduler.ts     background publisher
src/app/(app)/              dashboard, compose, calendar, posts, accounts, team, billing, settings
src/app/(marketing)/        landing & pricing pages
src/proxy.ts                route protection (Next 16 "proxy", formerly middleware)
```

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm run worker` · `npm test` · `npm run lint` · `npm run typecheck` · `npm run db:push` · `npm run db:seed`
