# Onbun website

Run `npm run site` from the repository root and open `http://localhost:4400/`.

All three pages use the shared dark, monochrome treatment in `assets/night.css`.
The island is the only header navigation. The home hero contains only the island,
its animated limbs and a scroll icon. The historical ASCII backgrounds are hidden
at the start, reveal with the opening scroll, and then remain fixed.

## Motion and artwork

- `assets/island.js` draws the arms in viewport coordinates. Control points depend
  on the remaining distance to the wrist, keeping the pull smooth as it rises.
- Legs and outward-facing shoes move upward through an SVG clip exactly at the
  island's lower edge. There is no opacity change. Near the dock, the fingers
  release their grip and the complete arms withdraw above the viewport.
- `assets/hose.js` supplies native SVG limbs and monochrome, full-width separators.
  Separator curves are tangent-continuous and enter from outside the viewport.
  Scrolling stretches them from a short 18% reach to about 82% by the viewport
  center while changing their bend, reaching roughly four-fifths across while leaving the opposite edge
  open. Only visible separators update, with one animation frame per
  scroll event batch; there is no idle loop. Reduced motion keeps a still
  shape. Geometry uses the container’s actual size so hands and shoes fit.
- `assets/yokai-background.js` renders the supplied historical sculpture photo as
  two independent, DPR-aware ASCII canvases. Editable outlines and crop bounds
  are in `assets/art/sculpture-masks.json`. Neutral wall pixels are suppressed by
  the renderer; the original photo is kept intact.
- The two figures from the supplied Kuniyoshi print are selected together with
  an editable compound mask and rendered as one ASCII composition. That canvas
  overlaps the app store’s Make an app box, with a linked credit. It renders at
  the display pixel ratio, with responsive placement rather than a CSS-scaled
  bitmap. The home introduction explains the Ashinaga/Tenaga partnership and
  its relationship to Onbun.

Reduced motion disables the decorative background fade and limb overlay.
Hover, tap, and keyboard interactions still open the island's demo and site menu.
Scroll backward to reverse the whole sequence.

Category artwork lives in four standalone SVGs named `assets/art/category-*.svg`.
The store uses each category's exact original on its matching app cards, layered
over colored backgrounds with one faint historical ASCII figure. Figure, color,
position, and opacity are picked once per app per page load, and retained while
searching and filtering. Both the SVG objects and background palettes are editable.

The store has four functional categories: Music & audio, Desktop, Social, and
Tools. Existing app IDs are mapped in `assets/store.js`; a community listing
can specify `category` (`audio`, `desktop`, `social`, or `tools`). Collection
filters, text searches, and category filters can be combined.

`scripts/build-site.cjs` generates the app data, icons, and downloadable
developer packages. Generated files in `data/`, `apps/`, and `packages/` are
ignored by Git and rebuilt before publishing the site.

## Store collections

Edit `store.json` to curate the store:

- `developerApps` lists first-party app folder IDs outside the default collection.
  Their manifests and downloadable `.wmapp` packages are built from `apps/<id>/`.
  They stay in this collection if the default catalog is later repacked.
- All other entries in `catalog/index.json` appear as default apps on both pages.
- `bundles` groups existing app IDs under a theme. These are editorial collections,
  not an installable package or a popularity ranking.
- `communityApps` starts empty. To publish an accepted submission, add a listing
  here and rebuild/publish the site. For example:

```json
{
  "id": "my-app",
  "name": "My app",
  "description": "What the app does.",
  "version": "1.0.0",
  "author": "creator",
  "repository": "https://github.com/creator/my-app",
  "platforms": ["win32", "darwin", "linux"]
}
```

The publishing form validates a creator's GitHub repository and prepares a
prefilled issue in `MathieuDvv/WinMore-releases`. Creators continue to GitHub
and submit the issue themselves. This requires Issues to be enabled on the
public repository. Listings are curated in `communityApps`; the static site
does not automatically publish submissions or store account data.

Run `npx electron tests/site-live.cjs` for browser behavior, package validation,
responsive layout checks, and screenshots in `artifacts/store-*.png` and `artifacts/onbun-*.png`.
