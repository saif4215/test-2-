# Getting the Maruf Cafe app into the App Store and Google Play

The app is a real React Native app (Expo). This file is the checklist and the text to paste into the stores.
Nothing here has been submitted. Publishing needs your own accounts.

## 1. Before you build (do these first)

1. **Find your server address.** On Render: your service → Logs (bottom) or Settings. It ends in `.onrender.com`.
   The app sends quote and event requests there. Put it in `app/eas.json` in both places that say
   `https://REPLACE-WITH-YOUR-RENDER-ADDRESS`.
2. **Add your real photos** (hero, food, café interior, events). Put the files in `app/assets/photos/` and set them in
   `app/src/photos.js`. Store builds hide empty photo slots instead of showing placeholders, but real photos make a far
   better listing.
3. **Add your email** in `app/src/config.js` (`business.email`), `public/privacy.html` and `public/support.html`.
   Store builds hide the "[ADD EMAIL]" line, but the privacy and support pages should have a real contact email.
4. **Keep the server on a plan that does not lose data** (or set `INQUIRY_WEBHOOK_URL` / `RESEND_API_KEY`). See `.env.example`.
5. **Retake the screenshots** after adding photos. The drafts in `store/screenshots/iphone-6.9/` have no photos.

## 2. Accounts you need

| Account | Cost | For |
| --- | --- | --- |
| Expo (expo.dev) | Free | Building the app in the cloud |
| Apple Developer Program | $99 a year | The App Store |
| Google Play Console | $25 once | Google Play |

Apple and Google both verify your identity. Allow a day or two.

## 3. Build and submit

Run these on a computer (or have a developer do it). No Mac is needed for iPhone builds.

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
- **Support URL:** `https://YOUR-RENDER-ADDRESS/support`
- **Privacy Policy URL:** `https://YOUR-RENDER-ADDRESS/privacy`
- **Marketing URL (optional):** https://www.marufcafe.com

**Description**

> Maruf Cafe in Staten Island makes it easy to feed a crowd or host your next gathering.
>
> • Large orders: tell us your date, group size and what you'd like, and we'll put a quote together. Great for family gatherings, birthdays, business meetings, school and community events, and holidays.
> • Catering for every occasion: birthday parties, business catering, family gatherings, community events and holiday events.
> • Rent our space: ask about private events, engagements, private dinners and celebrations. Send your date and guest count and we'll follow up about availability and pricing.
> • Group-size planner: enter your number of guests to plan your food. Maruf Cafe confirms quantities and pricing with you.
> • Menu: coffee, refreshers, tea, breakfast, sandwiches, burgers, wings, sides and sweets, with prices. Build an order list and send it with your quote request, or continue to our Square Online store to order pickup.
> • Hours, address, phone and directions in one tap.
>
> No account needed.

**App Privacy answers** (App Store Connect → App Privacy)

- Data collected: **Contact Info** (name, email address, phone number) and **Other User Content** (the details typed into a request).
- Purpose: **App Functionality**.
- Linked to the user's identity: **Yes**.
- Used for tracking: **No**.
- No other data types are collected.

**App Review notes** (paste into the review notes box)

> No sign-in is needed. The app shows the café's menu, hours and contact details, a group-size planner, and two request forms (Orders → "Get a large order quote", and Events → "Check event availability"). Submitting a form sends the customer's request to the café's server and shows a confirmation. "Order pickup on Square Online" opens the café's existing web store in the browser. There is no in-app payment.

**Screenshots:** `store/screenshots/iphone-6.9/` (1320 × 2868). Apple scales these for smaller iPhones.

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
- **Broken server link.** The forms need your server to be running. Keep it on a plan that stays awake during review.

This is not legal advice. Have someone you trust read the privacy policy before you publish.
