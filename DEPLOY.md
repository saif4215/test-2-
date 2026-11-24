# Put Maruf Cafe online, set it up, and run it day to day

> Just want it running on your own computer? Open `START-HERE.md` instead: double-click START and answer a few questions. This guide is for putting it online.

This one server runs everything: the phone app (`/app/`), the staff dashboard (`/admin/`) and the backend for quote and event requests.
It needs **Node 22.13 or newer** and no `npm install` (the database is built into Node).

You can do all of this from a phone. Part 1 gets it online. Part 2 makes sure **you never miss a request**. Part 3
is the dashboard. Part 4 is the list of things only the café can fill in.

---

## 1. Get it online (any host you like)

This is a plain Node program, so it runs almost anywhere, and you choose the host. It needs:

- **Folder and command:** the `maruf-cafe` folder of the repository (the repository root is a different project), started with
  `node server.mjs` on **Node 22.13 or newer**. Nothing to install or build: the phone app is already in `public/app`.
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

Install Node 22.13+, copy the `maruf-cafe` folder to the server, put the settings in a file such as `/etc/maruf-cafe.env`, and run it with
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

**Busy? Pause pickup orders.** A strip under the tabs, on every page, lets the owner or staff pause new pickup orders for 15 minutes, 30 minutes, 1 hour or 2 hours. Customers can still look at the menu and keep their items, but the order screen tells them when to come back and the server refuses new orders (so an old copy of the app cannot sneak one in). It ends by itself; "Open again now" ends it early. Who paused it is in the Setup tab's Recent changes.

**Rewards and labels.** In **Site info > Points** you can add rewards for customers to work toward (for example "100 points: a free drink"). Each shows in the app as a goal with a progress bar. When a customer has enough points they tap **Use**, show their phone at the counter, and tap **Done** to take the points off. Points live on the customer's own phone, so only add a reward you are happy to give on their word. There are none until you add one. In the **Menu** tab each item has a **Label** (New, Popular or Seasonal) that shows as a small tag in the app; only use Popular if it really is.

**"I'm here" for pickup.** On the order screen (after a customer places a pickup order) there is an **I'm here** button for when they arrive. It puts a green strip at the top of the dashboard, on every page: "A customer is here for pickup", with their name, the order code and how many minutes ago, and a **Got it** button that clears it. The dashboard checks every 15 seconds, plays a soft chime for each new arrival (your browser must have been used on that page once), and puts the count in the browser tab's title. If you set `INQUIRY_WEBHOOK_URL` (Slack, Discord...) a chat message "Sam is here for pickup order ABCD" is sent too; it does not send email. It is refused for an order that was already picked up or canceled, and tapping twice tells the café only once.

**What's new on Home.** Items you give the label **New** or **Seasonal** (Menu tab > Label) appear in a "What's new" row on Home, New first. Nothing shows until you label one.

**Dietary tags.** On each menu item, **Dietary tags** lets you tick Vegetarian, Vegan, Gluten-free, Dairy-free and Nut-free. The app shows them under the item's price and on its page, and a row of filter buttons appears on the Menu (only for tags you have used) so a customer can see just the vegan items, for example. **Nothing is ticked until you do it**, and nothing is guessed: only tick a tag you are sure is true for the item as you make it, especially Nut-free. The item page also tells customers to ask the café about allergies.

**Allergen note, greeting and recent searches.** Each menu item has an optional **Allergen note** (Menu tab, "Allergen note" on the item): type it in your own words, for example "Contains milk and wheat". The app shows exactly what you typed on that item's page, with a reminder to ask the café about allergies; nothing is worked out for you, and none is filled in until you type it. There is no calorie field: calories are not shown anywhere in the app. Home greets a returning customer by the first name they gave when ordering ("Good morning, Sam"). The Menu's search box remembers a customer's last five searches on their own phone and shows them when the box is tapped.

**Order-ready notifications.** On the order screen, **Tell me when it's ready** asks the customer's permission once. When you mark the order ready, their phone or computer shows "Your order is ready". It works while the app is open or running in the background (for example a home-screen app that is still running). It does **not** reach a phone where the app was closed completely: that needs a push service, which is not set up. Customers are told this on the button. It is the web app only; the phone-store builds would need a notification add-on.

