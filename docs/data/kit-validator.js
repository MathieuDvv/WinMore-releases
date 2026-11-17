(()=>{const module={exports:{}};
// Onbun Kit: the native component library that app packages use to describe their phone screen.
// This file is the single source of truth. The PC validates screens against it, and
// scripts/kit-docs.cjs turns it into docs/apps/components.md and docs/apps/screen.schema.json.
// Each phone draws every component natively (SwiftUI and Liquid Glass on iPhone, Compose and Material 3
// Expressive on Android); `web` is the escape hatch.

// Prop types:
//   string, number, bool, color, symbol (SF Symbol name), url (https URL or a path inside the package)
//   enum (one of `values`), array, object, any, node (one component), nodes (list of components),
//   action (see ACTIONS), items (menu items), options (picker options)
// Value props also accept an expression (see EXPRESSIONS): "$path", "{{path|filter}}" or {"op": ...}.

const COLORS=['primary','secondary','tertiary','accent','background','card','white','black','clear','red','orange','yellow','green','mint','teal','cyan','blue','indigo','purple','pink','brown','gray'];
const TEXT_STYLES=['largeTitle','title','title2','title3','headline','body','callout','subheadline','footnote','caption','caption2'];
const WEIGHTS=['regular','medium','semibold','bold','heavy','light'];
const ALIGN=['leading','center','trailing','top','bottom','topLeading','topTrailing','bottomLeading','bottomTrailing'];

// Every component accepts these layout and decoration props.
const COMMON={
  when:{type:'any',doc:'Show the component only when this expression is truthy.'},
  padding:{type:'any',doc:'Inner spacing: a number for all sides, [vertical, horizontal], or [top, leading, bottom, trailing].'},
  width:{type:'number',doc:'Fixed width in points.'},
  height:{type:'any',doc:'Fixed height in points, or "screen" for the visible content height (minus `screenOffset`).'},
  screenOffset:{type:'number',doc:'Points subtracted from the screen height when `height` is "screen". Default 0.'},
  minWidth:{type:'number',doc:'Minimum width.'},
  minHeight:{type:'number',doc:'Minimum height.'},
  maxWidth:{type:'number',doc:'Maximum width; the component centers in wider space.'},
  maxHeight:{type:'number',doc:'Maximum height.'},
  fill:{type:'enum',values:['width','height','both'],doc:'Grow to fill the available width, height or both.'},
  align:{type:'enum',values:ALIGN,doc:'Where content sits inside the frame when it is larger than the content.'},
  aspect:{type:'number',doc:'Keep this width / height ratio.'},
  background:{type:'color',doc:'Flat background color. Use `glass` for a floating material instead.'},
  glass:{type:'bool',doc:'The floating material behind the component, in `shape`: Liquid Glass on iPhone, a tonal Material surface on Android. Use it for floating controls only; content stays flat.'},
  glassTint:{type:'color',doc:'Tint for the glass, e.g. to mark a selected control.'},
  shape:{type:'enum',values:['rounded','capsule','circle','rect'],doc:'Shape for `background`, `glass` and clipping. Default rounded.'},
  corner:{type:'number',doc:'Corner radius for the rounded shape. Default 24.'},
  clip:{type:'bool',doc:'Clip content to `shape`.'},
  foreground:{type:'color',doc:'Default color for text and symbols inside.'},
  opacity:{type:'number',doc:'0 to 1.'},
  blur:{type:'number',doc:'Gaussian blur radius.'},
  gradient:{type:'array',doc:'Colors for a diagonal gradient background (top leading to bottom trailing), e.g. ["#0A84FFA6", "black"].'},
  shadow:{type:'number',doc:'Soft drop shadow with this radius, for artwork that floats.'},
  scale:{type:'number',doc:'Scale factor; changes animate, e.g. shrink artwork while paused.'},
  action:{type:'action',doc:'Runs when the component is tapped.'},
  longPress:{type:'action',doc:'Runs on a long press.'},
  doubleTap:{type:'action',doc:'Runs on a double tap.'},
  accessibility:{type:'string',doc:'VoiceOver label.'},
  key:{type:'string',doc:'Stable identity, so animations and state follow the right item.'}
};

const C={};
const def=(type,group,doc,props={},extra={})=>{C[type]={type,group,doc,props,...extra};};

// ── Layout ───────────────────────────────────────────────────────────────────
def('stack','Layout','Lays children out in a column or a row.',{
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  spacing:{type:'number',doc:'Space between children. Default 8.'},
  alignment:{type:'enum',values:['leading','center','trailing','top','bottom','fill'],doc:'Cross-axis alignment. Default leading (vertical) or center (horizontal).'},
  children:{type:'nodes',required:true}
},{example:{type:'stack',spacing:12,children:[{type:'text',text:'Hello',style:'headline'},{type:'text',text:'World',color:'secondary'}]}});
def('layers','Layout','Stacks children on top of each other (first child at the back).',{
  alignment:{type:'enum',values:ALIGN,doc:'Default center.'},
  children:{type:'nodes',required:true}
});
def('split','Layout','Two panes side by side in landscape. In portrait they stack, or the second one hides.',{
  ratio:{type:'number',doc:'Share of the width for the first pane in landscape, 0.2 to 0.8. Default 0.58.'},
  spacing:{type:'number',doc:'Default 12.'},
  portrait:{type:'enum',values:['stack','first','second'],doc:'Portrait layout. Default stack.'},
  portraitHeight:{type:'number',doc:'Height of the first pane when stacked in portrait.'},
  children:{type:'nodes',required:true,doc:'Exactly two components.'}
});
def('scroll','Layout','A scrolling container. Children are created lazily, so long feeds stay fast.',{
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  spacing:{type:'number',doc:'Default 12.'},
  snap:{type:'bool',doc:'Settle on each child after a swipe (paging cards).'},
  indicators:{type:'bool',doc:'Show scroll bars. Default false.'},
  refresh:{type:'action',doc:'Pull to refresh.'},
  end:{type:'action',doc:'Runs when the last child appears (load more).'},
  footer:{type:'node',doc:'Shown after the children, e.g. a spinner while more loads.'},
  stick:{type:'enum',values:['none','bottom'],doc:'bottom keeps the newest (last) child in view as children arrive, like a chat. Default none.'},
  children:{type:'nodes',required:true}
});
def('grid','Layout','A grid that fills rows with as many columns as fit.',{
  columns:{type:'number',doc:'Fixed number of columns.'},
  minWidth:{type:'number',doc:'Adaptive columns at least this wide (used when `columns` is not set). Default 140.'},
  spacing:{type:'number',doc:'Default 12.'},
  children:{type:'nodes',required:true}
});
def('list','Layout','A native grouped list, like the phone’s own Settings. Put `section` and `row` components inside.',{
  style:{type:'enum',values:['inset','plain'],doc:'Default inset.'},
  refresh:{type:'action',doc:'Pull to refresh.'},
  children:{type:'nodes',required:true}
});
def('section','Layout','A titled group. Inside a `list` it is a list section; elsewhere a rounded card.',{
  title:{type:'string'},footer:{type:'string'},
  children:{type:'nodes',required:true}
});
def('card','Layout','A flat rounded surface for content (posts, tiles).',{
  spacing:{type:'number',doc:'Default 8.'},
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  inset:{type:'number',doc:'Inner padding. Default 16. Use 0 for edge-to-edge media.'},
  children:{type:'nodes',required:true}
});
def('each','Layout','Repeats `template` for every element of `items`.',{
  items:{type:'array',required:true,doc:'Usually a binding, e.g. "$posts".'},
  as:{type:'string',doc:'Name for the current element in bindings. Default "item".'},
  index:{type:'string',doc:'Name for the current position (from 0).'},
  id:{type:'string',doc:'Path inside each element that identifies it. Default "id".'},
  template:{type:'node',required:true},
  empty:{type:'node',doc:'Shown when there are no items.'}
},{example:{type:'each',items:'$songs',as:'song',template:{type:'row',title:'$song.title',subtitle:'$song.artist'}}});
def('if','Layout','Shows `then` when `test` is truthy, otherwise `else`.',{
  test:{type:'any',required:true},then:{type:'node'},else:{type:'node'}
});
def('pager','Layout','Pages you swipe through one at a time, sideways or up and down. Vertical pagers resist past the first and last page. Use `bind` to read or move the page.',{
  axis:{type:'enum',values:['horizontal','vertical'],doc:'Default horizontal.'},
  bind:{type:'string',doc:'Screen variable holding the current page (from 0). Set it to change page.'},
  start:{type:'number',doc:'First page shown. Default 0.'},
  indicator:{type:'enum',values:['auto','dots','none'],doc:'Page dots; auto fades them out after a moment. Default auto.'},
  locked:{type:'bool',doc:'Stop swiping (pages still change through `bind`).'},
  children:{type:'nodes',required:true,doc:'One component per page; `each` works too.'}
},{example:{type:'pager',axis:'vertical',bind:'panel',start:1,indicator:'none',children:[{type:'text',text:'Lyrics'},{type:'image',src:'$artwork'},{type:'text',text:'Up next'}]}});
def('spacer','Layout','Flexible empty space.',{min:{type:'number'}});
def('divider','Layout','A thin separator line.',{});

// ── Content ──────────────────────────────────────────────────────────────────
def('text','Content','Text. Supports inline Markdown.',{
  text:{type:'string',required:true},
  style:{type:'enum',values:TEXT_STYLES,doc:'Default body.'},
  weight:{type:'enum',values:WEIGHTS},
  color:{type:'color'},
  lines:{type:'number',doc:'Maximum lines before truncating.'},
  textAlign:{type:'enum',values:['leading','center','trailing']},
  markdown:{type:'bool',doc:'Render **bold**, _italic_, `code` and links.'},
  selectable:{type:'bool'},
  monospaced:{type:'bool',doc:'Monospaced digits (for changing numbers).'},
  size:{type:'number',doc:'Font size in points, overriding `style`.'}
});
def('label','Content','A symbol and text side by side.',{
  text:{type:'string',required:true},symbol:{type:'symbol',required:true},
  style:{type:'enum',values:TEXT_STYLES},weight:{type:'enum',values:WEIGHTS},color:{type:'color'},
  iconColor:{type:'color'},lines:{type:'number'}
});
def('symbol','Content','An icon, named like an SF Symbol. Android draws the matching Material Symbol.',{
  name:{type:'symbol',required:true},size:{type:'number',doc:'Default 17.'},weight:{type:'enum',values:WEIGHTS},color:{type:'color'},
  slash:{type:'bool',doc:'Draw a diagonal slash through the symbol, for states SF Symbols has no slashed version of.'}
});
def('image','Content','A remote or packaged image. Animated GIFs play. Downloads are cached and downscaled.',{
  src:{type:'url',required:true,doc:'https URL, a path in your package such as "assets/logo.png", a data: URL, or a photo saved with the `photo` action.'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fill.'},
  placeholder:{type:'symbol',doc:'Symbol shown when there is no image. Default "photo".'},
  template:{type:'bool',doc:'Draw as a single-color glyph tinted with `foreground`.'},
  tap:{type:'action',doc:'Runs when the image is tapped, with where as `$value`: {"x": 0…1, "y": 0…1} from the top left. For remote screens.'}
});
def('gallery','Content','Swipe through images, with a page counter.',{
  images:{type:'array',required:true},fit:{type:'enum',values:['fill','fit']},counter:{type:'bool',doc:'Default true.'}
});
def('video','Content','Plays a video (MP4 or HLS).',{
  src:{type:'url',required:true},autoplay:{type:'bool',doc:'Default true.'},muted:{type:'bool',doc:'Default false.'},
  loop:{type:'bool',doc:'Default true.'},controls:{type:'bool',doc:'Show playback controls. Default true.'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fit.'},poster:{type:'url'}
});
def('media','Content','Picks the right player: a video when there is one, a gallery for several images, otherwise an image. Handles spoilers and full-screen viewing.',{
  video:{type:'url'},images:{type:'array'},image:{type:'url'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fill.'},
  inline:{type:'bool',doc:'Muted, looping, no controls: for feeds. Default false.'},
  spoiler:{type:'bool',doc:'Blur until tapped.'},
  badge:{type:'string',doc:'Small glass label in the bottom corner, e.g. "Video".'},
  badgeSymbol:{type:'symbol'},
  expandable:{type:'bool',doc:'Double-tap or pinch opens a full-screen viewer.'}
});
def('badge','Content','A small capsule label.',{
  text:{type:'string',required:true},symbol:{type:'symbol'},tint:{type:'color'},
  variant:{type:'enum',values:['tinted','glass','plain'],doc:'Default tinted.'}
});
def('stat','Content','A labelled value with an optional progress bar.',{
  label:{type:'string',required:true},value:{type:'string',required:true},symbol:{type:'symbol'},progress:{type:'number',doc:'0 to 1.'}
});
def('progress','Content','A spinner, or a bar when `value` is set.',{
  value:{type:'number',doc:'0 to 1. Leave out for a spinner.'},label:{type:'string'},tint:{type:'color'}
});
def('gauge','Content','A circular gauge for a single reading.',{
  value:{type:'number',required:true},min:{type:'number',doc:'Default 0.'},max:{type:'number',doc:'Default 1.'},
  label:{type:'string'},text:{type:'string',doc:'Text in the middle. Default the value.'},symbol:{type:'symbol'},tint:{type:'color'}
});
def('chart','Content','A line, area or bar chart.',{
  values:{type:'array',required:true,doc:'Numbers, or objects with `x` and `y`.'},
  kind:{type:'enum',values:['line','area','bar'],doc:'Default line.'},
  tint:{type:'color'},min:{type:'number'},max:{type:'number'},axes:{type:'bool',doc:'Default false.'}
});
def('avatar','Content','A round picture, or initials when there is none.',{
  image:{type:'url'},text:{type:'string'},size:{type:'number',doc:'Default 36.'},
  ring:{type:'color',doc:'Ring around the picture, e.g. green while someone speaks. Leave out (or null) for none.'},
  dimmed:{type:'bool',doc:'Fade the picture, e.g. for someone muted.'}
});
def('row','Content','A list row: symbol or image, title, subtitle and a trailing value.',{
  title:{type:'string',required:true},subtitle:{type:'string'},symbol:{type:'symbol'},image:{type:'url'},
  value:{type:'string',doc:'Trailing text.'},accessory:{type:'enum',values:['none','chevron','check']},
  checked:{type:'bool',doc:'Shows a checkmark when true.'},role:{type:'enum',values:['normal','destructive']},
  tint:{type:'color'},lines:{type:'number',doc:'Maximum title lines. Default 2.'}
});
def('comment','Content','A threaded comment or chat message.',{
  author:{type:'string',required:true},body:{type:'string',required:true},meta:{type:'string',doc:'e.g. "3h".'},
  score:{type:'string'},depth:{type:'number',doc:'Nesting level; draws thread lines.'},highlight:{type:'string',doc:'Badge next to the author, e.g. "OP".'},
  avatar:{type:'url'}
});
def('empty','Content','A centered message for empty, loading or error states.',{
  symbol:{type:'symbol'},title:{type:'string',required:true},message:{type:'string'},loading:{type:'bool'},
  children:{type:'nodes',doc:'Buttons under the message.'}
});
def('lyrics','Content','Lines that follow a playing timeline, karaoke style: the current line is large, earlier ones fade. Tap a line to jump to it. Without times, the lines scroll as plain text.',{
  lines:{type:'array',required:true,doc:'[{"time": seconds, "text": "…"}]. `time` is optional.'},
  timeline:{type:'string',doc:'Name of a screen timeline (see Screen `timelines`). Default "main".'},
  window:{type:'number',doc:'Lines shown at once. Default 6.'},
  synced:{type:'bool',doc:'Follow the timeline. Default true when lines have times.'},
  action:{type:'action',doc:'Runs when a line is tapped, with its time as `$value`.'}
});
def('clock','Content','The current time, updated every second.',{
  face:{type:'enum',values:['digital','minimal','analog'],doc:'Default digital.'},
  hours24:{type:'bool',doc:'24-hour time. Default true.'},
  date:{type:'bool',doc:'Show the date under the time. Default true.'},
  size:{type:'number',doc:'Digit size in points. Default 112 (digital) or 84 (minimal); the analog dial is 220 wide.'}
});
def('web','Content','Escape hatch: an HTML page from your package (or an https site) inside the native screen. The page talks to your app through window.onbun (window.winmore also works).',{
  src:{type:'url',required:true,doc:'e.g. "ui/chart.html".'},
  props:{type:'any',doc:'Sent to the page as onbun.props.'},
  transparent:{type:'bool',doc:'Let the screen show through. Default true.'},
  scroll:{type:'bool',doc:'Let the page scroll itself. Default true.'}
});

// ── Controls ─────────────────────────────────────────────────────────────────
def('button','Controls','A button. Use `glass` style for floating controls over content.',{
  label:{type:'string'},symbol:{type:'symbol'},
  variant:{type:'enum',values:['glass','prominent','bordered','plain','link'],doc:'Default bordered.'},
  buttonShape:{type:'enum',values:['capsule','circle','rounded'],doc:'Default capsule; circle for symbol-only buttons.'},
  size:{type:'enum',values:['small','regular','large'],doc:'Default regular.'},
  selected:{type:'bool',doc:'Highlights the button (tinted glass, filled symbol color).'},
  tint:{type:'color'},role:{type:'enum',values:['normal','destructive']},
  confirm:{type:'string',doc:'Ask this question before running the action.'},
  symbolSize:{type:'number',doc:'Symbol size in points. Default 17. Changing symbols (play and pause) animate.'},
  disabled:{type:'bool'},loading:{type:'bool',doc:'Shows a spinner instead of the label.'},
  action:{type:'action'}
});
def('pill','Controls','A glass capsule that groups several symbol buttons with dividers.',{
  children:{type:'nodes',required:true,doc:'`button` components; their own glass is ignored.'}
});
def('menu','Controls','A button that opens a menu.',{
  label:{type:'string'},symbol:{type:'symbol'},
  variant:{type:'enum',values:['glass','bordered','plain'],doc:'Default glass.'},
  buttonShape:{type:'enum',values:['capsule','circle'],doc:'Default capsule, circle when there is no label.'},
  chevron:{type:'bool',doc:'Show a small chevron after the label.'},
  items:{type:'items',required:true,doc:'Menu items (see Menu items).'}
});
def('toggle','Controls','An on/off switch. The new value is `$value` in the action.',{
  label:{type:'string',required:true},symbol:{type:'symbol'},value:{type:'bool',required:true},action:{type:'action',required:true}
});
def('slider','Controls','A slider. The action runs when you let go, with the value as `$value`.',{
  label:{type:'string'},symbol:{type:'symbol'},value:{type:'number',required:true},
  min:{type:'number',doc:'Default 0.'},max:{type:'number',doc:'Default 100.'},step:{type:'number'},
  live:{type:'bool',doc:'Also run the action while dragging (at most about 8 times a second).'},
  axis:{type:'enum',values:['horizontal','vertical'],doc:'vertical draws a tall fader, like a mixer channel. Default horizontal.'},
  tint:{type:'color'},disabled:{type:'bool'},
  action:{type:'action',required:true}
});
def('scrubber','Controls','A media position bar that keeps moving between updates from the PC. Drag to seek; a tap never jumps. Reads a screen timeline (see Screen `timelines`).',{
  timeline:{type:'string',doc:'Name of a screen timeline. Default "main".'},
  times:{type:'bool',doc:'Show elapsed and remaining time. Default true.'},
  compact:{type:'bool',doc:'A thinner bar.'},
  tint:{type:'color'},
  action:{type:'action',doc:'Runs when you let go, with the new position in seconds as `$value`.'}
},{example:{type:'scrubber',timeline:'main',action:{command:'seek',value:'$value'}}});
def('stepper','Controls','Minus and plus buttons around a value. The new value is `$value`.',{
  label:{type:'string',required:true},value:{type:'number',required:true},min:{type:'number'},max:{type:'number'},step:{type:'number'},action:{type:'action',required:true}
});
def('picker','Controls','Choose one option. The chosen value is `$value` in the action.',{
  label:{type:'string'},value:{type:'any',required:true},options:{type:'options',required:true},
  variant:{type:'enum',values:['segmented','menu','inline'],doc:'Default segmented.'},
  action:{type:'action',required:true},disabled:{type:'bool'}
});
def('field','Controls','A text field bound to a screen variable. It can type with the PC keyboard.',{
  bind:{type:'string',required:true,doc:'Screen variable that holds the text, e.g. "query" (read it as "$ui.query").'},
  placeholder:{type:'string'},prefix:{type:'string',doc:'Fixed text before the field, e.g. "r/".'},
  symbol:{type:'symbol',doc:'Leading symbol.'},
  keyboard:{type:'enum',values:['default','search','url','number','email'],doc:'Default default.'},
  submit:{type:'action',doc:'Runs on Return, with the text as `$value`.'},
  pcKeyboard:{type:'bool',doc:'Show the PC keyboard button. Default true.'},
  clearable:{type:'bool',doc:'Show a clear button. Default true.'},
  secure:{type:'bool'},multiline:{type:'bool'},
  leading:{type:'node',doc:'A control before the field, e.g. a scope menu.'}
});
def('link','Controls','Opens a web page on the phone.',{
  label:{type:'string',required:true},url:{type:'url',required:true},symbol:{type:'symbol'}
});

// ── Screen ───────────────────────────────────────────────────────────────────
// The root of ui/screen.json. Not a component; described here for validation and docs.
const SCREEN={
  type:{type:'enum',values:['screen'],required:true},
  title:{type:'string',doc:'Shown in the app bar on PC and as the default navigation title.'},
  chrome:{type:'enum',values:['standard','fullscreen'],doc:'standard keeps Onbun\'s margins and music volume bar. fullscreen gives the app the whole content area and reaches the bottom edge: a scroll runs under the edge and keeps the margin as space after its last item, and an element that fills the height with a background or gradient extends that background to the edge while its content stays inside the margin. Default standard.'},
  background:{type:'color',doc:'Screen color. Default black.'},
  surface:{type:'color',doc:'Color of `card` and `section` surfaces. Default #1C1C1E.'},
  accent:{type:'color',doc:'Selected and highlighted states. Default blue.'},
  state:{type:'object',doc:'Initial screen variables, read as "$ui.name" and changed with the `set` action.'},
  let:{type:'object',doc:'Named values worked out from data, e.g. {"unread": {"count": "$messages"}}; read them as "$unread". Sheets and covers can have their own `let`.'},
  bar:{type:'object',doc:'Floating glass bar: {leading:[…], trailing:[…]}. Use glass buttons, menus and pills.'},
  accessory:{type:'node',doc:'Shown under the bar, e.g. a search field.'},
  body:{type:'node',required:true},
  sheets:{type:'object',doc:'Named sheets: {name: {title, body, detents:["medium","large"]}}. Open with {"sheet":"name"}.'},
  covers:{type:'object',doc:'Named full-screen pages: {name: {bar, body, background}}. Open with {"cover":"name","params":…}.'},
  refresh:{type:'object',doc:'How often the phone asks for data: {interval: 1.5, fast: 0.45, fastWhen: "$loading"} in seconds.'},
  timelines:{type:'object',doc:'Media positions that keep moving between updates: {"main": {"track": "$song.id", "position": "$song.current", "duration": "$song.duration", "playing": "$song.playing"}} (seconds). `scrubber` and `lyrics` follow them.'},
  persist:{type:'array',doc:'Screen variables this phone remembers between launches, e.g. ["face", "theme"].'},
  backdrop:{type:'url',doc:'An image (usually album art) whose colors tint the whole screen background.'},
  appear:{type:'action',doc:'Runs when the screen appears.'}
};

// ── Actions ──────────────────────────────────────────────────────────────────
// An action is one object, or a list run in order (a failing command stops the list).
const ACTIONS={
  command:{doc:'Sends a command to your app on the PC: {"command":"open","value":…}. Optional "app" sends it to another app, "result":"name" stores the reply in a screen variable, and "onError" runs an action if it fails (the error message is $error).',keys:['command','value','app','result','onError']},
  set:{doc:'Sets a screen variable: {"set":"query","value":""}.',keys:['set','value']},
  toggle:{doc:'Flips a true/false screen variable: {"toggle":"showSearch"}.',keys:['toggle']},
  sheet:{doc:'Opens a named sheet: {"sheet":"places"}.',keys:['sheet','params']},
  cover:{doc:'Opens a named full-screen page; its bindings can read "$params": {"cover":"post","params":"$post"}.',keys:['cover','params']},
  dismiss:{doc:'Closes the sheet or page this action runs in: {"dismiss":true}.',keys:['dismiss']},
  open:{doc:'Opens a web page on the phone: {"open":"$post.url"}.',keys:['open']},
  copy:{doc:'Copies text, or an image given as a data: URL or {"kind":"image","data":…}: {"copy":"$post.url"}.',keys:['copy']},
  paste:{doc:'Reads the phone clipboard into a screen variable as {"kind":"text"|"image","data":…} (images as a PNG data: URL under 2 MB), or null: {"paste":"clip"}. The phone may ask once for permission.',keys:['paste']},
  photo:{doc:'Lets you choose a photo, keeps a copy on this phone and stores its path in a screen variable, for `image`: {"photo":"background","maxSize":1600}. Cancelling stops the list.',keys:['photo','maxSize']},
  haptic:{doc:'Plays a haptic: light, medium, heavy, selection, success, warning, error.',keys:['haptic']},
  refresh:{doc:'Asks the PC for fresh data now: {"refresh":true}.',keys:['refresh']},
  if:{doc:'Runs `then` or `else`: {"if":"$saved","then":…,"else":…}.',keys:['if','then','else']},
  keyboard:{doc:'Hides the phone keyboard: {"keyboard":"hide"}.',keys:['keyboard']}
};

// ── Expressions ──────────────────────────────────────────────────────────────
const OPERATORS={
  eq:'[a, b] equal',ne:'[a, b] not equal',gt:'[a, b] a > b',gte:'[a, b] a ≥ b',lt:'[a, b] a < b',lte:'[a, b] a ≤ b',
  not:'a — true when a is falsy',and:'[a, b, …] all truthy',or:'[a, b, …] first truthy value',
  if:'[test, then, else]',has:'a — not null, not empty',count:'a — length of a list or text',
  in:'[value, list] — list contains value (or text contains text)',startsWith:'[text, prefix]',
  concat:'[a, b, …] joins as text',coalesce:'[a, b, …] first value that is not null',
  add:'[a, b]',sub:'[a, b]',mul:'[a, b]',div:'[a, b]',min:'[a, b]',max:'[a, b]',
  lower:'text',upper:'text',join:'[list, separator]',first:'list',last:'list',
  find:'[list, path, value] — the first element whose path equals value, e.g. {"find": ["$members", "id", "$params"]}',
  slice:'[list, start, count] — part of a list',range:'n — [0, 1, … n-1]',round:'a — nearest whole number',floor:'a — rounded down',
  format:'{"format": "count|age|date|time|duration|percent|bytes|number", "value": …}'
};
const FILTERS=['count','age','date','time','duration','percent','bytes','number','upper','lower','json'];

// ── Validation ───────────────────────────────────────────────────────────────
const MAX_NODES=8000,MAX_DEPTH=48;
const isBinding=value=>typeof value==='string'&&(/^\$[A-Za-z_][\w]*(\.[\w]+|\[\d+\])*$/.test(value)||/\{\{[^}]+\}\}/.test(value));
const isOperator=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>=1&&Object.keys(value).every(k=>k in OPERATORS||k==='value')&&Object.keys(value).some(k=>k in OPERATORS);
const isExpression=value=>isBinding(value)||isOperator(value);
const COLOR_RE=/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SYMBOL_RE=/^[a-z0-9.]{1,80}$/;

function createValidator(){
  const errors=[];let nodes=0;
  const fail=(at,message)=>{if(errors.length<40)errors.push(`${at}: ${message}`);};
  function checkValue(spec,value,at){
    if(value==null)return;
    if(isExpression(value))return;
    switch(spec.type){
      case 'string':if(typeof value!=='string'&&typeof value!=='number')fail(at,'must be text');break;
      case 'number':if(typeof value!=='number'||!Number.isFinite(value))fail(at,'must be a number');break;
      case 'bool':if(typeof value!=='boolean')fail(at,'must be true or false');break;
      case 'color':if(typeof value!=='string'||!(COLORS.includes(value)||COLOR_RE.test(value)))fail(at,`must be a color (${COLORS.slice(0,6).join(', ')}…, or #RRGGBB)`);break;
      case 'symbol':if(typeof value!=='string'||!SYMBOL_RE.test(value))fail(at,'must be an SF Symbol name like "star.fill"');break;
      case 'url':if(typeof value!=='string'||!(/^https:\/\//.test(value)||/^[\w-][\w./-]*$/.test(value)&&!value.includes('..')))fail(at,'must be an https URL or a path inside the package');break;
      case 'enum':if(!spec.values.includes(value))fail(at,`must be one of ${spec.values.join(', ')}`);break;
      case 'array':if(!Array.isArray(value))fail(at,'must be a list');break;
      case 'object':if(typeof value!=='object'||Array.isArray(value))fail(at,'must be an object');break;
      case 'node':node(value,at);break;
      case 'nodes':if(!Array.isArray(value))fail(at,'must be a list of components');else value.forEach((child,i)=>node(child,`${at}[${i}]`));break;
      case 'action':action(value,at);break;
      case 'items':items(value,at);break;
      case 'options':if(!Array.isArray(value))fail(at,'must be a list of {value, label}');else value.forEach((o,i)=>{if(!o||typeof o!=='object'||!('value' in o)||!('label' in o))fail(`${at}[${i}]`,'needs value and label');});break;
    }
  }
  function action(value,at){
    if(Array.isArray(value)){value.forEach((step,i)=>action(step,`${at}[${i}]`));return;}
    if(!value||typeof value!=='object'){fail(at,'must be an action object');return;}
    const kind=Object.keys(ACTIONS).find(k=>k in value);
    if(!kind){fail(at,`unknown action; use one of ${Object.keys(ACTIONS).join(', ')}`);return;}
    for(const k of Object.keys(value))if(!ACTIONS[kind].keys.includes(k))fail(at,`"${k}" is not used by the ${kind} action`);
    if(kind==='if'){if(value.then)action(value.then,at+'.then');if(value.else)action(value.else,at+'.else');}
    if(kind==='command'&&value.onError)action(value.onError,at+'.onError');
  }
  function items(value,at){
    if(isExpression(value))return;
    if(!Array.isArray(value)){fail(at,'must be a list of menu items');return;}
    value.forEach((item,i)=>{
      const here=`${at}[${i}]`;
      if(!item||typeof item!=='object'){fail(here,'must be a menu item');return;}
      if(item.divider===true)return;
      if(item.section!==undefined){items(item.items||[],here+'.items');return;}
      if(item.each!==undefined){if(!item.item)fail(here,'"each" needs an "item" template');return;}
      if(item.label==null)fail(here,'needs a label');
      if(item.action)action(item.action,here+'.action');
      if(item.items)items(item.items,here+'.items');
    });
  }
  function node(value,at,depth=0){
    if(++nodes>MAX_NODES){fail(at,'the screen is too large');return;}
    if(depth>MAX_DEPTH){fail(at,'components are nested too deeply');return;}
    if(!value||typeof value!=='object'||Array.isArray(value)){fail(at,'must be a component object with a "type"');return;}
    const spec=C[value.type];
    if(!spec){fail(at,`unknown component "${value.type}"`);return;}
    const here=`${at}<${value.type}>`;
    for(const [name,prop] of Object.entries(spec.props))if(prop.required&&value[name]==null)fail(here,`needs "${name}"`);
    for(const [name,v] of Object.entries(value)){
      if(name==='type')continue;
      const prop=spec.props[name]||COMMON[name];
      if(!prop){fail(here,`"${name}" is not a ${value.type} property`);continue;}
      if(prop.type==='node'){if(v!=null)node(v,`${here}.${name}`,depth+1);}
      else if(prop.type==='nodes'){if(!Array.isArray(v))fail(`${here}.${name}`,'must be a list of components');else v.forEach((child,i)=>node(child,`${here}.${name}[${i}]`,depth+1));}
      else checkValue(prop,v,`${here}.${name}`);
    }
    if(value.type==='split'&&Array.isArray(value.children)&&value.children.length!==2)fail(here,'needs exactly two children');
  }
  function screen(value){
    if(!value||typeof value!=='object'||value.type!=='screen'){fail('screen','the root must be {"type":"screen", …}');return;}
    for(const [name,prop] of Object.entries(SCREEN))if(prop.required&&value[name]==null)fail('screen',`needs "${name}"`);
    for(const [name,v] of Object.entries(value)){
      if(name==='$schema')continue;// editor autocomplete
      const prop=SCREEN[name];
      if(!prop){fail('screen',`"${name}" is not a screen property`);continue;}
      if(name==='body'||name==='accessory')node(v,'screen.'+name);
      else if(name==='bar'){
        for(const side of Object.keys(v||{})){if(!['leading','trailing'].includes(side))fail('screen.bar',`"${side}" must be leading or trailing`);else checkValue({type:'nodes'},v[side],`screen.bar.${side}`);}
      }else if(name==='sheets'||name==='covers'){
        for(const [key,page] of Object.entries(v||{})){
          const at=`screen.${name}.${key}`;
          if(!page||typeof page!=='object'||!page.body){fail(at,'needs a body');continue;}
          node(page.body,at+'.body');
          if(page.bar)for(const side of Object.keys(page.bar))checkValue({type:'nodes'},page.bar[side],`${at}.bar.${side}`);
          if(page.accessory)node(page.accessory,at+'.accessory');
          for(const k of Object.keys(page))if(!['title','body','bar','accessory','let','detents','background'].includes(k))fail(at,`"${k}" is not a ${name==='sheets'?'sheet':'cover'} property`);
        }
      }else if(name==='appear')action(v,'screen.appear');
      else checkValue(prop,v,'screen.'+name);
    }
  }
  return {screen,node,errors};
}
function validateScreen(screen){
  const validator=createValidator();validator.screen(screen);
  return validator.errors;
}

module.exports={COMPONENTS:C,COMMON,SCREEN,ACTIONS,OPERATORS,FILTERS,COLORS,TEXT_STYLES,validateScreen,isExpression};

window.KitSpec=module.exports;})();
