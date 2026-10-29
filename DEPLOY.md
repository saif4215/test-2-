# Put Maruf Cafe online, set it up, and run it day to day

This one server runs everything: the phone app (`/app/`), the staff dashboard (`/admin/`) and the backend for quote and event requests.
It needs **Node 22.12 or newer** and no `npm install` (the database is built into Node).

You can do all of this from a phone. Part 1 gets it online. Part 2 makes sure **you never miss a request**. Part 3
is the dashboard. Part 4 is the list of things only the café can fill in.

---

## 1. Get it online (any host you like)

This is a plain Node program, so it runs almost anywhere, and you choose the host. It needs:

- **Folder and command:** the `maruf-cafe` folder of the repository (the repository root is a different project), started with
  `node server.mjs` on **Node 22.12 or newer**. Nothing to install or build: the phone app is already in `public/app`.
- **Port:** it listens on the `PORT` setting (default 8080).
- **A disk that survives restarts**, with `DATA_DIR` set to its path. Requests, photos and menu edits live there.
- **HTTPS:** most hosts give you this for free. Use an address that looks like the café's, not the host's default one, if you can.
- **A health check path** (if the host asks for one): `/api/config`.
- **Settings** (names are exact):

  | Name | Value | Why |
  |---|---|---|
  | `ADMIN_PASSWORD` | a long password you choose (**10+ characters**) | switches the staff dashboard on |
  | `PUBLIC_URL` | your real address, no slash at the end, e.g. `https://order.your-domain.com` | links in emails and the sitemap |
  | `DATA_DIR` | the path of the disk, e.g. `/data` | where requests and photos are kept |
  | `TRUST_PROXY` | `1` when a proxy or load balancer sits in front (most hosts) | so sign-in lockouts and rate limits see each visitor's real address |
  | `RESEND_API_KEY`, `NOTIFY_EMAIL` **or** `INQUIRY_WEBHOOK_URL` | see Part 2 | an alert for every request. You do not need Resend: a webhook works too |

  Optional: `STAFF_PASSWORD` (a second sign-in for staff, 10+ characters), `STAFF_CAN_EDIT_SITE=1` (lets staff also edit site info and photos; they can already edit the menu). The full list with
  explanations is in `.env.example`.

Three ways to do it:

### Way 1: Docker (works on nearly every host)

There is a `Dockerfile` in this folder. Build it (`docker build -t maruf-cafe .`) or let your host build it, mount a volume at `/data`,
and set the settings above. For your own server, `docker-compose.yml` runs the café plus a Caddy web server that gets the https certificate
by itself: put `DOMAIN=your.address`, `ADMIN_PASSWORD=...`, `PUBLIC_URL=https://your.address` (and the other settings, one `NAME=value` per
line, no comments) in a file called `.env`, then run `docker compose up -d --build`.
The Docker files have not been built on a real machine yet (the place they were written had no Docker); the server itself runs fine
with exactly the files the Dockerfile copies. Check the first deploy.

### Way 2: An app host that builds from a repository

Railway, Fly.io, Koyeb, DigitalOcean App Platform, Render and similar hosts all work the same way: create a service from the repository,
set its folder to `maruf-cafe`, set the start command to `node server.mjs` (or tell it to use the Dockerfile), attach a volume or disk,
add the settings above, and deploy. The menu names differ from host to host. Check each host's current pricing and whether its
free plan keeps files (many do not; see Part 2). Some hosts do not redeploy by themselves: redeploy after changes.

### Way 3: Your own server (a small rented Linux server, or a computer at the café)

Install Node 22.12+, copy the `maruf-cafe` folder to the server, put the settings in a file such as `/etc/maruf-cafe.env`, and run it with
systemd so it restarts by itself:

```ini
[Unit]
Description=Maruf Cafe
After=network.target
[Service]
WorkingDirectory=/opt/maruf-cafe
EnvironmentFile=/etc/maruf-cafe.env
ExecStart=/usr/bin/node server.mjs
Restart=always
User=maruf
[Install]
WantedBy=multi-user.target
```

Put a web server such as Caddy or nginx in front for https (set `TRUST_PROXY=1`). To update: copy the new files and restart the service.

