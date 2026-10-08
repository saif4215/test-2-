# Maruf Cafe — 3D redesign

Standalone static site (no build step). Three.js is vendored in `vendor/`.

## What is here
- **The website** (`public/`): 3D showcase, menu, **Large Orders** (`/large-orders`) and **Rent the Café** (`/rent-the-cafe`) pages with real request forms, FAQ, gallery and reviews (shown only when you add real ones), a Call / Large Orders / Rent the Café bar on phones, and local search data.
- **The staff dashboard** (`/admin/`): requests and statuses, menu and prices, site info, photos. See `DEPLOY.md`.
- **The backend** (`server.mjs`, `lib/`): saves requests in a SQLite database, emails the owner (Resend) and/or posts to a webhook, serves the menu and site details, and runs Square checkout.
- **The phone app** (`app/`, served at `/app/`): the same requests, menu and details from the same server. See `app/README.md`.

Setup, email, hosting and what the café still has to fill in: **`DEPLOY.md`**. Settings: `.env.example`.

## Run it

    cd maruf-cafe
    node server.mjs            # Node 22.12+, no npm install needed
    ADMIN_PASSWORD=choose-a-long-one node server.mjs   # also switches on /admin/

Open http://localhost:8080. Without Square settings the site works and ordering falls back to
a link to the Square Online store. A plain `python3 -m http.server` also shows the site, but not checkout.

## Square checkout

Customers add fixed-price items to a cart and pay by card on this site. Card numbers are typed into
Square's hosted card field and never touch this code. The server (`server.mjs`) then:

1. recomputes every price from `menu.json` (the browser only sends item ids and quantities),
2. creates a Square order (pickup, ASAP) and pays it with the one-time card token,
3. cancels the unpaid order if the card is declined.

Set up:
1. In the Square Developer Dashboard create an application and open **Credentials**.
2. Copy `.env.example` values into your host's environment settings (not into the repo).
3. Start with `SQUARE_ENV=sandbox`, the sandbox access token and location, and test with Square's test cards
   (https://developer.squareup.com/docs/devtools/sandbox/payments). Switch to `production` only after that.
4. Set `TAX_PERCENT` to your real sales tax rate. The server adds it to the Square order, which is the amount charged.

Tests: `npm test` (mock Square, mock email, no keys needed). Browser tests: `e2e/`.

Not covered yet:
- Items with a price range (sizes, e.g. Lemonade $3.00 - $4.00) link to Square Online, because the size names are not in the menu.
- Pickup only. No delivery, tips or order-ready notifications.
- The server must be hosted somewhere that runs Node (Render, Fly.io, Railway, a VPS). A static host alone cannot take payments.
- It has not been run against Square itself, only against the mock in `server.test.mjs`.

## Content
- The menu starts from `public/menu.json` (prices in cents) and is edited in the dashboard. Edits are stored in the database and win over the file. The menu was copied from marufcafe.com.
- Business details, FAQ and event options start from `public/content.default.json` and are also edited in the dashboard.
- "Order online" and "Gift cards" link to the cafe's real pages on marufcafe.com.

## Install it as an app
The site is an installable web app (PWA): `manifest.webmanifest`, `sw.js` and the `icon-*.png` files.
- Android / Chrome: a "Get the app" button appears in the footer. The browser asks to install.
- iPhone: "Get the app" shows Add to Home Screen steps (Safari has no install prompt).
- It opens full screen with the Maruf icon and the menu, hours and logo work offline. Ordering needs a connection.
- Must be served over HTTPS (or localhost) by `server.mjs`. After changing site files, bump `CACHE` in `sw.js` if you
  want installed copies to drop old assets (pages and scripts already refresh when online).
- This is not an App Store / Google Play app. Store apps need Apple ($99/yr) and Google ($25 once) developer accounts.

## The hero cup
The 3D hero cup is modelled on the real Maruf paper cup (black body, white base, black lid with sip tab, logo printed in
white with a gold ring). To show the ceramic cup with latte art instead, set `TAKEAWAY = false` in `initScene()` in `main.js`.

## Logo
`logo.svg` (light ink, for dark backgrounds, used in the nav), `logo-dark.svg` (dark ink, for the ceramic cup) and `logo-cup.svg` (white ink with an outlined script, as printed on the paper cup) are a
vector redraw of the Maruf Cafe logo, made from the image shared in chat, not the original artwork. To use the real files,
replace them with your own (same names, SVG or PNG with matching extension updated in `index.html`, `main.js`, `server.mjs`).

## Still to fill in
See section 4 of `DEPLOY.md`. Hours, phone and address now come from one place (the dashboard, or `public/content.default.json`).
