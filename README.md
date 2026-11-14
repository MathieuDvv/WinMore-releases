# Onbun releases

Downloads for Onbun (formerly WinMore). The source code is private; this repository only holds what installed copies fetch:

- `index.json` and `apps/<id>/`: the app catalog shown in Onbun's **Settings → Library**. Each app is a plain folder; `bundles/` holds single-file copies for older versions.
- `docs/`: the website, https://mathieudvv.github.io/WinMore-releases/, served by GitHub Pages.
- [Releases](https://github.com/MathieuDvv/WinMore-releases/releases): Onbun for Windows (`Onbun-Setup-<version>.exe`), macOS (`.dmg` to install, `.zip` for in-app updates; `arm64` for Apple silicon, `x64` for Intel) and Linux (`.AppImage` or `.deb`), plus the Android app and the iOS build when present. Onbun checks the latest release and updates itself. Files named `WinMore-…` are identical copies for installs from before the rename.

Apps and updates run on your PC with Onbun's access. Only the owner of this repository publishes them.