### Then
- `/app/` is the phone app (the plain address `/` sends people there) and `/admin/` is the dashboard.
- Add the app to your home screen: iPhone Safari → Share → **Add to Home Screen**; Android Chrome → menu → **Install app**.
- When the address changes, update `PUBLIC_URL` and, for store builds, the address in `app/eas.json`.

Nothing is stored in your GitHub repository: requests, edits and photos live only on the server (in `DATA_DIR`).

---

## 2. Never miss a request (important)

When a customer sends a quote or event request the server **saves it in its database first, then emails you**. The app
only says "received" after that worked. If nothing could be saved and no email/webhook could be sent, the customer
is told it failed and is given your phone number. A form never pretends to work.

**Many hosts' free plans have temporary storage** (check yours). Anything saved (the database, uploaded photos, menu edits) is then erased
whenever the service restarts or redeploys, which happens regularly. So:

- **Always set up email alerts** (below). The email is your permanent copy of every request.
- When you are ready to rely on the dashboard, use a plan with a **persistent disk or volume** (attach it in your host's settings,
  then set `DATA_DIR` to its path). Check your host's pricing page for the current cost. Until then, use the dashboard as an inbox and keep the emails.
- Back up any time: dashboard → Requests → **Download spreadsheet**.

**You do not have to use Resend.** Pick any of these, or more than one: Resend email (below), a webhook (Slack, Discord, or Zapier/Make, which can send you a Gmail), or just the dashboard on a host that keeps its files.

### Email alerts with Resend (one option; the free tier is enough)

1. Create an account at **resend.com**. Open **API Keys → Create API Key** (permission: *Sending access*). Copy the key.
2. In your host's settings add `RESEND_API_KEY` = that key and `NOTIFY_EMAIL` = the address that should receive requests
   (several allowed, separated by commas).
3. **Quick test:** leave `NOTIFY_FROM` empty. Resend then sends from `onboarding@resend.dev`, which only delivers to the
   email address you used to sign up at Resend. So use that same address for `NOTIFY_EMAIL`.
