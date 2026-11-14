# Weather for WinMore

A native weather app with two separate themes, an hourly forecast and a seven-day outlook with temperature ranges. Includes daily details, humidity, wind, sunrise/sunset and UV. Uses only the existing WinMore Kit. No desktop, iPhone or Android rebuild, API key, sign-in, browser extension or extra dependency is needed.

Version 1.3.1 uses WinMore’s native app backdrop, floating toolbar and card components, with an outline sun-and-cloud navigation glyph matching the other app icons. The content is transparent, so the background fills the host’s rounded frame and margins instead of stopping at an inset rectangle. No phone renderer or companion change is needed.

**Apple** uses [Apple Weather’s sky colors, centered temperature hierarchy and forecast ranges](https://support.apple.com/en-in/guide/iphone/iph1ac0b35f/ios), with conventional colored weather symbols. **Nothing** uses a charcoal native backdrop, monochrome range bars, a slim hourly chart and large, evenly spaced white dots inspired by [Nothing Weather](https://nothing.community/d/24741-new-weather-app-is-still-missing-in-nothing-os-30?page=2). Both themes use native cards and floating glass controls. Nothing artwork has no faint grid or tiny filler dots. All included artwork is original.

Choose **Apple** or **Nothing** in **… → Settings → Appearance**, or directly from the **…** menu. Apple is the default. The choice is remembered across app restarts, shared across connected phones and available in PC Settings. Switching themes never triggers another weather request. Clear, overcast, fog, rain, storms, snow, night, dawn and dusk have distinct sky treatments in the Apple theme. Nothing stays monochrome for every condition.

## Install now

In WinMore on your PC, open **Settings → Apps → Install from file…** and select `Weather-1.3.1.wmapp`. Installing this newer version replaces the older Weather package while keeping your saved cities, units and theme. On versions with folder installation, choose **Install folder…** and select this `weather` folder. You can also copy the folder into the apps folder opened from PC Settings. WinMore reloads installed apps automatically.

Open **Weather** on your phone. Paris is the starting city, not a detected location. Tap **+** to search by city or postal code; select a result to save and open it. The city menu switches between your saved places. Tap a day for details. Preferences let you change units or remove the current city. Keep at least one city; up to eight can be saved. City selection and units are shared across connected phones and can also be changed from PC Settings → Weather.

## Data and offline use

Forecasts come from [Open-Meteo](https://open-meteo.com/en/docs); city search uses [GeoNames via Open-Meteo](https://open-meteo.com/en/docs/geocoding-api). This package uses the public API for personal, non-commercial use under [Open-Meteo’s terms](https://open-meteo.com/en/terms). Commercial distribution/use needs an appropriate provider subscription and integration. Attribution is visible in the app.

Only the PC contacts the weather provider. Refreshes run in the background every 15 minutes while Weather or its settings are open. Pull to refresh or tap the refresh button for an immediate update. Requests time out after 12 seconds; automatic retries wait at least one minute. Forecasts, cities and units stay in `app-data/weather/weather.json` inside WinMore’s private data directory. No phone location permission, IP location lookup or account is used.

Saved forecasts remain visible after restarting offline, clearly marked when the provider is unavailable or the data is stale. Forecast hours move forward with the clock. Dates and times use the selected city’s time zone, including DST; °F also changes wind to mph. A missing reading displays a dash. These are model estimates, not official weather warnings.

## Development and verification

From the WinMore checkout:

```powershell
node scripts/weather-screen.cjs
node scripts/check-apps.cjs apps/weather
node --test tests/weather.test.cjs
node scripts/pack-weather.cjs
```

`scripts/weather-assets.cjs` regenerates the original weather artwork using the existing Electron installation. All phone layout, forecast ranges, navigation, search and controls are native Kit; no web block or renderer change is used. `backdrop.cjs` supplies a tiny three-band PNG to the existing `screen.backdrop` binding; the native renderer paints the full background. Source SVGs are included alongside PNGs for editing. `scripts/weather-preview.cjs` includes an approximation of WinMore’s outer frame, margins, native toolbar and navigation rail when exporting Apple and Nothing layouts.

Tests cover native backdrop/toolbar/card structure, valid backdrop PNGs, background refresh, network failures, saved forecasts, theme persistence, unit conversion, location/time-zone differences, DST, city switches with requests arriving out of order, invalid data, app shutdown and installation into a temporary WinMore profile. Documentation-renderer previews are approximate; physical-phone rendering has not been checked here.