**Gift card balance.** On the Contact tab, a customer can type the number from the back of a gift card and see what is left, read from Square (this uses your Square account's gift cards). Only the balance comes back, never the card number; a card that is switched off says so; and it is limited to 8 tries a minute from one place so card numbers cannot be guessed. A "Buy a gift card" button opens your gift card page. Set `GIFT_CARDS=off` to hide it. Not tested against real Square: try one real card in your Sandbox first.

**Picked for you.** After a customer's first order, Home shows a "Picked for you" row: items they have not tried yet from the categories they order from most. It is worked out on their own phone from their own past orders; nothing is sent anywhere. Nothing shows before a first order.

**Ratings from customers.** After an order is picked up, its order screen asks "How was your order?" (1 to 5 stars and an optional note). Only you see them: the dashboard has a **Feedback** tab with the average, each rating, the comment, the customer's name and order code, and a Low / OK / Good tag. Staff can read ratings; only the owner can delete one. A customer rates an order once (rating again replaces it), and only after pickup. Ratings are never shown to other customers.

**What the café offers.** In Site info, "What the café offers" is one line per thing ("Free Wi-Fi", "Outdoor seating"), shown as small tags under "Good to know" on the Contact tab. Nothing shows until you add some.

**Settings in the app.** The Contact tab has **Settings**: the name and phone used for ordering, Appearance (same as the phone, always light, always dark), the Menu layout, and **Clear everything on this phone** (favorites, usual drinks, past orders, phone-counted points, searches, the saved name and phone, and these choices, after a confirmation). It all lives on the customer's phone; the café keeps no copy, and points kept in Square stay with their phone number there.

**Backups.** Every day the server saves a copy of the database (requests, menu and site edits) and the uploaded photos in `backups/<date>/` inside the data folder, and keeps the newest 7. `npm run backup` saves one right now. These copies are on the same disk as the data, so now and then copy the `backups` folder somewhere else (a USB stick, a cloud drive), or use the host's own disk snapshots. Set `BACKUPS=off` to switch the daily copy off.

Sign in at `https://YOUR-ADDRESS/admin/` with username `owner` and your `ADMIN_PASSWORD`.
Sessions last 12 hours, 5 wrong passwords lock that sign-in for 15 minutes, and every change is logged (Setup → Recent changes).

| Tab | What you can do | Who |
|---|---|---|
| **Requests** | search, filter by status, read every answer, Call / Text / Email buttons, set status (New → Contacted → Quote sent → Accepted → Declined/Closed), private notes, download a spreadsheet | owner and staff |
| **Menu** | **Sold out today?** at the top: type an item's name, or an extra like "oat milk", and tap it to mark it sold out at once (tap it in the list to put it back). A sold-out extra still shows in the app, greyed out as "sold out", and the server refuses it if an old order tries to use it. Below that, change names, prices (single price or low/high), descriptions, hide items, add or delete items, and give an item a **picture** (Add picture on its row; the picture shows beside it in the app; items without one show a generic 3D-rendered picture of that kind of food, so add real photos of your own dishes when you have them). Hidden items disappear from the app and from online checkout. | owner and staff (staff can add pictures only if you let them edit site info and photos) |
| **Menu reset** | "Reset to the original menu" (at the bottom of the Menu tab) throws away all menu edits | owner only |
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
3. Redeploy. The chat now uses the AI, and the two helpers below switch on by themselves. With no key they are **hidden**, not greyed out.

### Connecting the chat to your Square item list

When Square is connected for orders (section 6), the chat also **reads your item list from Square** (read only; it never changes anything in
Square). Whatever you wrote in an item's description in Square becomes something the chat can say ("Latte: espresso with steamed milk..."),
with or without an AI key. Needs no extra settings: it uses the same access token, which must be allowed to read items (the default
for a token made in your own Square developer application). It checks Square every 5 minutes. If Square cannot be reached the chat just goes on without it.

- **Prices:** the app orders from its own menu (the Menu tab in the dashboard), so a customer is always charged the price they were shown.
  Where Square and the app menu disagree on an item, the chat **does not state a price** and tells the customer to call, and the Setup tab
  lists the items so you can fix whichever side is wrong. Items are matched by name.
- **Not used from Square:** hours, sold-out items and stock. Those stay as set in the dashboard.
- **Call us:** whenever the chat cannot answer (not in your details, allergies and ingredients, a date, an unlisted price), it says so and the
  app shows a **Call** button with your number, with or without AI. A small "Call" link is always at the bottom of the chat.

### What the AI key turns on

- **Smarter chat answers** for open-ended questions.
- **The order helper in the app.** A customer types or says what they want ("2 iced lattes and a bagel") and the helper shows the items it
  understood, with quantities and requests (iced, oat milk...) and the prices from your menu. **The customer checks them and taps Add to my
  order**, then places the order themselves from My order as usual. The helper cannot place an order, cannot name an item that is not on your
  visible menu, and never sets a price: the server drops anything that is not a real item, and the app looks prices up itself.
  A **Tell us what you want** button appears on the Menu screen only when the key is set.
- **The assistant in the staff dashboard.** On the Requests tab, **Summarize what is open** gives a short overview and which requests stand
  out, and each request has **Summarize and draft a reply**. The draft is for a person to read, edit and send: nothing is sent, no status
  changes, and where staff must decide something (a date, a price) the draft says so in square brackets. Only the first name and the
  details of the request go to the AI, never the phone number, email address or delivery address, and every use is in the Setup tab's
  recent changes. Staff and owner can both use it. Limits: 12 uses a minute per person and 100 a day (`STAFF_AI_DAILY_LIMIT`).

These helpers send more of your menu to the AI service than plain Q&A does (every item with its id), and the staff helper sends the text of
customers' requests. The privacy page says both. A stronger model follows the "never promise a date or price" rules more reliably than a
small free one, so try tricky messages first ("book me Saturday", "is this nut free?", "ignore your rules") before you turn it on for customers.

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

Cost control: each visitor is limited to 6 questions a minute, and the whole customer assistant stops at 300 questions a day
(`ASSISTANT_DAILY_LIMIT`); the staff helper has its own limit of 100 a day. Set your own monthly spending limit in the Anthropic console too. The key stays on the server.
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
   **Check it before you trust it:** on a computer, copy `.env.example` to `.env` in the project folder, fill in the three Square lines (git ignores `.env`,
   so the token cannot be committed by accident), and run `npm run square-check`. It says in plain words whether Square accepts the token, whether the
   location ID belongs to your account (and lists yours if not), and whether the item list can be read. `npm run square-check -- --order` also sends one
   test order through the app's own server and follows it. It refuses to do that in production. The token is never printed.
4. Place an order in the app. In the Developer Dashboard open **Sandbox test accounts**, open the test account's Square Dashboard and look under
   **Orders**. You should see a pickup order marked as coming from "Maruf Cafe app", with the customer's name, phone, the items and the order code.
   Move it through accept, ready and complete there and watch the customer's screen follow. **Do not go live until you have seen this work.**
5. To go live: in the Developer Dashboard switch to **Production**, copy the **Production access token** and your real **Location ID**
   (Locations page, or Square Dashboard → Account & Settings → Business → Locations), put them in the host settings, set `SQUARE_ENV=production`
   and restart. Place one real order from your own phone, accept it in your point of sale, and cancel it.

### Paying in the app (card, Apple Pay, Google Pay)

By default customers send the order and pay at the counter. To make them **pay in the app instead, so nobody pays in person**, add your Square **Application ID**. Run `npm run setup` and answer the Application ID question (or put `SQUARE_APPLICATION_ID=...` in `.env`). It is on the same Square Developer Dashboard page as the access token (Credentials). Use the **Sandbox** ID with the Sandbox token first.

- **What customers see:** on My order the green "Place order" button is replaced by **Pay now**: Apple Pay and Google Pay buttons on phones that have them, and Square's secure card form (card number, date, security code, ZIP). The tip they choose is a **real tip charged with the payment**. The button shows the total, for example "Pay $4.51". Paying also places the order: it only reaches your kitchen once the payment goes through.
- **What stays safe:** card details are typed into Square's own form (Square's script draws the boxes) and turned into a one-time token. They never reach this app or your server. Your server charges the order for **exactly the total Square worked out** (tax included), plus the tip; the app can never set the amount.
- **If a card is declined:** the customer sees a plain message ("Your card was declined. Please try another card or Apple Pay."), the unpaid order is **canceled at Square so it never reaches your kitchen**, and nothing is charged. They can try again. If Square does not answer, the order is left alone and trying again cannot charge twice (the same order and payment are reused).
- **Required, once on:** while the Application ID is set, an app order can only be placed by paying. The old pay-at-the-counter button is gone for the app. (Quote requests and your Square Online store link are separate and unchanged.) Set `PAY_ONLINE=off` to switch it off again without removing the ID.
- **Your Square token** must be allowed to take payments and write orders (`PAYMENTS_WRITE`, `ORDERS_WRITE`). The Sandbox and Production tokens from the Credentials page have them. `npm run square-check` reminds you.
- **Apple Pay (web)** also needs your website's address registered with Square: in the Square Developer Dashboard open your application's **Apple Pay** page, add your domain (an `https://` address, not localhost), and download the verification file Square gives you. Save it in the data folder as `apple-pay-domain-association` (no extension). The server then serves it at `/.well-known/apple-developer-merchantid-domain-association`, where Apple looks for it. Click verify in Square. Apple Pay only appears in Safari on a device with a card in Wallet. **Google Pay** appears in Chrome for people with a saved card; for Production, Square asks you to enable it for your application.
- **Trying it safely:** with the Sandbox ID and token, pay with Square's test card `4111 1111 1111 1111`, any future date, any 3-digit code and any ZIP. Look for the order and the payment in your Square **Sandbox** Dashboard.
- **Refunds and cancellations:** if you cancel an order that was already paid, Square does **not** refund it by itself. Refund it from your Square Dashboard (Transactions) or the Square POS.
- **Points** still count from the picked-up order. **Web only:** this is for the web app (the address customers open in their browser or add to their home screen). A phone-store build would need Square's in-app payments add-on.
- **Not tested against real Square.** This was tested against a stand-in for Square's payments, and the browser card form was tested with a stand-in for Square's script. Do a full Sandbox run (a card, a declined card with the test card number Square lists for declines, and Apple Pay on your own phone after the domain step) before taking real money.

