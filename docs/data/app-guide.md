# Building Onbun apps

A Onbun app is **a folder**. It runs on the PC, and its phone screen is described in JSON and drawn
natively by each phone app: SwiftUI and Liquid Glass on phone, Compose and Material 3 Expressive on Android.
Installing, updating or editing an app never needs a new phone build: the phone loads each app's screen from
the PC and reloads it whenever the app changes.

## One app, every phone: the phone apps are renderers

This is the rule everything else follows. **Apps run on the PC; the phone apps only draw.**

- An app is written once. There is no phone or Android version of an app, and an app never checks which
  phone draws it. The same `screen.json` and backend serve every phone.
- A screen names components (`button`, `picker`, `slider`…); each phone draws its own native version of
  them (a Liquid Glass button on phone, a Material button on Android). Layout rules (stacks, frames, `fill`,
  `chrome`) mean the same thing on every phone.
- When an app looks wrong on one phone, the fix goes in that phone's renderer, or in the component library and
  this documentation for every renderer — never in the app, and never as a phone-specific workaround inside
  an app's screen.
- When an app needs something the components can't express, add it to the library (see
  [Changing the component library](#changing-the-component-library)) so every app gets it, or use `web` for a
  block that must look identical everywhere.

- [Component reference](components.md): every component, prop, action and operator (generated).
- [screen.schema.json](screen.schema.json): JSON Schema for `ui/screen.json`, for editor and agent autocomplete.
- [Template app](template/hello): a complete small app to copy.

## The folder

```
hello/                     the folder name must equal the app id
├── manifest.json          id, name, version, entry, "ui": "kit"
├── index.cjs              activate(): data() and command() — runs on the PC
├── lib/…                  any other backend code (only the PC sees it)
├── ui/
│   ├── screen.json        the phone screen, built from kit components
│   └── chart.html         optional web blocks, scripts, styles
├── assets/…               images, fonts, video the screen uses ("assets/logo.png")
├── icon.svg / icon.png    the app's glyph (PC settings / phone app bar)
```

Only `ui/`, `assets/` and the icons reach the phone. Set `"public": ["ui", "assets", "media"]` in the
manifest to share other folders.

### manifest.json

```json
{
  "id": "hello",
  "name": "Hello",
  "shortName": "Hello",
  "version": "1.0.0",
  "description": "What it does, in one sentence.",
  "entry": "index.cjs",
  "ui": "kit",
  "screen": "ui/screen.json",
  "symbol": "hand.wave",
  "icon": "icon.svg",
  "iconPNG": "icon.png",
  "updates": "your-name/hello"
}
```

`updates` (optional) is the GitHub repository your app updates from, as `owner/name` or its
`https://github.com/…` address. Attach the app's `.wmapp` to each GitHub release and tag it with the
version (`v1.2.0`); Onbun picks up the newest release like any catalog update. Apps from the catalog leave
it out, and an app installed from GitHub remembers its repository even without it.

`symbol` is the SF Symbol the phone shows until `iconPNG` arrives. `platforms` lists the PC systems the app runs on: any of `"win32"` (Windows), `"darwin"` (macOS) and `"linux"`. Leave it out for all three. The island's Library shows a small Windows, macOS or Linux icon for each one, and an app can't be installed on a system it doesn't list. `"required": true` keeps a built-in app installed: its Remove button is hidden (Onbun ships Browser this way, so there is always an app).

## The backend (runs on the PC)

```js
function activate(ctx){
  // ctx.dataDir: a folder for this app's files. ctx.electron, ctx.log, ctx.app.version are there too.
  return {
    data(context){ return {count: 3, items: [...]}; },   // what the screen's bindings read
    command(action, value){ /* … */ return result; },     // what the screen's actions send
    close(){}                                             // stop timers, close windows
  };
}
module.exports={activate};
```

- `data()` is called while your app is on screen (every 1.5 s by default; set `refresh` in the screen).
  The PC only sends it to the phone when it changed. For big data, include a `revision` that changes
  whenever the data does; Onbun then skips comparing it.
- `command()` may be `async`. Whatever it returns reaches the phone (`"result"` in an action, or the
  promise in a web block). Throw an `Error` with a readable message and the phone shows it.
- Keep work that takes seconds in the background and report progress through `data()` (for example a
  `loading` flag), so commands answer quickly.

### Notifications

Tell the user something happened while your app isn't open:

```js
const note = ctx.notifications.post({title: 'Build finished', body: 'main · 2 min'}); // returns its id
ctx.notifications.post({id: 'inbox', title: '3 new messages'});  // the same id replaces the earlier one
ctx.notifications.clear('inbox');   // one of them; clear() with no id removes them all
ctx.notifications.count;            // how many are unseen
```

For now unseen notifications show as a dot on the app's icon in the phone's navigation, and on the
island (a dot, and a list you can clear). Opening the app on the phone marks them seen. Onbun keeps the 20 newest per app. Only
`title` is needed; `body` and `id` are optional. Later versions may also show them as notifications inside
Onbun, so write titles that make sense on their own.

## The PC island (optional)

An app can also put something on the PC's island by returning `island(context)` from `activate`. The island asks every app about once a second and draws the answers itself, so apps never ship island HTML. With no app answering, the island is an empty pill with its close button.

```js
island(){
  return {
    priority: 20,                    // higher wins the resting pill; e.g. 20 while playing, 10 when paused
    compact: {title:'Song', image:'https://…/cover.jpg', accent:'#ff5a36', activity:true},  // the resting pill (or null)
    expanded: {                      // this app's card in the open island (or null)
      title:'Song', subtitle:'Artist', image:'https://…/cover.jpg', placeholder:'note',
      buttons:[{symbol:'previous', action:'previous', label:'Previous'}, {symbol:'pause', action:'toggle', label:'Pause'}],
      slider:{action:'volume', value:60, label:'Volume', symbol:'speaker', display:'60%'},
      footer:{label:'Open YouTube Music', action:'setup', note:'Runs on PC'}
    }
  };
}
```

Buttons, the slider (0–100) and the footer call your `command(action, value)` like the phone does. `symbol` is one of `play`, `pause`, `next`, `previous`, `speaker`, `note`, `open`, `mic`, `mic-off`, `headphones`, `bell`. Images must be `https:` or `data:image/…` URLs. Anything else is dropped, and an app whose `island()` throws is simply left out. `apps/music` is the example.

### Settings on the PC (optional)

Return `settings: {describe(), action(action, values)}` from `activate` and the app gets its own page in the island's settings. `describe()` returns `{status: {label, tone}, items: [...]}`; the page refreshes while it is open. Items:

| Item | Shows | `action` receives |
| --- | --- | --- |
| `{type:'text', text}` / `{type:'note', text}` | A paragraph / a small grey note | |
| `{type:'steps', items:[…]}` | A numbered list | |
| `{type:'link', label, url}` | An `https:` link | |
| `{type:'input', id, label, placeholder, secret, value}` | A one-line field; buttons send every field by its `id` | |
| `{type:'toggle', label, detail, value, action}` | A switch | `{on}` |
| `{type:'slider', label, detail, value, min, max, step, display, action}` | A slider; `display` labels the value until you drag | `{value}` when you let go |
| `{type:'editor', label, detail, button, title, value, placeholder, maxLength, action}` | A row whose button opens a text editor over the page (Save, or Ctrl+Enter) | `{text}` |
| `{type:'button', label, action, primary, danger}` | A wide button | the fields |

Text values are cut to 2000 characters.

## The screen (drawn natively on each phone)

```json
{
  "type": "screen",
  "title": "Hello",
  "chrome": "fullscreen",
  "accent": "teal",
  "state": { "query": "" },
  "bar": {
    "leading": [{ "type": "label", "text": "$pc", "symbol": "desktopcomputer", "glass": true, "shape": "capsule", "padding": [0, 14], "height": 42 }],
    "trailing": [{ "type": "button", "variant": "glass", "symbol": "plus", "action": { "command": "add", "value": 1 } }]
  },
  "body": {
    "type": "scroll",
    "children": [
      { "type": "each", "items": "$items", "as": "item",
        "template": { "type": "row", "title": "$item.title", "subtitle": "{{item.created|age}}", "accessory": "chevron",
                      "action": { "cover": "detail", "params": "$item" } } }
    ]
  },
  "covers": { "detail": { "bar": { "leading": [{ "type": "button", "variant": "glass", "symbol": "chevron.left", "action": { "dismiss": true } }] },
                          "body": { "type": "text", "text": "$params.title", "style": "title2" } } }
}
```

How it fits together:

- **Bindings** read data: `"$items"`, `"$item.title"`, `"{{count}} hellos"`. Logic uses operator objects:
  `{"if": [{"gt": ["$count", 0]}, "Some", "None"]}`. See [Bindings and expressions](components.md#bindings-and-expressions).
- **Screen variables** (`state`, read as `$ui.name`) hold what only the phone cares about: whether search is
  open, the text in a field, a pending vote. Change them with `{"set": …}` / `{"toggle": …}`.
- **Actions** run on taps and controls: `command` (to your backend), `sheet`, `cover`, `dismiss`, `open`, `set`,
  `haptic`… A list runs in order; a failing command stops it and runs its `onError`.
- **Optimistic updates**: set a screen variable, send the command, clear the variable:
  `[{"set": "pending", "value": true}, {"command": "save", "onError": {"set": "pending", "value": null}}, {"set": "pending", "value": null}]`,
  and show `{"coalesce": ["$ui.pending", "$saved"]}`.
- **Design rules** (match the rest of Onbun): the floating material (`"glass": true`, `"variant": "glass"`:
  Liquid Glass on iPhone, a tonal surface on Android) only for
  floating controls in the bar and over media; content sits on flat `card` and `section` surfaces.
  `chrome: "fullscreen"` gives your app the whole content area down to the bottom edge: scrolls run under the
  edge, and a full-height background (like a call view's glow) reaches it while its controls stay inside the
  margin. `height: "screen"` with `snap` makes paging cards.

### When the components are not enough: `web`

```json
{ "type": "web", "src": "ui/chart.html", "props": { "title": "Last hellos" }, "fill": "both" }
```

The page loads from your package and talks to your app through `window.onbun` (older pages may use `window.winmore`, which still works):

```js
onbun.onData(({ data, ui, props, params, env }) => render(data));  // now and on every change
const result = await onbun.command('add', 5);                       // same as a command action
await onbun.set('query', 'cats');                                   // a screen variable
await onbun.run({ sheet: 'settings' });                             // any kit action
onbun.open('https://example.com');                                  // the phone's browser
```

Pages are transparent by default, so glass controls float over them. The page inspector works on development
builds: on iPhone, Safari → Develop → your iPhone; on Android, `chrome://inspect` in Chrome on the PC. If the
same web block shows up in several apps, it is a good candidate for a new native component.

## Developing

1. Copy `docs/apps/template/hello` into your **apps folder**: PC settings → Apps → *Open folder*
   (`%APPDATA%\WinMore\apps` on Windows; the folder keeps its old name). Onbun loads it right away and the phone shows it in its app bar.
2. Edit any file. Onbun reloads the app within a second and the phone reloads its screen; no restart.
3. If the screen has a mistake, the phone shows exactly what to fix (`screen: <text>.colour: … is not a
   text property`). Check from a terminal with:

   ```bash
   npm run check:apps -- path/to/your-app
   ```

4. Add `"$schema": "../screen.schema.json"` (adjust the path) to `screen.json` for autocomplete.

## Publishing

Apps in this repository's `apps/` folder ship in the catalog:

```bash
npm run publish:catalog
```

The catalog is plain app folders (`apps/<id>/…`) plus an `index.json` listing every file with its SHA-256.
Onbun downloads each file, checks its hash, and installs the folder. Installed copies **update themselves**
from the catalog (PC settings → Apps → *Update apps automatically*). Bump `version` for every release.

### Making a .wmapp file

A `.wmapp` is the whole app folder in one file. Packing one runs the checks Onbun makes before installing
(manifest, entry module, paths and sizes, every Kit screen). Three ways, all using the same packer:

- **The island:** Settings → Library → *For developers* → *Export file…*, then pick the app folder.
- **A terminal** (Node 18+, no install): download [onbun-pack.cjs](https://onbun.app/tools/onbun-pack.cjs) and
  run `node onbun-pack.cjs path/to/your-app [--out dist]`. It writes `<id>-<version>.wmapp`. In this
  repository, `node scripts/onbun-pack.cjs` is the same tool (the download is generated from it).
- **GitHub Actions:** save [onbun-release.yml](onbun-release.yml) as `.github/workflows/onbun-release.yml`
  in the app's repository. Pushing a tag that matches `version` (`git tag v1.2.0 && git push origin v1.2.0`)
  packs the app and attaches the file to a GitHub release. It finds the app at the top of the repository or
  in its one subfolder with a `manifest.json`.

Community apps reach the store through a submission on [onbun.app/apps](https://onbun.app/apps) once they
have a release; the store installs and updates them from it.

Apps from outside the catalog install from a link. Put an **Add to Onbun** button on your page that opens
one of these; the PC's island shows the app and where it comes from, and installs only after a yes:

- `onbun://install?github=your-name/hello`: the newest GitHub release's `.wmapp` (it then updates from there)
- `onbun://install?url=https://example.com/hello.wmapp`: a package file over HTTPS
- `onbun://install?app=hello`: an app from the Onbun catalog

Developers can also install from the island's Library → *For developers*: a folder, a `.wmapp` file or a
GitHub repository. Apps run with Onbun's access to the PC; install only apps you trust.

## Changing the component library

The library lives in [`companion/kit.cjs`](../../companion/kit.cjs) (PC validation, docs, schema) and in each
renderer: [`ios/KitViews.swift`](../../ios/KitViews.swift) for phone and
[`android/…/KitViews.kt`](../../android/app/src/main/java/com/winmore/remote/KitViews.kt) for Android. Adding a
component or a layout rule is the only change that needs new phone builds, and it always lands in every renderer:

1. Describe it in `kit.cjs` (props, docs, example) and draw it in both renderers (`KitComponent`).
2. `npm run docs:kit` to regenerate the reference and schema; `npm test`.
3. Ship new phone builds. Apps can use the component once phones have those builds.