4. **For real use:** in Resend open **Domains → Add Domain** (the café's own domain), add the DNS records it shows at your
   domain provider, wait until it says *Verified*, then set `NOTIFY_FROM` to e.g. `Maruf Cafe <requests@your-domain.com>`.
5. Send yourself a test request from the app. You should get an email with all the details; **Reply** goes to the customer.

The key lives only in your host's settings. It is never in the code and never sent to a browser.

### Or a chat message instead (Slack, Discord, Zapier, Make)

Create an *incoming webhook* in that app and put its address in `INQUIRY_WEBHOOK_URL`. Every request is posted there as plain text.
You can use the webhook and email together.

The dashboard's **Setup** tab shows whether alerts are on, and every request shows whether its alert went out.

---

## 3. The staff dashboard (`/admin/`)

Sign in at `https://YOUR-ADDRESS/admin/` with username `owner` and your `ADMIN_PASSWORD`.
Sessions last 12 hours, 5 wrong passwords lock that sign-in for 15 minutes, and every change is logged (Setup → Recent changes).

| Tab | What you can do | Who |
|---|---|---|
| **Requests** | search, filter by status, read every answer, Call / Text / Email buttons, set status (New → Contacted → Quote sent → Accepted → Declined/Closed), private notes, download a spreadsheet | owner and staff |
| **Menu** | change names, prices (single price or low/high), descriptions, hide items, add or delete items, and give an item a **picture** (Add picture on its row; the picture shows beside it in the app; items without one show a generic 3D-rendered picture of that kind of food, so add real photos of your own dishes when you have them). Hidden items disappear from the app and from online checkout. | owner and staff (staff can add pictures only if you let them edit site info and photos) |
| **Menu reset** | "Reset to the original menu" throws away all menu edits | owner only |
| **Site info** | phone, email, address, hours, Instagram/TikTok, event options and prices, what the space holds, rental rules, FAQ, **real** customer reviews | owner (or staff, same switch) |
| **Photos** | upload photos from your phone (they are shrunk automatically), put them in the photo spots and the gallery with a short description | owner (or staff, same switch) |
| **Setup** | checks that alerts, Square and accounts are set up; recent changes | owner only |

"Accepted" is only your own label. **It does not book anything and sends nothing to the customer.**

---

## 4. What only the café can fill in (nothing here is guessed)

Until you add these, the site simply leaves them out or shows a neutral line:

- **Email address** (Site info). Shown as "[ADD EMAIL]" on the support/privacy pages until set; hidden in the app.
- **Real photos** (Photos). Without them, photo spots and the Gallery section are hidden.
- **Real customer reviews** (Site info → Customer reviews). Only add reviews real customers wrote. No stars or ratings are ever shown or sent to Google.
- **How many people the space holds, rental rules, deposit/cancellation policy** (Site info → Rent the café). Blank means not shown.
- **Prices for event options** (Site info → Event options). Blank means no price is shown.
- **Group-size calculator numbers** in the phone app (`app/src/config.js`, `calculator`): serving sizes and prices stay empty until you set them.
- **Hours** were taken from what you gave (Mon–Sat 7–10, Sunday 7–4). Update them for holidays.

---

## 5. The chat in the app ("Ask a question")

The app has a chat that answers questions about the menu and prices, hours, address, large orders, catering and renting the café.
It reads your live menu, hours, FAQ and event options from the server, so it changes when you edit them. It never promises a
date, a booking or a price, never guesses capacity, rules or allergies, and sends people to the request forms or your phone number.

**It works from day one with no key and no cost.** Without an AI key it gives built-in answers taken straight from your menu and
details, and the app says so ("Automatic answers from the café's details"). It does not claim to be AI. It can answer the common
questions but not open-ended ones; for anything it does not know it says so and points to your phone number.

To upgrade it to a real AI helper that handles open-ended questions and helps plan how much food a group needs:
1. Create an account at **console.anthropic.com**, add a small amount of credit, and open **API Keys → Create Key**.
2. In your host's settings add `ANTHROPIC_API_KEY` = that key. (Optional: `ASSISTANT_MODEL`; the default is `claude-haiku-5-5`, the fast low-cost model.)
3. Redeploy. The "Ask Maruf Cafe AI" button on the app's Home screen now opens a chat.

### Free option (any OpenAI-style service)

No AI is completely free without an account, because every service needs a key so it knows who is asking. But several
services (for example **Groq**, **OpenRouter** and **Google Gemini**) offer a free tier with a free key, and they all work here:

1. Sign up on the service's website and create an API key (no card needed on most free tiers; check theirs).
2. In your host's settings add three variables instead of `ANTHROPIC_API_KEY`:
   - `AI_API_KEY` = the key
   - `AI_BASE_URL` = the service's OpenAI-compatible address, which must start with `https://`
     (examples: `https://api.groq.com/openai/v1`, `https://openrouter.ai/api/v1`; check the service's docs for the exact address)
   - `AI_MODEL` = a model name from the service's list. Pick one marked free. Model names change, so copy it from their site.
3. Redeploy and test it like above.

Things to know about free tiers: they have low limits (the assistant says "busy" when you hit them), they can change or end,
and some free services may keep or use what people type to improve their products. The privacy page says this. The answers may also
follow the café's rules less reliably than a stronger paid model, so test it with tricky questions (dates, allergies, prices) first.
If both are set, the free service is used.

Cost control: each visitor is limited to 6 questions a minute, and the whole assistant stops at 300 questions a day
(`ASSISTANT_DAILY_LIMIT`). Set your own monthly spending limit in the Anthropic console too. The key stays on the server.
Chats are not stored, and the privacy page says that questions are sent to Anthropic. Check Anthropic's pricing page for current costs.

---

## 6. Orders into your Square, and what is not paid

- **Quote and event requests collect no money and confirm nothing.** Every page says so. Take payment and confirm dates yourself,
  after you have decided your deposit and cancellation rules, and write them under Site info → Rent the café.
- **Pickup orders from the app go into your Square.** A customer adds items, taps **Place order for pickup**, gives a name and phone number,
  and the order is created in your Square account as a pickup order. Nothing is charged by the app: **the customer pays at the counter**,
  the way your Square point of sale already works. The customer sees a short order code and a screen that follows the order as you move it
  along in Square (sent, accepted, ready). This stays off until you connect Square below. While it is off, customers can still send a quote
  with their items or go to your Square Online store, so the app always works.

### Connect Square (about 15 minutes; do the sandbox part first)

1. Sign in at <https://developer.squareup.com> with the same login you use for your Square account. Open **Applications**, tap **+** and create an
   application called "Maruf Cafe app".
2. Open the application. At the top choose **Sandbox** (test mode). Under **Credentials** copy the **Sandbox access token**. Under **Locations**
   copy the sandbox **Location ID**.
3. In your host's environment settings (never in an email, a chat or git) set `SQUARE_ENV=sandbox`, `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID`,
   and `TAX_PERCENT` (the NYC combined rate is 8.875; confirm yours with your accountant, because Square does not add tax to an order sent this way).
   Restart the server. In the dashboard, **Setup** now says "App orders go into your Square (sandbox)".
4. Place an order in the app. In the Developer Dashboard open **Sandbox test accounts**, open the test account's Square Dashboard and look under
   **Orders**. You should see a pickup order marked as coming from "Maruf Cafe app", with the customer's name, phone, the items and the order code.
   Move it through accept, ready and complete there and watch the customer's screen follow. **Do not go live until you have seen this work.**
5. To go live: in the Developer Dashboard switch to **Production**, copy the **Production access token** and your real **Location ID**
   (Locations page, or Square Dashboard → Account & Settings → Business → Locations), put them in the host settings, set `SQUARE_ENV=production`
   and restart. Place one real order from your own phone, accept it in your point of sale, and cancel it.

### Good to know

- **Where staff see it:** in your Square Dashboard under Orders, and in Square Point of Sale's order list. Whether a new order also beeps or prints
  a ticket depends on your Square plan and device settings, so check this in step 4 and set it up in Square if you want it.
- **Staff steps decide what the customer sees:** accept, mark ready, complete. If nobody touches an order in Square, the customer's screen stays on
  "Order sent". The screen says it updates when the café updates the order.
- **Prices come from the Menu tab in the dashboard,** looked up again by the server for every order, so a price you change or an item you hide applies
  immediately and the app can never set its own price. The items arrive in Square by name and price (not linked to your Square item library, so
  Square's item reports will not group them with items you ring up at the counter). Linking them is possible later by reading your Square catalog.
- **Items with a price range** (for example a drink that costs more in a larger size) cannot be sent from the app, because no single price is known.
  The order screen says which ones. Give the item one price in the Menu tab (or one item per size) to let customers order it from the app.
- **Guards:** a phone number is required (so you can call the customer), one connection can place 5 orders a minute
  (`ORDER_RATE_LIMIT_PER_MIN`), and an order over $300 (`ORDER_MAX_DOLLARS`) is sent to the large-order quote instead. A prank order is cancelled in Square.
- **Retries are safe:** if a customer's connection drops and they tap Place order again, Square receives the same request key and makes one order.
- **How it was tested:** the whole flow, from the menu to the confirmation screen, runs in a real browser against a stand-in for Square. It has **not**
  been run against Square itself, and the request format (Square's Orders API, a pickup fulfillment, version `2024-10-17` in `server.mjs`) could not
  be checked against Square's current documentation when it was written. That is why step 4 matters: if Square refuses an order, the customer is told
  to try again or call, and the server log shows Square's error code (never the customer's details), which says what to fix.
- **Paying in the app** (a card form or a Square-hosted payment page) is a different feature. It is not built, because customers pay at the counter. It can be added on
  top of this later without changing how orders reach Square.

---

## 7. If you want the website back

The 3D website, the Large Orders and Rent the Café pages and the Google search setup were removed because only the app is wanted.
They are still in the project's git history (the commit before "Remove the website"), so they can be restored if you change your mind.

## Good to know

- **The free plan sleeps** when idle: the first visit after a break can take about a minute.
- The app's web copy is built into `public/app`. After changing app code run `npm run build` (needs a computer or build service) and commit it.
- Tests: `npm test` (server, forms, dashboard, search data; no keys needed). Browser tests are in `e2e/` (for example `node e2e/app-live.e2e.mjs`, needs `playwright-core` and Chromium).
