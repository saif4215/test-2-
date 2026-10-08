# Put the Maruf Cafe app online (phone only)

This puts the phone app and the request server at one web address. Open the address on any phone and add it to the
home screen. No computer needed. The built app is already in `public/app`, so the host has nothing to build.

You'll use **Render** (render.com). Its free plan is enough to try it.

1. On your phone, open **render.com** and sign up with **GitHub** (the account that has this project).
2. Tap **New** then **Web Service**. Choose the repository **test-one**. Allow Render to see it if asked.
3. Fill in:
   - **Name:** `maruf-cafe` (this becomes part of your address)
   - **Branch:** `claude/maruf-cafe-redesign-5ulf0y`
   - **Root Directory:** `maruf-cafe`
   - **Language / Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.mjs`
   - **Instance Type:** Free
4. Under **Environment Variables** add:
   - `NODE_VERSION` = `22`
   - `ADMIN_PASSWORD` = a password you choose (lets you read requests at `/admin/requests`)
5. Tap **Create Web Service** (or Deploy). Wait until it says **Live** (a few minutes).
6. Open your address, which looks like `https://maruf-cafe.onrender.com`, and add `/app/` on the end.
7. Add it to your home screen:
   - iPhone (Safari): tap Share, then **Add to Home Screen**.
   - Android (Chrome): tap the menu (three dots), then **Add to Home screen** or **Install app**.

## Good to know

- **The free plan goes to sleep** when nobody uses it. The first open after a break can take about a minute.
- **Requests are saved on temporary storage** on the free plan, so they can disappear when the service restarts or
  redeploys. To be safe, also set one of these environment variables so every request reaches you:
  `INQUIRY_WEBHOOK_URL` (a Slack, Zapier or Make webhook), or `RESEND_API_KEY` + `NOTIFY_EMAIL` (email). See `.env.example`.
- **Read your requests** at `https://YOUR-ADDRESS/admin/requests`. Sign in with any username and your `ADMIN_PASSWORD`.
- The 3D café website is at the main address (`/`). The phone app is at `/app/`.
- If you change the app's code, rebuild it with `npm run build` (needs a computer or a build service) and commit the
  updated `public/app` folder. Render redeploys by itself when the branch changes.
