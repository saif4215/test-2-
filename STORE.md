# Getting the Maruf Cafe app into the App Store and Google Play

The app is a real React Native app (Expo). This file is the checklist and the text to paste into the stores.
Nothing here has been submitted. Publishing needs your own accounts.

## 0. Read this first (the things most likely to cost you time)

- **The iPhone version has never been run.** All testing was done in the web version of the app. Before you submit, make a test build,
  install it through TestFlight and tap through every screen (Home, Orders, Events, Menu, Contact, Ask a question, the two forms).
  The JavaScript for iPhone does bundle without errors, but that is not the same as running on a phone.
- **The server must be online before you submit.** The forms and the chat talk to it, and App Review will open your Privacy Policy and Support links.
  See `DEPLOY.md`. A server that is asleep or erased during review is the most common reason this app would be rejected.
- **iPad screenshots.** `app/app.json` has `"supportsTablet": true`, so App Store Connect will ask for iPad screenshots (13-inch).
  Either make them, or set `ios.supportsTablet` to `false` in `app/app.json` before the first build (iPhone only; it still runs on an iPad, just not full screen).
- **Whose account?** The seller shows on the store page as whoever owns the Apple Developer account. If the buyer will run the app, they should
  publish under their own account. An app can be transferred between accounts later in App Store Connect, but it is easier to start right.
  An **organization** account needs a D-U-N-S number and takes longer to approve than an **individual** one.
- **The chat and Apple's rules.** Out of the box the chat answers from the café's own menu and details, and nothing leaves the café's server.
  If you connect a third-party AI key (Anthropic, Google, Groq, OpenRouter...), the typed questions are sent to that company. Apple's
  App Review Guidelines require you to clearly disclose that and ask permission before sharing personal data with third-party AI.
  The privacy policy now says so, but the app has no consent prompt. The simplest safe path: **launch without an AI key**, and add the
  consent prompt later if you connect one. Check the current guidelines before you do.
- **3D is web only.** The burger and the cup are not drawn in the iPhone app (that is why the screenshots below have none).

## 1. Before you build (do these first)

1. **Know your server address.** It is the https address of wherever the server runs (see `DEPLOY.md`; any host works).
   The app sends quote and event requests and chat questions there. Put it in `app/eas.json` in both places that say
   `https://REPLACE-WITH-YOUR-SERVER-ADDRESS`. If you build some other way, set `EXPO_PUBLIC_API_URL` to it.
2. **Add your real photos** (hero, food, café interior, events). Put the files in `app/assets/photos/` and set them in
   `app/src/photos.js`. Store builds hide empty photo slots instead of showing placeholders, but real photos make a far
   better listing.
3. **Add your email** in `app/src/config.js` (`business.email`), `public/privacy.html` and `public/support.html`.
   Store builds hide the "[ADD EMAIL]" line, but the privacy and support pages should have a real contact email.
4. **Keep the server on a plan that does not lose data** (or set `INQUIRY_WEBHOOK_URL` / `RESEND_API_KEY`). See `.env.example`.
5. **Retake the screenshots** after adding photos. The eight in `store/screenshots/iphone-6.9/` were taken from the current app with no photos and no 3D.

## 2. Accounts you need

| Account | Cost | For |
| --- | --- | --- |
| Apple Developer Program | $99 a year | The App Store |
| Expo (expo.dev) | Free tier | Only if you build in Expo's cloud (not needed if you build on a Mac with Xcode) |
| Google Play Console | $25 once | Google Play |

Apple and Google both verify your identity. Allow a day or two.

## 3. Build and submit

**Option A: build in the cloud** (no Mac needed). Run these on a computer (or have a developer do it):

```bash
cd maruf-cafe/app
npm install
npm install -g eas-cli
eas login
eas build --platform ios --profile production       # builds in Expo's cloud
eas submit --platform ios                           # sends it to App Store Connect
eas build --platform android --profile production
eas submit --platform android
```

**Option B: build on your own Mac** (no cloud service): `cd maruf-cafe/app && npm install && npx expo prebuild --platform ios`,
open the `ios/*.xcworkspace` file in Xcode, sign in with your Apple Developer account under Signing & Capabilities, choose
Product → Archive, then Distribute App → App Store Connect. (Standard Expo steps; not run here.)

Test first with `eas build --profile preview` and TestFlight (iPhone) or an internal test (Android).
The app ids are `com.marufcafe.app` (change them in `app/app.json` before the first build if you want others).

## 4. App Store Connect text

