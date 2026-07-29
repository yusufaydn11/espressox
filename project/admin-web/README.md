# Espresso X — Admin Web Panel

Production-ready admin dashboard for the Espresso X franchise system.
Deployed to **admin.espressox.com.tr** via Vercel.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 5** (build tool)
- **React Router 7** (BrowserRouter, SPA mode)
- **Tailwind CSS 3** (with dark mode)
- **Supabase** (auth + database, RLS-protected)
- **Recharts** (analytics charts)
- **Lucide React** (icons)

## Features

- **Dark mode** — toggle in the topbar, persists to localStorage
- **Role-based access** — only `super_admin`, `franchise`, `store_manager`, `staff` can log in
- **Toast notifications** — success/error feedback for all actions
- **Search** — filter any table or card grid by text
- **Pagination** — client-side pagination on all list views
- **Filters** — status filters, segment filters, date range selectors
- **Loading states** — spinners during data fetch
- **Error states** — retryable error messages
- **Responsive** — mobile sidebar, adaptive grids, works on all screen sizes
- **Code-splitting** — separate chunks for React, charts, Supabase, icons

## Screens

| Screen | Path | Roles |
|--------|------|-------|
| Dashboard | `/` | All |
| Orders | `/orders` | All |
| Products | `/products` | super_admin, franchise, store_manager |
| Categories | `/categories` | super_admin |
| Campaigns | `/campaigns` | super_admin, franchise, store_manager |
| Coupons | `/coupons` | super_admin |
| Rewards | `/rewards` | super_admin, franchise, store_manager |
| Loyalty | `/loyalty` | super_admin |
| Customers | `/customers` | super_admin, franchise, store_manager |
| Notifications | `/notifications` | super_admin, franchise, store_manager |
| Stores | `/stores` | super_admin, franchise, store_manager |
| Franchises | `/franchises` | super_admin |
| Employees | `/employees` | super_admin, franchise, store_manager |
| Inventory | `/inventory` | super_admin, store_manager, staff |
| Analytics | `/analytics` | super_admin, franchise |
| Reports | `/reports` | super_admin, franchise |
| Settings | `/settings` | super_admin |

## Dashboard Widgets

- Today's sales
- Monthly sales
- Active customers
- Orders today
- Average basket
- Points redeemed
- New members
- Top product
- Sales trend chart (Recharts Area)
- Store comparison chart (Recharts Bar)
- Top products chart (Recharts Bar)
- Recent orders list

## Prerequisites

- Node.js 18+
- npm 9+

## Local Development

```bash
npm install
npm run dev
```

The dev server starts on http://localhost:5174.

## Production Build

```bash
npm run build
```

Outputs static files to `dist/`. Preview the production build locally:

```bash
npm run preview
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |

Both are prefixed with `VITE_` so Vite exposes them to the client bundle.
The anon key is safe to expose — data is protected by Row Level Security (RLS).

### Setup

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

For Vercel, add these as Environment Variables in Project Settings.

## Deploy to Vercel

### Option A — Vercel Dashboard

1. Push this `admin-web/` directory to a Git repository.
   If inside a monorepo, set **Root Directory** to `admin-web/`.

2. Import the repository at [vercel.com/new](https://vercel.com/new).

3. Vercel auto-detects Vite. Verify:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. Add Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

5. Click **Deploy**.

6. Add custom domain `admin.espressox.com.tr` in Project Settings → Domains.

### Option B — Vercel CLI

```bash
npm i -g vercel
cd admin-web
vercel          # preview deploy
vercel --prod   # production deploy
```

## Custom Domain Setup

1. Vercel: Project Settings → Domains → Add `admin.espressox.com.tr`
2. Add the DNS record shown (typically CNAME → `cname.vercel-dns.com`)
3. Wait for DNS propagation. Vercel provisions SSL automatically.

## SPA Routing

`vercel.json` contains a catch-all rewrite that sends every path to
`index.html`, so React Router's `BrowserRouter` handles client-side
routes without 404 errors.

## Project Structure

```
admin-web/
├── index.html
├── vercel.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── package.json
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── lib/
    │   ├── supabase.ts
    │   ├── auth.tsx
    │   ├── api.ts
    │   ├── analytics.ts
    │   ├── ui.tsx
    │   ├── toast.tsx
    │   ├── theme.ts
    │   └── utils.ts
    └── screens/
        ├── AdminLayout.tsx
        ├── LoginScreen.tsx
        ├── Dashboard.tsx
        ├── OrdersScreen.tsx
        ├── ProductsScreen.tsx
        ├── CategoriesScreen.tsx
        ├── CampaignsScreen.tsx
        ├── CouponsScreen.tsx
        ├── RewardsScreen.tsx
        ├── LoyaltyScreen.tsx
        ├── CustomersScreen.tsx
        ├── NotificationsScreen.tsx
        ├── StoresScreen.tsx
        ├── FranchisesScreen.tsx
        ├── EmployeesScreen.tsx
        ├── InventoryScreen.tsx
        ├── AnalyticsScreen.tsx
        ├── ReportsScreen.tsx
        └── SettingsScreen.tsx
```

## Authentication

- **Login:** Email + password (Supabase Auth)
- **Admin accounts:** Must have a row in `user_roles` with one of:
  `super_admin`, `franchise`, `store_manager`, `staff`
- All database access goes through RLS policies that check admin roles.
