# Put Maruf Cafe online, set it up, and run it day to day

This one server runs everything: the phone app (`/app/`), the staff dashboard (`/admin/`) and the backend for quote and event requests.
It needs **Node 22.12 or newer** and no `npm install` (the database is built into Node).

You can do all of this from a phone. Part 1 gets it online. Part 2 makes sure **you never miss a request**. Part 3
is the dashboard. Part 4 is the list of things only the café can fill in.

---

## 1. Get it online (Render, about 10 minutes)

1. On your phone open **render.com**, tap **Sign up** and use your email and a password (GitHub is not needed). Open the
   verification email Render sends.
2. Tap **New** then **Web Service**, open the **Public Git Repository** tab, paste `https://github.com/saif4215/test-one`
   and tap **Continue**. (Render does not redeploy by itself for a public-repository service: tap **Manual Deploy** after changes.)
3. Fill in:
   - **Name:** `maruf-cafe`
   - **Branch:** `claude/maruf-cafe-redesign-5ulf0y`
   - **Root Directory:** `maruf-cafe`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.mjs`
   - **Instance Type:** Free to try, **Starter** (paid) to keep requests safely (see Part 2)
4. Under **Environment Variables** add (names are exact):

   | Name | Value | Why |
   |---|---|---|
   | `NODE_VERSION` | `22` | the built-in database needs Node 22 |
   | `ADMIN_PASSWORD` | a long password you choose (**10+ characters**) | switches the staff dashboard on |
   | `PUBLIC_URL` | `https://maruf-cafe.onrender.com` (your real address, no slash at the end) | links in emails and the sitemap |
   | `RESEND_API_KEY`, `NOTIFY_EMAIL` | see Part 2 | email alert for every request |

   Optional: `STAFF_PASSWORD` (a second sign-in for staff, 10+ characters), `STAFF_CAN_EDIT_SITE=1` (lets staff also edit site info and photos; they can already edit the menu). The full list with
   explanations is in `.env.example`.
5. Tap **Create Web Service** and wait for **Live**. Your address looks like `https://maruf-cafe.onrender.com`:
   - `/app/` the phone app (the plain address `/` sends people there), `/admin/` the dashboard.
6. Add the app to your home screen: iPhone Safari → Share → **Add to Home Screen**; Android Chrome → menu → **Install app**.

Nothing is stored in your GitHub repository: requests, edits and photos live only on the server (in `DATA_DIR`).

---

## 2. Never miss a request (important)

When a customer sends a quote or event request the server **saves it in its database first, then emails you**. The app
only says "received" after that worked. If nothing could be saved and no email/webhook could be sent, the customer
is told it failed and is given your phone number. A form never pretends to work.

**Render's free plan has temporary storage.** Anything saved (the database, uploaded photos, menu edits) is erased
whenever the service restarts or redeploys, which happens regularly. So:

- **Always set up email alerts** (below). The email is your permanent copy of every request.
- When you are ready to rely on the dashboard, move the service to a **paid instance** and add a **Persistent Disk**
  (Render → your service → **Disks**, mount path `/var/data`), then set `DATA_DIR=/var/data`. Check Render's pricing page
  for the current cost. Until then, use the dashboard as an inbox and keep the emails.
- Back up any time: dashboard → Requests → **Download spreadsheet**.

### Email alerts with Resend (free tier is enough)

1. Create an account at **resend.com**. Open **API Keys → Create API Key** (permission: *Sending access*). Copy the key.
2. In Render add `RESEND_API_KEY` = that key and `NOTIFY_EMAIL` = the address that should receive requests
   (several allowed, separated by commas).
3. **Quick test:** leave `NOTIFY_FROM` empty. Resend then sends from `onboarding@resend.dev`, which only delivers to the
   email address you used to sign up at Resend. So use that same address for `NOTIFY_EMAIL`.
4. **For real use:** in Resend open **Domains → Add Domain** (the café's own domain), add the DNS records it shows at your
   domain provider, wait until it says *Verified*, then set `NOTIFY_FROM` to e.g. `Maruf Cafe <requests@your-domain.com>`.
5. Send yourself a test request from the app. You should get an email with all the details; **Reply** goes to the customer.

The key lives only in Render's settings. It is never in the code and never sent to a browser.

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
| **Menu** | change names, prices (single price or low/high), descriptions, hide items, add or delete items. Hidden items disappear from the app and from online checkout. | owner and staff |
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
2. In Render add `ANTHROPIC_API_KEY` = that key. (Optional: `ASSISTANT_MODEL`; the default is `claude-haiku-5-5`, the fast low-cost model.)
3. Redeploy. The "Ask Maruf Cafe AI" button on the app's Home screen now opens a chat.

### Free option (any OpenAI-style service)

No AI is completely free without an account, because every service needs a key so it knows who is asking. But several
services (for example **Groq**, **OpenRouter** and **Google Gemini**) offer a free tier with a free key, and they all work here:

1. Sign up on the service's website and create an API key (no card needed on most free tiers; check theirs).
2. In Render add three variables instead of `ANTHROPIC_API_KEY`:
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

## 6. Payments and bookings

- **Quote and event requests collect no money and confirm nothing.** Every page says so. Take payment and confirm dates yourself,
  after you have decided your deposit and cancellation rules, and write them under Site info → Rent the café.
- **Square card checkout** is a leftover from the old website. The app does not use it (it links to your Square Online store instead), so leave it off. If you ever want it, it is separate and optional. It stays off until you set
  `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID` and `SQUARE_APP_ID`. Start with `SQUARE_ENV=sandbox` and Square's test cards, set
  `TAX_PERCENT`, and only then switch to `production`. It has been tested against a mock of Square, not Square itself.
  Checkout always uses the live menu, so a price you change or an item you hide applies to checkout immediately.

---

## 7. If you want the website back

The 3D website, the Large Orders and Rent the Café pages and the Google search setup were removed because only the app is wanted.
They are still in the project's git history (the commit before "Remove the website"), so they can be restored if you change your mind.

## Good to know

- **The free plan sleeps** when idle: the first visit after a break can take about a minute.
- The app's web copy is built into `public/app`. After changing app code run `npm run build` (needs a computer or build service) and commit it.
- Tests: `npm test` (server, forms, dashboard, search data; no keys needed). Browser tests are in `e2e/` (for example `node e2e/app-live.e2e.mjs`, needs `playwright-core` and Chromium).
