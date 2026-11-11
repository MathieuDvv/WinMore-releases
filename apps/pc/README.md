# PC Monitor

Version 1.1.0 provides Overview, Temperatures and Network pages using the existing
schema screen. Tap the page buttons; no phone update is required.

The volume slider and mute switch control the default Windows playback device's
master volume, including audio from every application. They do not change the
YouTube Music player's volume. The bundled Core Audio helper is intentionally
self-contained so installing this package does not require the Mixer package.

CPU load updates every two seconds. Sensors and network counters update every
five seconds. Network rates are bytes per second per connected adapter, averaged
between samples; the first sample displays Measuring. Totals are Windows adapter
counters since reset, not monthly usage. Virtual adapters can overlap physical
adapter traffic, so values are shown individually rather than summed.

Temperatures come from Libre Hardware Monitor or Open Hardware Monitor's WMI
sensor provider when running. Otherwise the package tries firmware ACPI thermal
zones, explicitly labelled as such. Unsupported or inaccessible readings display
Unavailable; no CPU/GPU temperatures are estimated from load.

Run `npm run pack:apps` at the repository root to produce `catalog/pc.wmapp`.
