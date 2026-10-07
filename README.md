# Maruf Cafe — 3D redesign

Standalone static site (no build step). Three.js is vendored in `vendor/`.

Run locally (ES modules need http, not file://):

    cd maruf-cafe && python3 -m http.server 8080

Then open http://localhost:8080. Deploy by uploading the folder to any static host.

## Content
- The menu (all categories, items and prices) is the `MENU` object at the top of `main.js`, copied from marufcafe.com. Edit it there. The burger blurb in `index.html` (`#burger`) repeats the two burger prices.
- "Order online" and "Gift cards" link to the cafe's real pages on marufcafe.com.

## Still to fill in
- Address, hours and phone (`#visit` in `index.html`, marked with dashed outlines). They were not in the content provided.
- Instagram and TikTok links currently point to the platforms' home pages. Replace the `href`s (search `instagram.com` and `tiktok.com` in `index.html`, 3 places each) with the cafe's profile URLs.
