# Maruf Cafe — 3D redesign

Standalone static site (no build step). Three.js is vendored in `vendor/`.

Run locally (ES modules need http, not file://):

    cd maruf-cafe && python3 -m http.server 8080

Then open http://localhost:8080. Deploy by uploading the folder to any static host.

## Placeholder content to replace
The real marufcafe.com content could not be fetched, so these are placeholders:
- Menu items and `$0.00` prices in `index.html` (`#menu`)
- Story paragraph and the three stats (`#story`)
- Address, hours and phone (`#visit`)
- Taglines in the hero and marquee
