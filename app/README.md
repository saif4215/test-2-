# Maruf Cafe app

A phone app (iPhone and Android) for Maruf Cafe, focused on large orders, catering, event rental and easy contact.
Built with Expo and React Native. The same code also exports to a web app.

Screens: Home · Orders (large orders, catering, group-size calculator) · Events (venue rental, event options) ·
Menu (with an order list) · Contact (with FAQ). Two forms open as sheets: the large order quote form and the event
rental form.

## Run it on your phone (no accounts needed)

```bash
cd maruf-cafe/app
npm install
EXPO_PUBLIC_API_URL=https://YOUR-SERVER npx expo start
```

Install **Expo Go** on your phone and scan the QR code. `npx expo start --web` runs it in a browser.

## Where requests go

The forms send to the Node server in `../server.mjs` (`POST /api/inquiry`). It stores each request, and can notify you
by email and/or a webhook. See `../.env.example`. Set `EXPO_PUBLIC_API_URL` to that server's address when you run or
build the app. Without it the forms cannot send, and the app says so and offers the phone number. It never shows
"Thank you" unless the server confirmed it saved the request.

Staff read and manage requests at `https://YOUR-SERVER/admin/` (set `ADMIN_PASSWORD` on the server).

The app also loads the live menu (`/menu.json`) and the café's details, FAQ, event options, photos, gallery and reviews (`/content.json`) from that server, so edits made in the dashboard show up in the app. If the server cannot be reached, the app uses the copy built into it (`src/config.js`, `src/data/menu.json`). The web copy served at `/app/` uses the same server automatically.

## Edit it without touching code

| What | Where |
| --- | --- |
| Address, phone, email, hours, social links | the dashboard (Site info), or `src/config.js` → `business` as the built-in fallback |
| Occasions, catering cards, venue cards, event options, FAQ | `src/config.js` |
| Calculator serving sizes and prices | `src/config.js` → `calculator` (null means "Maruf Cafe will confirm") |
| Menu items and prices | `src/data/menu.json` (prices in cents; add `"desc": "..."` to show a description) |
| Photos | put files in `assets/photos/`, then set the slot in `src/photos.js` |

`src/data/menu.json` is a copy of `../public/menu.json` (the live menu). Keep them in step when the menu changes.

## Photos

Every photo slot shows a tidy placeholder until you add a picture, so nothing looks broken. Slots: `hero`,
`largeOrders`, `catering`, `interior`, `interior2`, `event` and one per catering card. When the café adds a `hero` photo (here or in the dashboard) it replaces the food collage at the top of Home.

## Look and feel

The Menu tab works like a delivery app: a search bar and category buttons stay at the top while you scroll down through one row per category. Swipe a row sideways for its items, or tap See all to open it as a grid (`MenuPage` in `src/components/MenuBrowser.js`). On computers each row also has left and right buttons.

Tap any item for a bigger view with its price, description and an Add button (`src/app/item.js`). My order shows each item with its picture and a counter. Pull down on a screen in the phone app, or come back to the app after a minute, and the menu and details are loaded again, so the café's edits appear without reinstalling or restarting. Contact has a Share button that sends the café's name, address, phone and order link (`src/lib/share.js`).

The app also borrows a few habits that people know from big café and delivery apps, built in Maruf Cafe's own look: a greeting by time of day, a "Pickup at" bar with the address and whether the café is open (`src/components/StoreBar.js`), a heart on each item that fills **Your favorites**, **Order again** with an Add all button (the items of the last order sent), a note per item that travels with the quote request, and "More from Maruf Cafe" cards for catering, renting the café and the social pages. Favorites and recent orders are kept on the phone only (`src/lib/memory.js`, using AsyncStorage; the browser's own storage on the web). There are no rewards, points or in-app payments, because the café does not run any.

Colours, radii, shadows and type sizes are in `src/theme.js`. Headings use the DM Serif Display font (`assets/fonts/`, SIL Open Font License, copy in `assets/fonts/OFL.txt`); body text uses the phone's own font. The food pictures in the Home collage (`assets/hero/`) and beside menu items (`assets/menu/`) are 3D renders of generic dishes, not photos of the café's food.

## Put it in the App Store and Google Play
See `../STORE.md` for the full checklist, the store text to paste, and screenshots.


You need an Apple Developer account ($99 a year) and a Google Play developer account ($25 once).

```bash
npm install -g eas-cli
eas login
eas build --platform all     # builds in the cloud, no Xcode or Android Studio needed
eas submit --platform all
```

The bundle ids are `com.marufcafe.app` (change them in `app.json` if you prefer another). Review times and store
rules are up to Apple and Google.

## Tests

```bash
npm test                     # dates, form checks, calculator, open-now badge
npx expo export --platform web
```

The server has its own tests: `cd .. && node --test server.test.mjs`.

## What this app does not do yet

- **No card payments in the app.** "Add to Order" builds an order list. From it, customers can send a quote request
  with those items or open your Square Online store to pay. Taking cards inside the app needs Square's native
  payment SDK and a custom build.
- **Prices are never invented.** Event packages show no prices. The calculator shows quantities and totals only when
  you provide serving sizes and prices.
- **Menu photos and descriptions** are empty because none were provided. Until the café adds its own, each item shows a generic 3D-rendered picture of its kind of food (`assets/menu/`, chosen by `src/lib/menu-art-key.js`); these are not photos of the café's food.
- **FAQ:** the first answer is the wording you gave. The others were written to be neutral and should be reviewed.
- **Not yet run on a real phone.** It was tested as a web build in a phone-sized browser and with unit tests.
  Try it in Expo Go before publishing.


## 3D models (web app only)
`src/three/` holds the 3D burger (`burger.js`) and the Maruf paper cup (`cup.js`: an open cup with coffee and MARUF poured on top, the logo on both sides, and a logo lid beside it whose sip flap opens and shuts), drawn with three.js. They are loaded only on the web build
(`src/components/Model3D.web.js`) the first time they scroll into view, draw only while visible, free their graphics memory when closed, and are skipped on phones without a web view
(`Model3D.js` is an empty stand-in for the iPhone/Android store builds). If a device cannot run WebGL the section simply does not appear.
