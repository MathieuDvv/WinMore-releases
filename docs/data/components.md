# Onbun Kit components

_Generated from `companion/kit.cjs` by `npm run docs:kit`. Do not edit by hand._

Apps describe their phone screen in `ui/screen.json` with these components. Each phone draws them natively:
SwiftUI and Liquid Glass on iPhone, Compose and Material 3 Expressive on Android. Start with [the guide](README.md);
for anything the library cannot do, use [`web`](#web).

## Contents

- **Layout:** [`stack`](#stack), [`layers`](#layers), [`split`](#split), [`scroll`](#scroll), [`grid`](#grid), [`list`](#list), [`section`](#section), [`card`](#card), [`each`](#each), [`if`](#if), [`pager`](#pager), [`spacer`](#spacer), [`divider`](#divider)
- **Content:** [`text`](#text), [`label`](#label), [`symbol`](#symbol), [`image`](#image), [`gallery`](#gallery), [`video`](#video), [`media`](#media), [`badge`](#badge), [`stat`](#stat), [`progress`](#progress), [`gauge`](#gauge), [`chart`](#chart), [`avatar`](#avatar), [`row`](#row), [`comment`](#comment), [`empty`](#empty), [`lyrics`](#lyrics), [`clock`](#clock), [`web`](#web)
- **Controls:** [`button`](#button), [`pill`](#pill), [`menu`](#menu), [`toggle`](#toggle), [`slider`](#slider), [`scrubber`](#scrubber), [`stepper`](#stepper), [`picker`](#picker), [`field`](#field), [`link`](#link)
- [Screen](#screen) · [Common props](#common-props) · [Actions](#actions) · [Bindings and expressions](#bindings-and-expressions) · [Colors](#colors) · [Menu items](#menu-items)

## Screen

The root object of `ui/screen.json`.

| Prop | Type | |
|---|---|---|
| `type` **required** | `screen` |  |
| `title` | string | Shown in the app bar on PC and as the default navigation title. |
| `chrome` | `standard` · `fullscreen` | standard keeps Onbun's margins and music volume bar. fullscreen gives the app the whole content area and reaches the bottom edge: a scroll runs under the edge and keeps the margin as space after its last item, and an element that fills the height with a background or gradient extends that background to the edge while its content stays inside the margin. Default standard. |
| `background` | color | Screen color. Default black. |
| `surface` | color | Color of `card` and `section` surfaces. Default #1C1C1E. |
| `accent` | color | Selected and highlighted states. Default blue. |
| `state` | object | Initial screen variables, read as "$ui.name" and changed with the `set` action. |
| `let` | object | Named values worked out from data, e.g. {"unread": {"count": "$messages"}}; read them as "$unread". Sheets and covers can have their own `let`. |
| `bar` | object | Floating glass bar: {leading:[…], trailing:[…]}. Use glass buttons, menus and pills. |
| `accessory` | node | Shown under the bar, e.g. a search field. |
| `body` **required** | node |  |
| `sheets` | object | Named sheets: {name: {title, body, detents:["medium","large"]}}. Open with {"sheet":"name"}. |
| `covers` | object | Named full-screen pages: {name: {bar, body, background}}. Open with {"cover":"name","params":…}. |
| `refresh` | object | How often the phone asks for data: {interval: 1.5, fast: 0.45, fastWhen: "$loading"} in seconds. |
| `timelines` | object | Media positions that keep moving between updates: {"main": {"track": "$song.id", "position": "$song.current", "duration": "$song.duration", "playing": "$song.playing"}} (seconds). `scrubber` and `lyrics` follow them. |
| `persist` | array | Screen variables this phone remembers between launches, e.g. ["face", "theme"]. |
| `backdrop` | url | An image (usually album art) whose colors tint the whole screen background. |
| `appear` | action | Runs when the screen appears. |

Sheets: `{"title": …, "detents": ["medium", "large"], "let": {…}, "bar": {…}, "accessory": …, "body": …}`.
Covers (full-screen pages): `{"background": …, "let": {…}, "bar": {…}, "accessory": …, "body": …}`; bindings read what opened them as `$params`.

# Layout

## stack

Lays children out in a column or a row.

| Prop | Type | |
|---|---|---|
| `axis` | `vertical` · `horizontal` | Default vertical. |
| `spacing` | number | Space between children. Default 8. |
| `alignment` | `leading` · `center` · `trailing` · `top` · `bottom` · `fill` | Cross-axis alignment. Default leading (vertical) or center (horizontal). |
| `children` **required** | nodes |  |

```json
{
  "type": "stack",
  "spacing": 12,
  "children": [
    {
      "type": "text",
      "text": "Hello",
      "style": "headline"
    },
    {
      "type": "text",
      "text": "World",
      "color": "secondary"
    }
  ]
}
```

## layers

Stacks children on top of each other (first child at the back).

| Prop | Type | |
|---|---|---|
| `alignment` | `leading` · `center` · `trailing` · `top` · `bottom` · `topLeading` · `topTrailing` · `bottomLeading` · `bottomTrailing` | Default center. |
| `children` **required** | nodes |  |

## split

Two panes side by side in landscape. In portrait they stack, or the second one hides.

| Prop | Type | |
|---|---|---|
| `ratio` | number | Share of the width for the first pane in landscape, 0.2 to 0.8. Default 0.58. |
| `spacing` | number | Default 12. |
| `portrait` | `stack` · `first` · `second` | Portrait layout. Default stack. |
| `portraitHeight` | number | Height of the first pane when stacked in portrait. |
| `children` **required** | nodes | Exactly two components. |

## scroll

A scrolling container. Children are created lazily, so long feeds stay fast.

| Prop | Type | |
|---|---|---|
| `axis` | `vertical` · `horizontal` | Default vertical. |
| `spacing` | number | Default 12. |
| `snap` | bool | Settle on each child after a swipe (paging cards). |
| `indicators` | bool | Show scroll bars. Default false. |
| `refresh` | action | Pull to refresh. |
| `end` | action | Runs when the last child appears (load more). |
| `footer` | node | Shown after the children, e.g. a spinner while more loads. |
| `stick` | `none` · `bottom` | bottom keeps the newest (last) child in view as children arrive, like a chat. Default none. |
| `children` **required** | nodes |  |

## grid

A grid that fills rows with as many columns as fit.

| Prop | Type | |
|---|---|---|
| `columns` | number | Fixed number of columns. |
| `minWidth` | number | Adaptive columns at least this wide (used when `columns` is not set). Default 140. |
| `spacing` | number | Default 12. |
| `children` **required** | nodes |  |

## list

A native grouped list, like the phone’s own Settings. Put `section` and `row` components inside.

| Prop | Type | |
|---|---|---|
| `style` | `inset` · `plain` | Default inset. |
| `refresh` | action | Pull to refresh. |
| `children` **required** | nodes |  |

## section

A titled group. Inside a `list` it is a list section; elsewhere a rounded card.

| Prop | Type | |
|---|---|---|
| `title` | string |  |
| `footer` | string |  |
| `children` **required** | nodes |  |

## card

A flat rounded surface for content (posts, tiles).

| Prop | Type | |
|---|---|---|
| `spacing` | number | Default 8. |
| `axis` | `vertical` · `horizontal` | Default vertical. |
| `inset` | number | Inner padding. Default 16. Use 0 for edge-to-edge media. |
| `children` **required** | nodes |  |

## each

Repeats `template` for every element of `items`.

| Prop | Type | |
|---|---|---|
| `items` **required** | array | Usually a binding, e.g. "$posts". |
| `as` | string | Name for the current element in bindings. Default "item". |
| `index` | string | Name for the current position (from 0). |
| `id` | string | Path inside each element that identifies it. Default "id". |
| `template` **required** | node |  |
| `empty` | node | Shown when there are no items. |

```json
{
  "type": "each",
  "items": "$songs",
  "as": "song",
  "template": {
    "type": "row",
    "title": "$song.title",
    "subtitle": "$song.artist"
  }
}
```

## if

Shows `then` when `test` is truthy, otherwise `else`.

| Prop | Type | |
|---|---|---|
| `test` **required** | any |  |
| `then` | node |  |
| `else` | node |  |

## pager

Pages you swipe through one at a time, sideways or up and down. Vertical pagers resist past the first and last page. Use `bind` to read or move the page.

| Prop | Type | |
|---|---|---|
| `axis` | `horizontal` · `vertical` | Default horizontal. |
| `bind` | string | Screen variable holding the current page (from 0). Set it to change page. |
| `start` | number | First page shown. Default 0. |
| `indicator` | `auto` · `dots` · `none` | Page dots; auto fades them out after a moment. Default auto. |
| `locked` | bool | Stop swiping (pages still change through `bind`). |
| `children` **required** | nodes | One component per page; `each` works too. |

```json
{
  "type": "pager",
  "axis": "vertical",
  "bind": "panel",
  "start": 1,
  "indicator": "none",
  "children": [
    {
      "type": "text",
      "text": "Lyrics"
    },
    {
      "type": "image",
      "src": "$artwork"
    },
    {
      "type": "text",
      "text": "Up next"
    }
  ]
}
```

## spacer

Flexible empty space.

| Prop | Type | |
|---|---|---|
| `min` | number |  |

## divider

A thin separator line.

_No props of its own._

# Content

## text

Text. Supports inline Markdown.

| Prop | Type | |
|---|---|---|
| `text` **required** | string |  |
| `style` | `largeTitle` · `title` · `title2` · `title3` · `headline` · `body` · `callout` · `subheadline` · `footnote` · `caption` · `caption2` | Default body. |
| `weight` | `regular` · `medium` · `semibold` · `bold` · `heavy` · `light` |  |
| `color` | color |  |
| `lines` | number | Maximum lines before truncating. |
| `textAlign` | `leading` · `center` · `trailing` |  |
| `markdown` | bool | Render **bold**, _italic_, `code` and links. |
| `selectable` | bool |  |
| `monospaced` | bool | Monospaced digits (for changing numbers). |
| `size` | number | Font size in points, overriding `style`. |

## label

A symbol and text side by side.

| Prop | Type | |
|---|---|---|
| `text` **required** | string |  |
| `symbol` **required** | symbol |  |
| `style` | `largeTitle` · `title` · `title2` · `title3` · `headline` · `body` · `callout` · `subheadline` · `footnote` · `caption` · `caption2` |  |
| `weight` | `regular` · `medium` · `semibold` · `bold` · `heavy` · `light` |  |
| `color` | color |  |
| `iconColor` | color |  |
| `lines` | number |  |

## symbol

An icon, named like an SF Symbol. Android draws the matching Material Symbol.

| Prop | Type | |
|---|---|---|
| `name` **required** | symbol |  |
| `size` | number | Default 17. |
| `weight` | `regular` · `medium` · `semibold` · `bold` · `heavy` · `light` |  |
| `color` | color |  |
| `slash` | bool | Draw a diagonal slash through the symbol, for states SF Symbols has no slashed version of. |

## image

A remote or packaged image. Animated GIFs play. Downloads are cached and downscaled.

| Prop | Type | |
|---|---|---|
| `src` **required** | url | https URL, a path in your package such as "assets/logo.png", a data: URL, or a photo saved with the `photo` action. |
| `fit` | `fill` · `fit` | Default fill. |
| `placeholder` | symbol | Symbol shown when there is no image. Default "photo". |
| `template` | bool | Draw as a single-color glyph tinted with `foreground`. |
| `tap` | action | Runs when the image is tapped, with where as `$value`: {"x": 0…1, "y": 0…1} from the top left. For remote screens. |

## gallery

Swipe through images, with a page counter.

| Prop | Type | |
|---|---|---|
| `images` **required** | array |  |
| `fit` | `fill` · `fit` |  |
| `counter` | bool | Default true. |

## video

Plays a video (MP4 or HLS).

| Prop | Type | |
|---|---|---|
| `src` **required** | url |  |
| `autoplay` | bool | Default true. |
| `muted` | bool | Default false. |
| `loop` | bool | Default true. |
| `controls` | bool | Show playback controls. Default true. |
| `fit` | `fill` · `fit` | Default fit. |
| `poster` | url |  |

## media

Picks the right player: a video when there is one, a gallery for several images, otherwise an image. Handles spoilers and full-screen viewing.

| Prop | Type | |
|---|---|---|
| `video` | url |  |
| `images` | array |  |
| `image` | url |  |
| `fit` | `fill` · `fit` | Default fill. |
| `inline` | bool | Muted, looping, no controls: for feeds. Default false. |
| `spoiler` | bool | Blur until tapped. |
| `badge` | string | Small glass label in the bottom corner, e.g. "Video". |
| `badgeSymbol` | symbol |  |
| `expandable` | bool | Double-tap or pinch opens a full-screen viewer. |

## badge

A small capsule label.

| Prop | Type | |
|---|---|---|
| `text` **required** | string |  |
| `symbol` | symbol |  |
| `tint` | color |  |
| `variant` | `tinted` · `glass` · `plain` | Default tinted. |

## stat

A labelled value with an optional progress bar.

| Prop | Type | |
|---|---|---|
| `label` **required** | string |  |
| `value` **required** | string |  |
| `symbol` | symbol |  |
| `progress` | number | 0 to 1. |

## progress

A spinner, or a bar when `value` is set.

| Prop | Type | |
|---|---|---|
| `value` | number | 0 to 1. Leave out for a spinner. |
| `label` | string |  |
| `tint` | color |  |

## gauge

A circular gauge for a single reading.

| Prop | Type | |
|---|---|---|
| `value` **required** | number |  |
| `min` | number | Default 0. |
| `max` | number | Default 1. |
| `label` | string |  |
| `text` | string | Text in the middle. Default the value. |
| `symbol` | symbol |  |
| `tint` | color |  |

## chart

A line, area or bar chart.

| Prop | Type | |
|---|---|---|
| `values` **required** | array | Numbers, or objects with `x` and `y`. |
| `kind` | `line` · `area` · `bar` | Default line. |
| `tint` | color |  |
| `min` | number |  |
| `max` | number |  |
| `axes` | bool | Default false. |

## avatar

A round picture, or initials when there is none.

| Prop | Type | |
|---|---|---|
| `image` | url |  |
| `text` | string |  |
| `size` | number | Default 36. |
| `ring` | color | Ring around the picture, e.g. green while someone speaks. Leave out (or null) for none. |
| `dimmed` | bool | Fade the picture, e.g. for someone muted. |

## row

A list row: symbol or image, title, subtitle and a trailing value.

| Prop | Type | |
|---|---|---|
| `title` **required** | string |  |
| `subtitle` | string |  |
| `symbol` | symbol |  |
| `image` | url |  |
| `value` | string | Trailing text. |
| `accessory` | `none` · `chevron` · `check` |  |
| `checked` | bool | Shows a checkmark when true. |
| `role` | `normal` · `destructive` |  |
| `tint` | color |  |
| `lines` | number | Maximum title lines. Default 2. |

## comment

A threaded comment or chat message.

| Prop | Type | |
|---|---|---|
| `author` **required** | string |  |
| `body` **required** | string |  |
| `meta` | string | e.g. "3h". |
| `score` | string |  |
| `depth` | number | Nesting level; draws thread lines. |
| `highlight` | string | Badge next to the author, e.g. "OP". |
| `avatar` | url |  |

## empty

A centered message for empty, loading or error states.

| Prop | Type | |
|---|---|---|
| `symbol` | symbol |  |
| `title` **required** | string |  |
| `message` | string |  |
| `loading` | bool |  |
| `children` | nodes | Buttons under the message. |

## lyrics

Lines that follow a playing timeline, karaoke style: the current line is large, earlier ones fade. Tap a line to jump to it. Without times, the lines scroll as plain text.

| Prop | Type | |
|---|---|---|
| `lines` **required** | array | [{"time": seconds, "text": "…"}]. `time` is optional. |
| `timeline` | string | Name of a screen timeline (see Screen `timelines`). Default "main". |
| `window` | number | Lines shown at once. Default 6. |
| `synced` | bool | Follow the timeline. Default true when lines have times. |
| `action` | action | Runs when a line is tapped, with its time as `$value`. |

## clock

The current time, updated every second.

| Prop | Type | |
|---|---|---|
| `face` | `digital` · `minimal` · `analog` | Default digital. |
| `hours24` | bool | 24-hour time. Default true. |
| `date` | bool | Show the date under the time. Default true. |
| `size` | number | Digit size in points. Default 112 (digital) or 84 (minimal); the analog dial is 220 wide. |

## web

Escape hatch: an HTML page from your package (or an https site) inside the native screen. The page talks to your app through window.onbun (window.winmore also works).

| Prop | Type | |
|---|---|---|
| `src` **required** | url | e.g. "ui/chart.html". |
| `props` | any | Sent to the page as onbun.props. |
| `transparent` | bool | Let the screen show through. Default true. |
| `scroll` | bool | Let the page scroll itself. Default true. |

# Controls

## button

A button. Use `glass` style for floating controls over content.

| Prop | Type | |
|---|---|---|
| `label` | string |  |
| `symbol` | symbol |  |
| `variant` | `glass` · `prominent` · `bordered` · `plain` · `link` | Default bordered. |
| `buttonShape` | `capsule` · `circle` · `rounded` | Default capsule; circle for symbol-only buttons. |
| `size` | `small` · `regular` · `large` | Default regular. |
| `selected` | bool | Highlights the button (tinted glass, filled symbol color). |
| `tint` | color |  |
| `role` | `normal` · `destructive` |  |
| `confirm` | string | Ask this question before running the action. |
| `symbolSize` | number | Symbol size in points. Default 17. Changing symbols (play and pause) animate. |
| `disabled` | bool |  |
| `loading` | bool | Shows a spinner instead of the label. |
| `action` | action |  |

## pill

A glass capsule that groups several symbol buttons with dividers.

| Prop | Type | |
|---|---|---|
| `children` **required** | nodes | `button` components; their own glass is ignored. |

## menu

A button that opens a menu.

| Prop | Type | |
|---|---|---|
| `label` | string |  |
| `symbol` | symbol |  |
| `variant` | `glass` · `bordered` · `plain` | Default glass. |
| `buttonShape` | `capsule` · `circle` | Default capsule, circle when there is no label. |
| `chevron` | bool | Show a small chevron after the label. |
| `items` **required** | items | Menu items (see Menu items). |

## toggle

An on/off switch. The new value is `$value` in the action.

| Prop | Type | |
|---|---|---|
| `label` **required** | string |  |
| `symbol` | symbol |  |
| `value` **required** | bool |  |
| `action` **required** | action |  |

## slider

A slider. The action runs when you let go, with the value as `$value`.

| Prop | Type | |
|---|---|---|
| `label` | string |  |
| `symbol` | symbol |  |
| `value` **required** | number |  |
| `min` | number | Default 0. |
| `max` | number | Default 100. |
| `step` | number |  |
| `live` | bool | Also run the action while dragging (at most about 8 times a second). |
| `axis` | `horizontal` · `vertical` | vertical draws a tall fader, like a mixer channel. Default horizontal. |
| `tint` | color |  |
| `disabled` | bool |  |
| `action` **required** | action |  |

## scrubber

A media position bar that keeps moving between updates from the PC. Drag to seek; a tap never jumps. Reads a screen timeline (see Screen `timelines`).

| Prop | Type | |
|---|---|---|
| `timeline` | string | Name of a screen timeline. Default "main". |
| `times` | bool | Show elapsed and remaining time. Default true. |
| `compact` | bool | A thinner bar. |
| `tint` | color |  |
| `action` | action | Runs when you let go, with the new position in seconds as `$value`. |

```json
{
  "type": "scrubber",
  "timeline": "main",
  "action": {
    "command": "seek",
    "value": "$value"
  }
}
```

## stepper

Minus and plus buttons around a value. The new value is `$value`.

| Prop | Type | |
|---|---|---|
| `label` **required** | string |  |
| `value` **required** | number |  |
| `min` | number |  |
| `max` | number |  |
| `step` | number |  |
| `action` **required** | action |  |

## picker

Choose one option. The chosen value is `$value` in the action.

| Prop | Type | |
|---|---|---|
| `label` | string |  |
| `value` **required** | any |  |
| `options` **required** | options |  |
| `variant` | `segmented` · `menu` · `inline` | Default segmented. |
| `action` **required** | action |  |
| `disabled` | bool |  |

## field

A text field bound to a screen variable. It can type with the PC keyboard.

| Prop | Type | |
|---|---|---|
| `bind` **required** | string | Screen variable that holds the text, e.g. "query" (read it as "$ui.query"). |
| `placeholder` | string |  |
| `prefix` | string | Fixed text before the field, e.g. "r/". |
| `symbol` | symbol | Leading symbol. |
| `keyboard` | `default` · `search` · `url` · `number` · `email` | Default default. |
| `submit` | action | Runs on Return, with the text as `$value`. |
| `pcKeyboard` | bool | Show the PC keyboard button. Default true. |
| `clearable` | bool | Show a clear button. Default true. |
| `secure` | bool |  |
| `multiline` | bool |  |
| `leading` | node | A control before the field, e.g. a scope menu. |

## link

Opens a web page on the phone.

| Prop | Type | |
|---|---|---|
| `label` **required** | string |  |
| `url` **required** | url |  |
| `symbol` | symbol |  |

## Common props

Every component also accepts these.

| Prop | Type | |
|---|---|---|
| `when` | any | Show the component only when this expression is truthy. |
| `padding` | any | Inner spacing: a number for all sides, [vertical, horizontal], or [top, leading, bottom, trailing]. |
| `width` | number | Fixed width in points. |
| `height` | any | Fixed height in points, or "screen" for the visible content height (minus `screenOffset`). |
| `screenOffset` | number | Points subtracted from the screen height when `height` is "screen". Default 0. |
| `minWidth` | number | Minimum width. |
| `minHeight` | number | Minimum height. |
| `maxWidth` | number | Maximum width; the component centers in wider space. |
| `maxHeight` | number | Maximum height. |
| `fill` | `width` · `height` · `both` | Grow to fill the available width, height or both. |
| `align` | `leading` · `center` · `trailing` · `top` · `bottom` · `topLeading` · `topTrailing` · `bottomLeading` · `bottomTrailing` | Where content sits inside the frame when it is larger than the content. |
| `aspect` | number | Keep this width / height ratio. |
| `background` | color | Flat background color. Use `glass` for a floating material instead. |
| `glass` | bool | The floating material behind the component, in `shape`: Liquid Glass on iPhone, a tonal Material surface on Android. Use it for floating controls only; content stays flat. |
| `glassTint` | color | Tint for the glass, e.g. to mark a selected control. |
| `shape` | `rounded` · `capsule` · `circle` · `rect` | Shape for `background`, `glass` and clipping. Default rounded. |
| `corner` | number | Corner radius for the rounded shape. Default 24. |
| `clip` | bool | Clip content to `shape`. |
| `foreground` | color | Default color for text and symbols inside. |
| `opacity` | number | 0 to 1. |
| `blur` | number | Gaussian blur radius. |
| `gradient` | array | Colors for a diagonal gradient background (top leading to bottom trailing), e.g. ["#0A84FFA6", "black"]. |
| `shadow` | number | Soft drop shadow with this radius, for artwork that floats. |
| `scale` | number | Scale factor; changes animate, e.g. shrink artwork while paused. |
| `action` | action | Runs when the component is tapped. |
| `longPress` | action | Runs on a long press. |
| `doubleTap` | action | Runs on a double tap. |
| `accessibility` | string | VoiceOver label. |
| `key` | string | Stable identity, so animations and state follow the right item. |

## Actions

An action is one object, or a list of them run in order. A command that fails stops the list (after its `onError`).

| Action | |
|---|---|
| `command` | Sends a command to your app on the PC: {"command":"open","value":…}. Optional "app" sends it to another app, "result":"name" stores the reply in a screen variable, and "onError" runs an action if it fails (the error message is $error). |
| `set` | Sets a screen variable: {"set":"query","value":""}. |
| `toggle` | Flips a true/false screen variable: {"toggle":"showSearch"}. |
| `sheet` | Opens a named sheet: {"sheet":"places"}. |
| `cover` | Opens a named full-screen page; its bindings can read "$params": {"cover":"post","params":"$post"}. |
| `dismiss` | Closes the sheet or page this action runs in: {"dismiss":true}. |
| `open` | Opens a web page on the phone: {"open":"$post.url"}. |
| `copy` | Copies text, or an image given as a data: URL or {"kind":"image","data":…}: {"copy":"$post.url"}. |
| `paste` | Reads the phone clipboard into a screen variable as {"kind":"text"\|"image","data":…} (images as a PNG data: URL under 2 MB), or null: {"paste":"clip"}. The phone may ask once for permission. |
| `photo` | Lets you choose a photo, keeps a copy on this phone and stores its path in a screen variable, for `image`: {"photo":"background","maxSize":1600}. Cancelling stops the list. |
| `haptic` | Plays a haptic: light, medium, heavy, selection, success, warning, error. |
| `refresh` | Asks the PC for fresh data now: {"refresh":true}. |
| `if` | Runs `then` or `else`: {"if":"$saved","then":…,"else":…}. |
| `keyboard` | Hides the phone keyboard: {"keyboard":"hide"}. |

Controls put their new value in `$value` (toggle, slider, stepper, picker, field submit).

## Bindings and expressions

Any value can be:

- a **binding**: `"$posts"`, `"$post.title"`, `"$items[0].name"`. Names resolve in this order: `each`/`let` names and `$value`,
  then the roots `ui` (screen variables), `params` (what opened a sheet or cover), `env` (`landscape`, `width`, `height`,
  `connected`, `error`, `platform`) and `data`; any other name reads your app's data. Start with `$$` for a literal `$`.
- **text with placeholders**: `"u/{{post.author}} · {{post.created|age}}"`. Filters: `count`, `age`, `date`, `time`, `duration`, `percent`, `bytes`, `number`, `upper`, `lower`, `json`.
- an **operator object** (one key):

| Operator | Arguments |
|---|---|
| `eq` | [a, b] equal |
| `ne` | [a, b] not equal |
| `gt` | [a, b] a > b |
| `gte` | [a, b] a ≥ b |
| `lt` | [a, b] a < b |
| `lte` | [a, b] a ≤ b |
| `not` | a — true when a is falsy |
| `and` | [a, b, …] all truthy |
| `or` | [a, b, …] first truthy value |
| `if` | [test, then, else] |
| `has` | a — not null, not empty |
| `count` | a — length of a list or text |
| `in` | [value, list] — list contains value (or text contains text) |
| `startsWith` | [text, prefix] |
| `concat` | [a, b, …] joins as text |
| `coalesce` | [a, b, …] first value that is not null |
| `add` | [a, b] |
| `sub` | [a, b] |
| `mul` | [a, b] |
| `div` | [a, b] |
| `min` | [a, b] |
| `max` | [a, b] |
| `lower` | text |
| `upper` | text |
| `join` | [list, separator] |
| `first` | list |
| `last` | list |
| `find` | [list, path, value] — the first element whose path equals value, e.g. {"find": ["$members", "id", "$params"]} |
| `slice` | [list, start, count] — part of a list |
| `range` | n — [0, 1, … n-1] |
| `round` | a — nearest whole number |
| `floor` | a — rounded down |
| `format` | {"format": "count\|age\|date\|time\|duration\|percent\|bytes\|number", "value": …} |

Example: `{"if": [{"gt": ["$unread", 0]}, "{{unread}} new", "All read"]}`.

## Colors

`primary`, `secondary`, `tertiary`, `accent`, `background`, `card`, `white`, `black`, `clear`, `red`, `orange`, `yellow`, `green`, `mint`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `brown`, `gray`, or `#RRGGBB` / `#RRGGBBAA`. `accent`, `background` and `card` come from the screen.

## Menu items

```json
[
  {
    "label": "Newest",
    "symbol": "arrow.down",
    "checked": "$newestFirst",
    "action": {
      "command": "sort",
      "value": "new"
    }
  },
  {
    "divider": true
  },
  {
    "section": "Lists",
    "items": [
      {
        "label": "Archive",
        "symbol": "archivebox",
        "action": {
          "command": "open",
          "value": "archive"
        }
      }
    ]
  },
  {
    "each": "$folders",
    "as": "folder",
    "item": {
      "label": "$folder.name",
      "action": {
        "command": "open",
        "value": "$folder.id"
      }
    }
  },
  {
    "label": "More",
    "symbol": "ellipsis",
    "items": [
      {
        "label": "Delete",
        "role": "destructive",
        "action": {
          "command": "delete"
        }
      }
    ]
  }
]
```