- **Name:** Maruf Cafe
- **Subtitle (28/30):** Large orders & event rentals
- **Promotional text (133/170):** Feeding a crowd or planning a party? Request a quote for large orders and catering, or ask about renting Maruf Cafe in Staten Island.
- **Keywords (91/100):** cafe,coffee,catering,large orders,event space,party,birthday,venue,Staten Island,group food
- **Category:** Food & Drink
- **Price:** Free
- **Age rating:** 4+ (answer "None" to every content question)
- **Copyright:** 2026 Maruf Cafe
- **Support URL:** `https://YOUR-SERVER-ADDRESS/support`
- **Privacy Policy URL:** `https://YOUR-SERVER-ADDRESS/privacy`
- **App icon:** `app/assets/icon.png` (1024 × 1024, no transparency: ready)
- **Review contact (you type this in App Store Connect):** a real name, phone number and email that Apple can reach during review
- **Marketing URL (optional):** https://www.marufcafe.com

**Description**

> Maruf Cafe in Staten Island makes it easy to feed a crowd or host your next gathering.
>
> • Large orders: tell us your date, group size and what you'd like, and we'll put a quote together. Great for family gatherings, birthdays, business meetings, school and community events, and holidays.
> • Catering for every occasion: birthday parties, business catering, family gatherings, community events and holiday events.
> • Rent our space: ask about private events, engagements, private dinners and celebrations. Send your date and guest count and we'll follow up about availability and pricing.
> • Group-size planner: enter your number of guests to plan your food. Maruf Cafe confirms quantities and pricing with you.
> • Menu: coffee, refreshers, tea, breakfast, sandwiches, burgers, wings, sides and sweets, with prices. Build an order list and send it with your quote request, or continue to our Square Online store to order pickup.
> • Ask a question: quick answers about the menu and prices, our hours, large orders and renting the café.
> • Hours, address, phone and directions in one tap.
>
> No account needed.

**App Privacy answers** (App Store Connect → App Privacy)

- Data collected: **Contact Info** (name, email address, phone number) and **Other User Content** (the details typed into a request, and questions typed into the chat).
- Purpose: **App Functionality**.
- Linked to the user's identity: **Yes**.
- Used for tracking: **No**.
- No other data types are collected.
- If you connect a third-party AI service for the chat, the chat questions also go to that service. Keep the privacy policy (`/privacy`) in step, and see section 0.

**App Review notes** (paste into the review notes box)

> No sign-in is needed. The app shows the café's menu, hours and contact details, a group-size planner, and two request forms (Orders → "Get a large order quote", and Events → "Check event availability"). Submitting a form sends the customer's request to the café's server and shows a confirmation. "Ask a question" on the Home screen is a chat that answers from the café's own menu and details. "Order pickup on Square Online" opens the café's existing web store in the browser. There is no in-app payment and no account.

**Screenshots:** `store/screenshots/iphone-6.9/` (eight files, 1320 × 2868: Home, Orders planner, Events, Menu, Ask a question, My order, quote form, thank-you). Apple scales these for smaller iPhones. They are taken from the web version of the app at phone size, which looks the same as the iPhone version for these screens, but replace them with real iPhone screenshots from your TestFlight build if you can. iPad screenshots: see section 0.

## 5. Google Play text

- **App name:** Maruf Cafe
- **Short description (69/80):** Large orders, catering and event rental at Maruf Cafe, Staten Island.
- **Full description:** use the App Store description above.
- **Category:** Food & drink
- **Icon:** `public/icon-512.png` (512 × 512)
- **Feature graphic:** 1024 × 500 (not made yet)
- **Data safety:** collects name, email address and phone number, plus the request details typed in, for app functionality. Not shared with third parties. Encrypted in transit (HTTPS). Users can ask the café to delete their request.
- **Content rating:** answer "No" to every content question.

## 6. Things that commonly get an app rejected

- **Placeholder content.** Fixed in store builds (placeholders are hidden). Still, add real photos.
- **"Looks like a website" (Apple guideline 4.2).** This is a native app with a planner, an order list and request forms, but
  Apple decides. If it is rejected, reply with the review notes above and, if you can, add something customers use often.
- **Missing privacy policy / support page.** Both are included at `/privacy` and `/support` once the server is online.
- **Broken server link.** The forms and the chat need your server to be running. Keep it on a plan that stays awake during review.
- **Things that only show up on a real iPhone.** Keyboard covering a form field, a button under the home bar, a link that does nothing. Fix these from your TestFlight run, not after a rejection.

This is not legal advice. Have someone you trust read the privacy policy before you publish.
