# 2. Functional requirements

Each requirement has an ID, a priority (**M**ust / **S**hould / **C**ould) and,
when it applies to only one part of the system, a platform tag ([W] web,
[A] Android, [S] server). Acceptance criteria are written so that a tester can
check them by hand.

- [FR-1 Start and offline board](#fr-1-start-and-offline-board)
- [FR-2 Identity and accounts](#fr-2-identity-and-accounts)
- [FR-3 Board management](#fr-3-board-management)
- [FR-4 Canvas and navigation](#fr-4-canvas-and-navigation)
- [FR-5 Drawing tools](#fr-5-drawing-tools)
- [FR-6 Styling options](#fr-6-styling-options)
- [FR-7 Selection and editing](#fr-7-selection-and-editing)
- [FR-8 Smart drawing](#fr-8-smart-drawing)
- [FR-9 Real-time collaboration](#fr-9-real-time-collaboration)
- [FR-10 Sharing and joining](#fr-10-sharing-and-joining)
- [FR-11 Access control](#fr-11-access-control)
- [FR-12 Export and import](#fr-12-export-and-import)
- [FR-13 Settings and help](#fr-13-settings-and-help)

---

## FR-1 Start and offline board

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-1.1 | M | On launch the app shall open directly on the device's **offline board**, creating it the first time. There is no home or login screen. |
| FR-1.2 | M | The offline board shall work with no network connection and survive app restarts. |
| FR-1.3 | M | The offline board shall be visible only on the device that holds it; the header shall say *Only on this device*. |
| FR-1.4 | S | If the device cannot store the offline board, the app shall open the last live board visited, or create a new live one. |
| FR-1.5 | S | On first launch the app shall offer a six-step tutorial (draw, options, hold to shape, select, arrows/text, share), which can be skipped. |
| FR-1.6 | S | A live board that no longer exists shall be removed from recents and the user returned to the start route. |

*Acceptance:* in airplane mode, a fresh install opens on *My board* and
strokes drawn there are still present after the app is killed and reopened.

## FR-2 Identity and accounts

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-2.1 | M | Each device shall generate a random, persistent user id on first run; a guest uses it to draw and join. |
| FR-2.2 | M | Before entering a live board the first time, the user shall choose a **nickname** (≤ 40 chars) and an **icon colour**; both are remembered. |
| FR-2.3 | M | [S] A nickname already used by someone connected to the board shall be rejected (`NICKNAME_TAKEN`) and the identity screen shown again with the reason. |
| FR-2.4 | M | [S] The server shall honour the requested colour unless another connected participant holds it, and return the authoritative colour. |
| FR-2.5 | M | A user shall be able to **register** with username (3–24 chars: letters, digits, `.`, `_`), email and password (≥ 8 chars). Registration reuses the current nickname and icon and adopts the guest's boards. |
| FR-2.6 | M | A user shall be able to **sign in** with username or email and password, and **sign out**. |
| FR-2.7 | M | Sharing a board shall require a **verified email**: the server sends a 6-digit code that the user enters in the app; the code can be resent. |
| FR-2.8 | S | A user shall be able to **reset a forgotten password** with a 6-digit emailed code. |
| FR-2.9 | S | A signed-in user shall be able to change password (signing out other sessions) and add or change email, confirming with the current password. |
| FR-2.10 | M | The app shall ask for an account **only** when an action needs one (share, new live board, import as board), explaining why, and return to that action after sign-in. |
| FR-2.11 | S | An expired session shall be reported (*Your session expired*) and the user asked to sign in again. |

## FR-3 Board management

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-3.1 | M | An account holder shall create a **new blank live board** (optional name, default *Untitled board*), public and editable by everyone. |
| FR-3.2 | M | [S] Each live board shall get a unique id and a unique 6-character short code. |
| FR-3.3 | M | *My whiteboards* shall list the offline board first, then recent and owned live boards with relative time (*5 min ago*) and a *Yours*/*Private* badge. |
| FR-3.4 | S | A recent board can be removed from the list (*Remove from recent*). |
| FR-3.5 | S | If the server has not been reached for 5 hours, live boards shall be hidden from the list until it answers. |
| FR-3.6 | M | The creator shall **rename** the board (≤ 80 chars). |
| FR-3.7 | M | The creator shall **clear** the board for everyone, after confirmation; the clear can be undone once. |
| FR-3.8 | M | The creator shall **delete** the board after confirmation; everyone is disconnected and the code stops working. |
| FR-3.9 | M | Switching between boards shall happen inside the board screen without reloading the app. |

## FR-4 Canvas and navigation

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-4.1 | M | The canvas shall be infinite, with pan and zoom between 10 % and 2,000 %. |
| FR-4.2 | M | Touch: two fingers pan and pinch-zoom; one finger on empty board pans; double tap on empty board zooms in or back to 100 %. |
| FR-4.3 | M | [W] Mouse: wheel/trackpad pans, Ctrl + wheel zooms, Space + drag or right-button drag pans. |
| FR-4.4 | M | The zoom control shall offer −, +, current level (tap → 100 %) and *fit to content*. |
| FR-4.5 | M | A board shall open framed on its content. |
| FR-4.6 | M | **Undo / redo** up to 100 steps, affecting only the user's own changes. |
| FR-4.7 | S | A dot grid and a dark board (dark ground, light ink) shall be available as settings. |
| FR-4.8 | M | The camera (pan/zoom) shall be personal and never broadcast. |

## FR-5 Drawing tools

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-5.1 | M | **Cursor**: select, move, resize, rotate. |
| FR-5.2 | M | **Hand**: pan with one finger or the left button. |
| FR-5.3 | M | **Pencil**: freehand strokes, smoothed while drawing. Modes: *Pen*, *Highlighter* (translucent), *Laser pointer* (red trail visible to all for ~1 s, never stored). |
| FR-5.4 | M | **Eraser**: deletes what it touches; erased items fade until the finger is lifted. |
| FR-5.5 | M | **Figures**: rectangle, circle/ellipse, triangle, polygon (4–12 sides), drawn by dragging. [A] On phones they share one *Shapes* button. |
| FR-5.6 | M | **Line** and **Arrow**, drawn by dragging. |
| FR-5.7 | M | **Sticky note**: tap to place and type; long text shrinks to fit; colour selectable; *Vote dot* places a dot in the user's colour. |
| FR-5.8 | M | **Text**: tap to place and type (≤ 2,000 chars). |
| FR-5.9 | M | **Fill**: tap a figure to paint its background. |
| FR-5.10 | S | After drawing a figure or text, the tool shall return to the cursor with the new element selected; pencil, hand, eraser and fill stay active. |
| FR-5.11 | M | [W] Every tool shall have a single-key shortcut (V H P E R O Y G L A N T F). |
| FR-5.12 | M | Users without edit permission shall not see the drawing tools. |

## FR-6 Styling options

The options strip shall show only the options of the tool or selection in hand.

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-6.1 | M | Colour: quick palette plus a full picker with HEX input (3 or 6 digits, validated). |
| FR-6.2 | M | Width: four stroke weights. |
| FR-6.3 | M | Stroke style: solid, dashed, dotted, for every figure and line. |
| FR-6.4 | M | Background of a figure: any colour with opacity, or none. |
| FR-6.5 | S | Corners: sharp or rounded (rectangle, triangle, polygon). |
| FR-6.6 | M | Text: 4 sizes, 4 typefaces (rounded, serif, monospace, handwritten), bold, italic, underline, left/centre/right alignment. |
| FR-6.7 | M | Lines and arrows: straight, curved or elbow route; 15 end markers per end, including crow's-foot cardinality marks. |
| FR-6.8 | S | Any figure or line can carry a label; figure labels align horizontally and vertically; line labels slide along the line. |

## FR-7 Selection and editing

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-7.1 | M | Tap selects an element with handles; dragging on empty space (long-press + drag on phone) selects several with a rectangle. |
| FR-7.2 | M | Selected elements can be moved, resized (corner handles) and rotated (round handle) together. |
| FR-7.3 | S | Curved lines expose bend handles; elbow lines expose a handle to slide the middle segment. |
| FR-7.4 | M | Group / ungroup; bring to front, forward, backward, send to back. |
| FR-7.5 | M | Copy, cut, paste (also across boards), duplicate, delete. |
| FR-7.6 | M | Context actions shall open by right-click [W] or press-and-hold [A]. |
| FR-7.7 | S | Lock / unlock: a locked element cannot be selected, moved or erased until unlocked. |
| FR-7.8 | M | [W] Keyboard: Ctrl+Z/Y, Ctrl+A, Ctrl+C/X/V, Ctrl+D, Delete, arrow keys to nudge, Esc to deselect, `?` for the shortcut list (⌘ on macOS). |

## FR-8 Smart drawing

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-8.1 | M | **Hold to shape**: holding the pencil still ~0.5 s at the end of a stroke shall replace it with a clean line, arrow, ellipse, rectangle, triangle or polygon; the figure follows the finger until lifted; near-level lines and near-symmetric figures snap. An unrecognised stroke stays freehand. |
| FR-8.2 | M | **Connected arrows**: an arrow whose end lands on a figure, text or image attaches to it; connection points are shown while drawing; attached arrows follow when the figure moves; elbow arrows route around figures. Plain lines never attach. |
| FR-8.3 | S | **Templates**: brainstorm, retro, flowchart, Kanban, mind map, placed in the middle of the screen or beside existing content, with locked backgrounds. |
| FR-8.4 | S | **Draw with AI**: the user describes a drawing in text; a preview is shown; *Add to board* places it at the centre of the screen as ordinary editable elements, *Discard* drops it. |
| FR-8.5 | M | [S] AI output shall be validated like client input, capped at 200 elements, and arrows between figures created as attached arrows. |

## FR-9 Real-time collaboration

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-9.1 | M | Every change shall appear on the author's screen immediately (optimistic) and on everyone else's within a fraction of a second. |
| FR-9.2 | M | [S] The server shall validate each op, assign order (`seq`, `z`), store and broadcast it to all participants including the sender. |
| FR-9.3 | M | Live cursors with name and colour; can be hidden in settings. |
| FR-9.4 | M | The header shall show the number of people online; tapping it opens the participant list with roles. |
| FR-9.5 | M | **Selection locks**: an element selected by one person cannot be changed by another until released. |
| FR-9.6 | S | **Reactions**: an emoji that floats up on everyone's screen. |
| FR-9.7 | S | **Timer**: an editor starts a shared countdown (1, 3, 5, 10 min or custom up to 3 h); everyone sees it and *Time's up!*. |
| FR-9.8 | M | The same person may have the same board open on several devices or tabs. |
| FR-9.9 | M | Connection status shall be shown (*Connecting…*, *Reconnecting…*, *Offline*); while offline a live board becomes read-only and reconnects automatically (immediately on returning to the app). |
| FR-9.10 | M | [S] A client whose optimistic state diverged shall be told to resync and receive the full board. |

## FR-10 Sharing and joining

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-10.1 | M | *Share* on a live board shall show the code (`K7M·Q2R`, tap to copy), the link `/b/<code>` with copy button, and a QR code. |
| FR-10.2 | S | [A] Share sheet shall also offer WhatsApp and the system share sheet. |
| FR-10.3 | M | *Share* on the offline board shall offer: *Share this board* (uploads a copy; the offline board stays private) or *Create a new shared board* (blank). |
| FR-10.4 | M | *Join with a code* shall accept the code with or without the dot, any case, surrounding spaces, or a full link. Invalid input shows *Enter a 6-character code or a link*. |
| FR-10.5 | M | [W] Opening `/b/<code>` shall resolve to the board or show *board not found* with a way back. |
| FR-10.6 | S | [A] Deep links `shareboard://board/<id>` shall open the Android app on that board. |

## FR-11 Access control

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-11.1 | M | Visibility: **Public** (code or link is enough) or **Private** (4-digit PIN also needed). |
| FR-11.2 | M | Making a board private shall generate a PIN; the creator can see it and generate a new one; others see it masked. |
| FR-11.3 | M | Joining a private board shall show a full-screen 4-digit keypad, submit on the 4th digit and clear the dots on a wrong PIN. |
| FR-11.4 | M | The creator, and accounts that already got in, shall not be asked for the PIN again. |
| FR-11.5 | M | Editing policy: **Everyone**, **Selected people** (creator toggles each person in the people list), **Only me**. |
| FR-11.6 | M | Permission changes apply instantly to everyone connected, with no save button; a rejected change is reverted and reported. |
| FR-11.7 | M | Viewers see the board live without tools and a *View only* label. |
| FR-11.8 | M | [S] The server shall reject ops from users who cannot edit (`FORBIDDEN`), independent of the client. |
| FR-11.9 | M | Only the creator can change name, visibility, PIN, policy, clear or delete. |

## FR-12 Export and import

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-12.1 | M | Export as **PNG**, **JPG** or **SVG**, cropped to content, with preview and size (*W × H px · N elements*). |
| FR-12.2 | S | Transparent background option (PNG, SVG); JPG hidden when transparent. |
| FR-12.3 | S | Export the whole board or only the selection. |
| FR-12.4 | M | Download; [W] copy image to clipboard; [A] save to gallery or share image. |
| FR-12.5 | M | Export the board as an editable **.json** file. |
| FR-12.6 | M | PNG and JPG exports shall embed the board JSON so that re-importing restores every element as editable. |
| FR-12.7 | M | Import a Shareboard `.json` or exported picture as a **new board** (never overwriting an existing one); option to add it as a flat picture instead. |
| FR-12.8 | M | Import any picture (PNG, JPG, WebP, GIF, SVG) onto the current board as an image, shrunk to ~256 KB. [W] Drag and drop; [A] paste image. |

## FR-13 Settings and help

| ID | Pri | Requirement |
|----|-----|-------------|
| FR-13.1 | M | Settings: name and icon, board name (creator), language (Español/English), dark board, dot grid, others' cursors, smooth strokes, [A] haptics, replay tutorial, clear/delete (creator). |
| FR-13.2 | M | Settings shall be stored per device and applied immediately. |
| FR-13.3 | S | [W] A keyboard shortcut sheet shall be reachable from the menu and with `?`. |
| FR-13.4 | S | [A] When a newer release exists on GitHub, the app shall offer to download it (*Version X is out*). |
| FR-13.5 | M | Every action shall give feedback: toasts for success (*Code copied*, *Board deleted*…) and clear messages for errors. |
