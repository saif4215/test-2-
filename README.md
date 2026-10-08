# Maruf Cafe — 3D redesign

Standalone static site (no build step). Three.js is vendored in `vendor/`.

## Run it

    cd maruf-cafe
    node server.mjs            # Node 18+, no npm install needed

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

Tests: `node --test` (runs against a mock Square, no keys needed).

Not covered yet:
- Items with a price range (sizes, e.g. Lemonade $3.00 - $4.00) link to Square Online, because the size names are not in `menu.json`.
- Pickup only. No delivery, tips or order-ready notifications.
- The server must be hosted somewhere that runs Node (Render, Fly.io, Railway, a VPS). A static host alone cannot take payments.
- It has not been run against Square itself, only against the mock in `server.test.mjs`.

## Content
- The menu is `menu.json` (prices in cents). Ids must stay unique. The menu was copied from marufcafe.com.
- "Order online" and "Gift cards" link to the cafe's real pages on marufcafe.com.

## Logo
`logo.svg` (light ink, for dark backgrounds, used in the nav) and `logo-dark.svg` (dark ink, drawn on the 3D cup) are a
vector redraw of the Maruf Cafe logo, made from the image shared in chat, not the original artwork. To use the real files,
replace both with your own (same names, SVG or PNG with matching extension updated in `index.html`, `main.js`, `server.mjs`).

## Still to fill in
Nothing required. Hours are in `#visit` in `index.html` and again in `main.js` (open-now badge) and the JSON-LD block; change all three if they change. The Columbus Day note on the cafe's listing was left out as a one-day exception.