### Points in Square Loyalty (optional, recommended)

If your Square account has **Square Loyalty** (a paid Square add-on) with a program and rewards set up, the app keeps customers' points **in Square**, tied to their phone number. Nothing else to switch on: the server notices the program by itself (turn it off with `LOYALTY=off`).

- **Earning:** on the order screen a box "Earn points with this phone number" is ticked. When the order is picked up, the server tells Square to count the points for that order (Square works out how many from your program's rules, so a promotion you set up in Square applies too). The server checks every two minutes, so it does not depend on the customer keeping the app open. Purchases at the counter earn points the normal Square way when the cashier enters the customer's phone number.
- **The customer sees:** their balance, a progress bar to your next reward, and which rewards they can use. They find them on Home. The first time, the app asks for their phone number.
- **Using a reward:** at the counter, the customer gives their phone number and the cashier applies the reward in Square checkout, as Square Loyalty normally works. The app does not redeem anything by itself, so nobody can spend someone else's points by typing their number.
- **Privacy:** the app only makes a Loyalty account for a customer who leaves "Earn points" ticked. Someone who types another person's phone number can see only that number's point balance.
- **Your rewards are the ones in Square.** The "Rewards to work toward" list in the dashboard (Site info > Points) is only used when Square Loyalty is not on, and then points stay on the customer's phone.
- **Square access token:** it needs permission to use Loyalty (`LOYALTY_READ` and `LOYALTY_WRITE`). `npm run square-check` says whether your Square account has an active Loyalty program. The dashboard's Setup tab shows it too.
- **Not tested against real Square.** This was written from Square's Loyalty documentation and tried only against a stand-in. Run `npm run square-check` against your Sandbox first, then place one test order with "Earn points" ticked, mark it completed in Square, and look for the account under Square Dashboard > Loyalty.

### Tips at checkout

The order screen offers **Add a tip (optional)**: No tip, 15%, 20%, 25% (of the subtotal before tax), or Other (a typed amount). It is a **planned tip, not a charge**: the customer pays at the counter, so the tip goes on the Square order as a note on the pickup ("Tip planned: $2.70. Add it when the customer pays.") and the cashier adds it when taking payment. It never changes the order's price, and it is **not** recorded as a service charge, because Square would count that as sales instead of a tip. Tips are not counted for points. Set `TIPS=off` to hide the tip choices.

### Streak, the cup, and the little animations

- **Streak.** Home shows "3 weeks in a row" (Monday to Sunday) and which days this week had an order, counted from the orders on the customer's phone. It promises no prize. A week with no order is allowed to pass until Sunday; after that the streak starts again.
- **The cup.** After an order is placed, a cup on the order screen fills as you move the order in Square: nearly empty when sent, half full and bubbling when accepted, full and steaming when ready. In "Make it your way", a small cup follows the size, hot or iced, and milk the customer picks (only a picture: it never changes the order or price).
- **Counting points, a glowing reward, confetti** when a customer has just earned enough for a reward, hearts that sparkle, springy buttons on the web. Everything stops moving for anyone whose phone or browser is set to "reduce motion".

### Good to know

- **Where staff see it:** in your Square Dashboard under Orders, and in Square Point of Sale's order list. Whether a new order also beeps or prints
  a ticket depends on your Square plan and device settings, so check this in step 4 and set it up in Square if you want it.
- **Staff steps decide what the customer sees:** accept, mark ready, complete. If nobody touches an order in Square, the customer's screen stays on
  "Order sent". The screen says it updates when the café updates the order.
- **Prices come from the Menu tab in the dashboard,** looked up again by the server for every order, so a price you change or an item you hide applies
  immediately and the app can never set its own price. The items arrive in Square by name and price (not linked to your Square item library, so
  Square's item reports will not group them with items you ring up at the counter). Linking them is possible later by reading your Square catalog.
- **Sizes and extras** come from the menu too. A drink with a Small and a Large price shows one price box per size in the Menu tab, and the customer picks
  a size in the app. Extras that cost money (alternative milk +$1.00, a syrup +$0.50, cold foam +$0.75, breakfast add-ons, grilled chicken on a salad) and free
  choices (hot or iced, bagel or croissant, hot or regular tenders, wing sauce, dressing) are listed at the bottom of the Menu tab under **Choices and extras**,
  where you change what each costs. On each item, **Choices offered** says which of them it offers. The server adds up the size and the extras itself, and sends
  Square a line like "Latte (Large)" at the full price with the choices written on it for whoever makes the drink.
  An item that only has a price range (a low and a high price and no sizes) cannot be sent from the app, because no single price is known; the order screen says which.
- **Must-pick choices.** Choices marked required (hot or iced, bagel or croissant, hot or regular tenders, wing sauce, chicken or beef) have no default: the customer has to
  choose, and the Add and Place order buttons say what is missing. The server refuses an order that skips one.
- **Pickup time.** My order asks "As soon as possible" or "Choose a time". Times are for today only, every 15 minutes, inside your opening hours (Site info → Hours), and
  at least `PICKUP_MIN_MINUTES` from now (your prep time; empty means 30). A chosen time goes to Square as a scheduled pickup. Change the setting on your host, not in the app.
- **Points.** Customers earn `POINTS_PER_DOLLAR` points (empty means 1) for each dollar, before tax, on an order they pick up. The number comes from the order in Square once
  you complete it, so changes you make to the order at the counter count. Each order counts once. Points are kept on the customer's phone (there are no accounts), so they are
  lost if the customer deletes the app, and they are only counted while the app can check the order within 12 hours of placing it. What points can be used for is up to you:
  write it in the dashboard under Site info → Points, and it shows on the Home card. The app does not take points off at the counter.
- **Promotions.** Site info → Promotions: a title, details and an optional last day. They show at the top of Home, and none show until you add one.
- **My usual and Past orders.** A customer can save a drink the way they like it (size, milk and so on) and add it in one tap from Home, and see their last 20 orders with a
  button to order any of them again. Both are kept on the phone only.
- **Dark mode.** The app follows the phone's light or dark setting.
- **If you edited the menu in the dashboard before this version,** that saved menu wins over the file and would hide the sizes and extras. On the Menu tab the owner
  can press **Reset to the original menu** to load the menu from the café's boards (sizes, extras and all), then re-apply any price change.
- **Guards:** a phone number is required (so you can call the customer), one connection can place 5 orders a minute
  (`ORDER_RATE_LIMIT_PER_MIN`), and an order over $300 (`ORDER_MAX_DOLLARS`) is sent to the large-order quote instead. A prank order is cancelled in Square.
- **Retries are safe:** if a customer's connection drops and they tap Place order again, Square receives the same request key and makes one order.
- **How it was tested:** the whole flow, from the menu to the confirmation screen, runs in a real browser against a stand-in for Square. It has **not**
  been run against Square itself, and the request format (Square's Orders API, a pickup fulfillment, version `2024-10-17` in `server.mjs`) could not
  be checked against Square's current documentation when it was written. That is why step 4 matters: if Square refuses an order, the customer is told
  to try again or call, and the server log shows Square's error code (never the customer's details), which says what to fix.
- **Paying in the app** is described above ("Paying in the app (card, Apple Pay, Google Pay)"). It switches on when you add your Square Application ID.

---

## 7. If you want the website back

The 3D website, the Large Orders and Rent the Café pages and the Google search setup were removed because only the app is wanted.
They are still in the project's git history (the commit before "Remove the website"), so they can be restored if you change your mind.

## Good to know

- **The free plan sleeps** when idle: the first visit after a break can take about a minute.
- The app's web copy is built into `public/app`. After changing app code run `npm run build` (needs a computer or build service) and commit it.
- Tests: `npm test` (server, forms, dashboard, search data; no keys needed). Browser tests are in `e2e/` (for example `node e2e/app-live.e2e.mjs`, needs `playwright-core` and Chromium).
