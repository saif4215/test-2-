# Maruf Cafe

A phone app (also served on the web) for a Staten Island café that takes large orders, catering requests and private event rentals, with a staff dashboard and a small Node server behind it. The server has no packages to install (Node 22.12 or newer); the app is built once with `npm run build`.

## What is here
- **The phone app** (`app/`, served on the web at `/app/`): menu and order list, large-order and catering quote requests, event rental requests, directions (Google Maps, Apple Maps, Waze), FAQ, an optional AI helper, and 3D models (a burger you can spin and take apart, and the Maruf cup, open with coffee and a logo lid beside it). The 3D models draw in the web app at `/app/` only; the phone-store builds skip them. See `app/README.md`.
- **The staff dashboard** (`/admin/`): requests and statuses, menu and prices, site info, photos. See `DEPLOY.md`.
- **The backend** (`server.mjs`, `lib/`): saves requests in a SQLite database, emails the owner (Resend) and/or posts to a webhook, serves the live menu and details to the app, runs the AI helper, and an optional Square checkout that the app does not use.
- **Privacy and support pages** (`/privacy`, `/support`), needed for the App Store and Google Play.

The 3D website that was here before has been removed (it is still in the git history). Its old addresses (`/`, `/large-orders`, `/rent-the-cafe`) now lead into the app.

Setup, email, hosting and what the café still has to fill in: **`DEPLOY.md`**. Settings: `.env.example`.

## Run it

    cd maruf-cafe
    node server.mjs            # Node 22.12+, no npm install needed
    ADMIN_PASSWORD=choose-a-long-one node server.mjs   # also switches on /admin/

Open http://localhost:8080 (it opens the app at `/app/`).

## Content
- The menu starts from `public/menu.json` (prices in cents) and is edited in the dashboard. Edits are stored in the database and win over the file. The menu was copied from marufcafe.com.
- Business details, FAQ and event options start from `public/content.default.json` and are also edited in the dashboard.
- "Order online" and "Gift cards" link to the cafe's real pages on marufcafe.com.

## Still to fill in
See section 4 of `DEPLOY.md`. Hours, phone and address now come from one place (the dashboard, or `public/content.default.json`).
