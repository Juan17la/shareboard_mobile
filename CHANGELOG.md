# Changelog

All notable changes to the Shareboard mobile app. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). `git_scripts/release.sh` turns
`Unreleased` into the released version.

## [Unreleased]

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
