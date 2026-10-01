# Changelog

All notable changes to the Shareboard mobile app. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). `git_scripts/release.sh` turns
`Unreleased` into the released version.

## [Unreleased]

### Changed

- The options strip is one compact row of boxes instead of a wall of buttons:
  colour (a ring for a shape's border, a dot for pen, text and fill tool), fill,
  the four widths in a row, and — for lines — the two ends, the dash (one tap
  steps through solid, dashed, dotted) and the route. A box that has more to
  say (colour, shape kind and polygon sides, ends, route and elbow axes, a
  shape's label size and font) opens a small panel above the strip. Text keeps
  its size, fonts, bold and italic in the strip itself; the eraser shows only
  its four widths.
- A selected box, picture or text now has round handles on its corners (they
  were small squares), like the ends of a line.

### Fixed

- The pen's worklet takes the stroke-point limit as a number rather than the
  whole `LIMITS` object, which carries a RegExp.

## [1.2.0-beta] - 2026-09-30

### Added

- Holding a finger on a figure (with the cursor) selects it and opens a menu:
  copy, cut, paste, duplicate, to front, to back, group / ungroup, delete. On
  empty board the hold still offers paste.
- Copy puts the selection on the system clipboard as well as in the app, so it
  pastes as the same elements — arrows still bound to their shapes, groups,
  images — on another board, on the web, or on another phone. A picture or text
  copied in another app pastes as an image or a text element.

### Changed

- Fill is two options instead of four buttons: a colour (typed as a HEX code such
  as `#FF8800` or `f80`, or picked) and an opacity from 0 to 100%, in one sheet
  behind a single chip in the options strip (0% is no fill). The border's colour
  and the fill's are independent: recolouring the border no longer recolours the
  fill, and a new shape starts with a fill in its border's colour. Boards drawn
  with the old Light / Medium / Solid fills open exactly as before (18%, 50%, 100%).
- The options strip keeps only the style controls; copy, cut, stacking order and
  group moved to the hold menu.
- Edits sent in one burst (a paste of several images) are split to fit the
  server's frame limit instead of closing the connection.
- New app icon (launcher, adaptive and monochrome layers, splash and web favicon);
  the splash and the adaptive background are white.

### Changed

- Elbow lines choose their ends like a diagramming tool: by default they leave
  and arrive along the long axis — or straight out of the side of a shape they
  are bound to; a new row of options picks the direction at each end (across or
  up and down, in any pairing — two different ones make a single corner), and
  the middle segment is still dragged.
- Curved lines are cubic, with a handle on a stem at each end (the direction and
  pull as the line leaves and arrives) and one in the middle that slides the
  whole bow. Curves saved before look exactly as they did until they are shaped.
- A polygon has four sides at least (three is the triangle); a hand-drawn
  four-sided shape is read as a rectangle, or as a four-sided polygon (a diamond)
  when it stands on a corner — not as a triangle when one corner was drawn soft.
- When the pen is held and the stroke is read as a figure (circle, rectangle,
  polygon, line…), the figure is made on the board at once and stays: the pen,
  still down, then resizes it (pull out to grow it, in to shrink it; a line's tip
  follows) instead of turning it back into the stroke. One undo takes it all back.

### Fixed

- The AI preview can no longer take the answer with it: if a drawing cannot be
  painted, the reply and the Add/Discard buttons still show. (A polygon in a
  drawing was the cause of the error that replaced the answer, fixed with the
  polygon maths.)

### Changed

- A line's or arrow's label now sits **in** the line: the line is cut away
  behind the text (canvas, editor and SVG export alike), and the label is
  dragged along the line to move it (a dashed frame shows it is held when the
  line is selected). A touch on the label still picks the line. The place is a
  new `labelAt` (0..1 along the route).
- More connection points: an ellipse offers eight on its outline, a triangle and
  a polygon their corners and the middle of each side, a rectangle its corners
  and sides' middles, plus the centre (which aims at the other end). Line ends
  land on the real outline — no longer on the shape's box — and follow when the
  shape is resized.
- The pencil reads a hand-drawn polygon of five to eight corners as a polygon,
  and a held stroke turns into its figure after 700 ms instead of 800.
- Text fields have a clearly visible edge (accent, with a halo, while typing)
  instead of a hairline lost on the frosted panels; rows that hold a bare field
  draw one ring instead of two.
- The AI chat takes the whole height of the screen and reads top to bottom —
  the oldest message first, the newest last, following it down — with the input
  pinned under the list.
- A handle you take hold of keeps its distance from your finger.

### Fixed

- Polygons failed with "undefined is not a function": their corner maths is a
  worklet that captured a `clamp` helper declared further down the file, which
  is `undefined` at the moment a worklet is created. It now captures nothing it
  does not need.
- A line's label no longer has the line through it: it stands beside the line's
  midpoint on the side facing up (to the right of a vertical line), pushed off
  just far enough to clear it; a flat line's label stays exactly where it was.
  The editor, the canvas and the SVG export agree on the place.
- Double-tapping a line to write on it no longer moves an end of it: a handle
  keeps its distance from the finger that took hold of it instead of jumping
  under it, a nudge of a pixel or two is not committed as a move, and a move
  cannot pick up the offset of the drag before it.
- Sheets shrink to the screen and scroll (Settings' delete button was cut off,
  out of reach), Settings uses the tall sheet, and a sheet lifts above the
  keyboard (the join code input was covered).
- The Menu is one list again, without the heavy divider between groups.

### Changed

- There is no home screen. The app opens on the whiteboard you were last at, or
  — the first time, or when it is gone — makes a blank one and opens that, so
  there is always something to draw on at once. A guest name stands in until you
  pick one in the settings.
- Two buttons on the whiteboard hold the rest: **Menu** (new whiteboard, my
  whiteboards, join with a code, import, export, who can edit, who is here, the
  assistant) and **Settings** (your name and icon, the board's name, the
  switches, theme, language). The back button and the header's theme toggle are
  gone; both live in those two.

### Fixed

- Drawing or previewing a polygon no longer fails: its corner maths is a worklet
  and named the whole `LIMITS` object (which holds a RegExp, which cannot cross
  to the UI thread); it now uses plain numbers.

### Performance

- Pan and pinch run on the UI thread: they move the camera's shared value
  directly and the store gets the camera once, when the fingers lift. The
  selection frame and its handles sit in the camera's group, and the peers'
  cursors, the "held by" tags and the label button follow the same value, so a
  pan or a pinch no longer renders React or re-records the board at all.
- The pen draws on the UI thread: each touch sample appends to a shared buffer
  and the live stroke is rebuilt there (same curve as the committed one), with
  no JS work or React render per sample. The JS side only starts the stroke,
  reads a held stroke as a figure, and commits on lift. One-finger panning
  (hand tool, viewers) does the same.
- Carrying a selection with the cursor and drawing a rectangle, ellipse,
  triangle or polygon also run on the UI thread: the dragged elements and their
  frame are drawn through a shared offset, and the shape preview is rebuilt from
  two shared corners — no render per touch sample. Lines bound to what moves
  are still re-laid by JS, once a frame; lines and arrows are drawn by JS.
- The Android glass snapshots are taken once the board holds still (140 ms)
  instead of every ~90 ms while it moves, and a new one re-renders the panels'
  blur canvases only, not the whole board screen.
- Hit tests skip a stroke whose bounding box is nowhere near the point, so the
  eraser no longer walks every segment of every stroke per touch sample.
- A rotated element no longer gets a fresh copy on every render (which defeated
  its memo), and polygons build their path once per box.

### Fixed

- Undoing an erase (or a cut, or redoing a draw) puts the element back in its
  layer instead of on top of everything.
- A text is one undo step, and one that is left empty leaves none; one eraser
  scrub is one step, however many figures it crossed.
- Undo and redo let go of a selected element that is no longer there.
- An error about a single request (a refused batch, a rate limit) is a toast
  and a resync, not the "could not open" screen; edits waiting when the
  connection dropped are kept and sent after the rejoin (they used to be sent
  right behind `join`, before the server had the client on the board).

### Added

- A perf HUD (UI and JS frame rate) behind `EXPO_PUBLIC_PERF_HUD=1`, an
  `EXPO_PUBLIC_NO_MIRROR=1` switch for the Android glass snapshots, the `perf`
  and `perf-nomirror` EAS profiles, and `test/bench-board.mjs`, which writes a
  fixed 730-element board to import and measure against.

### Changed

- Home is more compact and keeps one card height across its tabs; it floats over
  an empty board (the dot grid) instead of a blurred demo board, which is gone.
- Home has a fourth tab, *Import*, and the logo sits above the name.
- All icons are [Phosphor](https://phosphoricons.com) (`phosphor-react-native`),
  mapped in `components/ui/Icon.tsx`.
- The accent is Apple's blue (`#0071E3`); filled buttons are flat with a hairline
  ring, a tight shadow and a deeper shade while pressed. Unverified on a device.

## [1.1.0-beta] - 2026-09-29

### Added

- The selected "who can edit" option is a hairline ring with a centred dot; the
  old 5.5 px ring looked like a heavy blob on the light theme.

- A board opens framed on its content, once per join (a reconnect leaves the
  camera alone). Unverified on a device.
- Nicknames may be 40 characters (was 24), matching the server.

- Selecting something holds it: the first person to select an element owns
  it until they deselect it or leave. Everyone else sees it dimmed, framed in
  that person's colour with their name on a tag, and cannot select, erase,
  fill or edit it.

- Export only what is selected: with a selection, the export sheet offers
  *Whole board* or *Selection* (selection first); the preview, the picture and
  the embedded board follow the choice.
- SVG export next to PNG and JPG, shared as a vector file (a photo library
  cannot hold one, so *Save* is for PNG/JPG).

- Font picker for text and figure labels: rounded (Nunito, the default),
  serif (Lora), monospace (JetBrains Mono) and handwritten (Caveat).
- Typing into a figure edits its label in place: the text appears exactly as
  it will look — centred, wrapped inside the figure, in its font and turn —
  instead of in a separate box. Text elements are edited in place too.

### Changed

- A figure's label wraps to fit inside the figure.

- Polygons with 3 to 12 sides: a new shape tool with a sides stepper in
  the options strip.
- Rotation: a selected figure, text or image has a round knob above it; drag
  it to turn the element (it snaps to 15° steps). Handles, hit-testing and
  arrow links follow the turned outline.
- Images behave like figures: arrows bind to them and follow them, and
  resizing from a corner keeps their proportions.
- Text can be resized like an image: its corners scale the font, and the
  handle on its right edge sets a width the text wraps to.

- Draw with AI shows a preview of each drawing first: *Add to board* puts it
  there as one group (one undo removes it), *Discard* drops it. The AI sheet is
  bigger to fit it.

- *Paste image* in the import sheet puts the clipboard's image on the board.
- WebP and GIF images can be imported from the file picker.

### Changed

- The ✦ AI button in the top-right controls is filled in the brand colour so it
  stands out.
- The board code reads as `ABC·DEF` in a sans font; codes typed or pasted with
  the `·` still join.

### Fixed

- Transparent PNG/WebP/GIF images keep their transparency instead of turning
  black.

## [1.0.0-beta.4] - 2026-09-26

### Fixed

- The app talks to the deployed server again
  (https://shareboard-server.onrender.com): 1.0.0-beta.3 was built for a
  placeholder URL and could not open boards.

## [1.0.0-beta.3] - 2026-09-26

### Changed

- Releases ship for Android only: the APK on each GitHub release; no iOS build.

## [1.0.0-beta.2] - 2026-09-26

### Added

- **Updates from GitHub releases** (Android): on launch the app checks the
  repo's releases and, when one newer than itself carries an APK, offers to
  download it; the system installer updates the app in place, boards and
  settings kept. `git_scripts/release.sh` now attaches the APK to the release.

## [1.0.0-beta.1] - 2026-09-25

First installable beta: an Android APK and an iOS ad hoc build from EAS.

### Added

- **Draw with AI** — the ✦ button next to undo/redo (or the board menu) opens a
  chat: describe a picture and it lands in the middle of your screen as separate
  figures, labels and connected arrows, for everyone on the board.
- **Copy, cut and paste** from the selection options.
- **Sketch to shape** — hold your finger still at the end of a stroke and it
  becomes the rectangle, ellipse, triangle, line or arrow it was meant to be.
- Cursor tool: select, marquee, move, resize, group, duplicate and reorder.
- Lines and arrows: 15 end markers, straight, curved or elbow routes with a
  fold handle, dash styles, and ends that bind to a shape and follow it.
- Shape resize and labels (long-press a shape to label it), hand tool, figure
  defaults, a two-row toolbar with a compact options strip.
- Home screen board card with a live demo board; name and board name asked on
  create; emoji avatars; delete a board.
- Dark theme, new palette and accent colour, frosted glass on Android.
- Builds point at a real server: the `beta` EAS profile bakes in
  `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_WS_URL`, and plain `http`/`ws` is
  allowed so a server on your laptop's Wi-Fi works.

### Changed

- Faster drawing on long boards: paths are parsed once, the stroke under the
  finger is built point by point, the grid is one path, peer cursors are
  applied once a frame, and the sorted element list is reused between touches.
- The in-app mock backend is gone; the app always talks to the server.

### Fixed

- A tap on a figure drawn above the selection picks that figure; after "send to
  back" it used to move everything behind it.
- Board text renders with the right fonts on device; the socket closes cleanly
  on leave; the undo history no longer drifts from the board.
- Toolbar fits narrow phones and is hidden for viewers; dark theme contrast in
  menus, fields and the text editor.

### Known limitations

- The iOS build needs a paid Apple Developer account, and the iPhone must be
  registered for ad hoc installs (`eas device:create`).
- Drawings made with AI are not in the undo history; select and delete them.

## [0.1.0-alpha.1] - 2026-09-10

### Added

- First preview: onboarding and session, board tools, import and export,
  Spanish and English, the board header and sheets.
