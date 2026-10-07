# Features

Everything Shareboard can do, tool by tool. The web app and the Android app
offer the same features. Where they differ, it is said.

- [The board](#the-board)
- [Tools](#tools)
- [Selecting and editing](#selecting-and-editing)
- [Arrows that connect figures](#arrows-that-connect-figures)
- [Draw to shape](#draw-to-shape)
- [Draw with AI](#draw-with-ai)
- [Working together](#working-together)
- [Sharing a board](#sharing-a-board)
- [Who can see and who can edit](#who-can-see-and-who-can-edit)
- [Your offline board](#your-offline-board)
- [Export and import](#export-and-import)
- [Settings](#settings)
- [Keyboard shortcuts (web)](#keyboard-shortcuts-web)
- [Limits](#limits)

## The board

- **Infinite canvas.** Draw anywhere; there are no edges and no pages.
- **Move and zoom.** Two fingers move and pinch-zoom (25 % to 600 %). On a
  computer: mouse wheel or trackpad to move, **Ctrl + wheel** to zoom, or hold
  **Space** / the right button and drag. The zoom bar has −, +, the zoom level
  (tap to reset to 100 %) and **fit to content**.
- **Double tap** on empty board zooms in, or back to 100 %.
- **Dot grid** as a visual guide (can be turned off).
- **Light or dark board.** The dark board uses a dark background and light ink.
- **Undo / redo**, up to 100 steps. Undo only takes back *your own* changes,
  never someone else's.
- A board opens already framed on what it contains.

## Tools

| Tool | Key (web) | What it does |
|------|-----------|--------------|
| Cursor | V | Select, move, resize, rotate |
| Hand | H | Move the board with one finger or the left button |
| Pencil | P | Freehand drawing, smoothed as you draw |
| Eraser | E | Wipe over anything to delete it; erased things fade until you lift |
| Rectangle, Circle, Triangle, Polygon | R, O, Y, G | Drag to draw a figure |
| Line, Arrow | L, A | Drag to draw a line or an arrow |
| Text | T | Tap to write |
| Fill | F | Tap a figure to paint its background |

On a phone the figures share one **Shapes** button (S).

### Options for each tool

The options strip next to the toolbar changes with the tool:

- **Colour.** A quick palette plus a full colour picker with a HEX field.
- **Width.** Four stroke weights.
- **Stroke style.** Solid, dashed or dotted, for every figure and line.
- **Background** of a figure: any colour with opacity, or none.
- **Corners:** sharp or rounded, for rectangles, triangles and polygons.
- **Polygon sides:** 4 to 12.
- **Text:** four sizes (small to extra large), four typefaces (rounded,
  serif, monospace, handwritten), bold, italic, underline, and left / centre /
  right alignment.
- **Lines and arrows:** straight, curved or elbow route, and 15 end markers
  for each end (arrow, triangle, circle, diamond, bar, and the crow's-foot
  marks used in database diagrams: one, many, zero-or-one…).

### Text on figures

Any figure or line can carry a label. Select it and tap **Aa**, or start
typing. A figure's label can be aligned horizontally and vertically (or fully
centred in one tap). A line's label can be dragged along the line.

## Selecting and editing

With the cursor:

- **Tap** an element to select it; it gets handles.
- **Drag** to move. **Corner handles** resize. The **round handle** above rotates
  (figures, text and images).
- **Drag on empty space** (or long-press and drag on a phone) to select
  several with a rectangle. Several selected elements move and resize together.
- **Curved lines** have handles to bend them. **Elbow lines** have a diamond on
  the middle segment to slide the corner.
- **Group / ungroup:** grouped elements are selected and moved as one.
- **Order:** bring to front, bring forward, send backward, send to back.
- **Copy, cut, paste, duplicate, delete.** A copy can be pasted on another
  board.

Where the menu is:

- **Web:** right-click an element (or empty board, to paste), or use the
  [keyboard shortcuts](#keyboard-shortcuts-web).
- **Android:** hold your finger on an element for a moment.

After drawing a figure or a text, the cursor comes back with the new element
selected, so you can adjust it right away. The pencil, hand, eraser and fill
stay in hand.

## Arrows that connect figures

Draw an arrow from one figure to another and both ends **attach**. While you
draw, each figure shows its nearest connection points, and the one the end will
attach to is framed. Move a figure later and its arrows follow it.

- Arrows attach to figures, text and images, each end on its own.
- An elbow arrow leaves a figure straight out of its side and goes around it,
  not through it.
- Plain lines do not attach; only arrows do.

## Draw to shape

Turn it on in the pencil's options (the pencil icon gains a ruler). Then draw
roughly and Shareboard turns the stroke into a clean figure:

- lines and arrows (a small loop at either end becomes the arrowhead),
- circles and ellipses, rectangles and squares,
- triangles (right, scalene…), trapezoids, parallelograms and other polygons.

The figure it recognised shows faintly while you draw and lands when you lift.
Nearly level, upright or diagonal lines snap straight, and nearly symmetric
figures are made symmetric. A stroke it cannot read stays freehand.

## Draw with AI

Tap the **✦** button and describe what you want: "a house with a tree and the
sun", "a login flow diagram", "a hexagon with the six phases of design
thinking". The drawing appears as a **preview** first. **Add to board** places
it in the middle of your screen; **Discard** throws it away.

The AI draws with ordinary figures, arrows and text, so everything it makes can
be moved and edited afterwards. It needs an internet connection and is limited
to 10 requests per minute.

## Working together

- **Live drawing.** Everything anyone draws appears for everyone a fraction of
  a second later.
- **Live cursors** with each person's name and colour (can be hidden in
  Settings).
- **Who is here.** The header shows how many people are online; tap it to see
  the list.
- **No conflicts.** When someone selects an element, it is theirs until they
  let go: nobody else can move or change it at the same moment.
- **Same person, several devices.** You can have the same board open in two
  tabs, or on your laptop and your phone; each one stays connected.
- **Connection status.** The header says *Connecting…*, *Reconnecting…* or
  *Offline*. While offline, a live board is read-only so nothing you draw gets
  lost; it reconnects by itself (and immediately when you come back to the
  tab or the app).

## Sharing a board

**Share** opens a sheet with:

- the board's **code**: six characters without look-alikes (no `0/O`, `1/I/L`),
  shown as `K7M·Q2R` and typed with or without the dot;
- a **link** (`https://shareboard-web.vercel.app/b/K7MQ2R`) with a copy button;
- a **QR code** to open it from another device;
- on Android, **WhatsApp** and **More…** (the system share sheet).

To open someone's board: **+ New / Join → Join with a code**, then type or
paste the code or the link. Links of the form `shareboard://board/<id>` open
the Android app directly.

**+ New / Join** also creates a new blank board, with an optional name.

## Who can see and who can edit

Open **Permissions** (the board's creator only):

- **Visibility.** *Public:* anyone with the code or link can enter.
  *Private:* a **4-digit PIN** is also needed. The creator can see the PIN and
  generate a new one.
- **Who can edit.**
  - *Everyone:* anyone who enters can draw.
  - *Selected:* only the people the creator picks. In the people list, tap a
    name to give or take edit permission.
  - *Only me:* the others can only watch.

People who cannot edit see the board live, without tools, and the header says
*Read only*. A change of permissions applies instantly to everyone connected.

The creator can also **rename** the board, **clear** it (for everyone; can be
undone once) and **delete** it. Deleting disconnects everyone and makes the
code stop working.

## Your offline board

The app always opens on a board kept **only on this device**. It needs no
internet, survives restarts, and nobody else can see it.

- **Share** turns it into a live board: a *copy* is uploaded and opened. The
  offline board stays as your private copy.
- **Draw with AI** works on it while you are online.
- **My whiteboards** lists it first. If the server has not been reached for
  five hours, live boards are hidden from the list until it answers again, so
  you are not offered boards you cannot open.

## Export and import

**Export** (the download button in the header):

- **PNG**, **JPG** or **SVG**, cropped to what is drawn.
- **Transparent background** (PNG and SVG).
- **The whole board or just the selection.**
- **Download**, **copy the image** (web), or **save to the gallery / share
  the image** (Android).
- **Export .json**: the board as an editable file.

**Exported pictures are still editable.** A PNG or JPG exported from
Shareboard carries the board inside it. The picture opens normally in any
viewer, and when you import it back into Shareboard (on the web or the phone)
every stroke and text is editable again.

**Import** (⋯ menu → Import, or drop a file on the web page):

- a Shareboard `.json` file or exported picture → a **new board** with
  everything editable (turn off *Restore editable strokes and text* to add it
  as a flat picture instead);
- any other picture (PNG, JPG, WebP, GIF, SVG) → placed on the board as an
  image. Big photos are shrunk to fit. On Android you can also paste an image.

Importing never overwrites a shared board; it always creates a new one.

## Settings

| Setting | |
|---------|--|
| Name and icon | How you appear to others |
| Board name | Rename (creator only) |
| Language | Español / English |
| Dark board | Dark background, light ink |
| Dot grid | Show the grid |
| Others' cursors | Show who draws where |
| Smooth stroke | Smooth freehand lines |
| Vibration (Android) | Haptic feedback on the tools |
| Replay the tutorial | The six-step walkthrough |
| Clear / Delete board | Creator only |

Settings are kept on each device.

## Keyboard shortcuts (web)

| Keys | Action |
|------|--------|
| V H P E | Cursor, hand, pencil, eraser |
| R O Y G L A | Rectangle, circle, triangle, polygon, line, arrow |
| T, F | Text, fill |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+A | Select all |
| Ctrl+C / X / V | Copy, cut, paste |
| Ctrl+D | Duplicate |
| Delete | Delete the selection |
| Arrow keys | Move the selection |
| Esc | Deselect |
| Ctrl + / Ctrl − | Zoom |
| Ctrl+0 | Back to 100 % |
| Shift+1 | Fit to content |
| Space + drag, or right button + drag | Move the board |

On macOS use ⌘ instead of Ctrl.

## Limits

| | |
|--|--|
| Elements per board | 5,000 |
| Text length | 2,000 characters |
| Nickname | 40 characters |
| Board name | 80 characters |
| New boards | 10 per hour from one address |
| Wrong PIN attempts | 5 per minute |
| AI drawings | 10 per minute |
| A single pasted image | about 256 KB after shrinking |
