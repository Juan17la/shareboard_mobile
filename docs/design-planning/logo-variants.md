# Shareboard logo & icon variants

Sixty directions (1-20 lean on the S mark and the Metro Map; 21-40 on the whiteboard itself; 41-60 on class and planning props, with a few S-based ones) for the app logo / icon, all drawn from the "Metro Map" system in `DESIGN.md`: flat shapes, ink rings, the four transit lines (blue, green, orange, violet), no gradients, no blur. Each one is a self-contained SVG you can copy out of this file.

## How to reuse

- **Square icons** use a `0 0 128 128` viewBox with a 28-radius tile. Scale to any size; for app stores export 1024x1024 and let the OS round the corners (remove the `rx`).
- **Every colour is a CSS variable with a fallback**, so one SVG themes itself when inlined in HTML:

  | Variable | Default (light) | Suggested dark |
  |---|---|---|
  | `--sb-bg` | `#FFFFFF` | `#0B1424` |
  | `--sb-grey` | `#EEF1F5` | `#17233A` |
  | `--sb-ink` | `#0F1B2D` | `#F1F4F9` |
  | `--sb-night` | `#0B1424` | `#0B1424` |
  | `--sb-blue` | `#0072CE` | `#4C9BFF` |
  | `--sb-green` | `#00843D` | `#2BD47D` |
  | `--sb-orange` | `#E06F00` | `#FF8A3D` |
  | `--sb-violet` | `#6E4BD8` | `#A585FF` |
  | `--sb-sticky` | `#FFE27A` | `#FFE27A` |
  | `--sb-danger` | `#C8102E` | `#FF5A5F` |

  ```css
  [data-lp='dark'] { --sb-bg:#0B1424; --sb-grey:#17233A; --sb-ink:#F1F4F9; --sb-blue:#4C9BFF; --sb-green:#2BD47D; --sb-orange:#FF8A3D; --sb-violet:#A585FF; }
  ```
- As an `<img src>` or a file the variables are ignored and the defaults paint, so the same code also works as a plain `.svg`.
- Export to PNG: `magick -background none -density 600 logo.svg -resize 1024x1024 icon.png` (or `rsvg-convert -w 1024 logo.svg > icon.png`).
- Android adaptive icon: use variants 6, 9, 11 or 12 for the foreground (keep the mark inside the central 66%), and the tile colour as the background layer. Monochrome layer: any variant with every colour set to one ink.
- Favicon (16-32px): prefer 1, 6, 12 (few details). Avoid 7, 11, 16.

## Quick picks

| Goal | Variants |
|---|---|
| Safest evolution of today's logo | 2, 12 |
| Most on-brand with the Metro Map idea | 1, 6, 7, 17 |
| Tells "whiteboard" at a glance | 3, 8, 14 |
| Tells "collaboration" | 4, 13, 18 |
| Best on the dark landing | 9, 11, 6, 25, 27 |
| Remembered as "a whiteboard", no S needed | 21, 22, 23, 24, 37 |
| Academic, non-technical | 25, 26, 29, 30, 32, 33 |
| Academic and technical users both | 28, 36, 21, 26 |
| Class / school feel | 41, 42, 49, 54, 56 |
| Planning / time | 43, 44, 45, 46, 47, 59, 60 |
| Keeps the S | 45, 50, 51, 52, 53, 54, 55 |
| Favicon-safe (new set) | 24, 25, 33, 35, 38 |

## 1. Metro S

The S drawn as a transit line with three stations. The Metro Map north star, literally.

**Use:** Primary candidate. Works on light and dark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="14" stroke-linecap="round"/><circle cx="82" cy="38" r="8" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4"/><circle cx="64" cy="64" r="8" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4"/><circle cx="44" cy="89" r="8" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4"/>
</svg>
```

## 2. S + Cursor

Evolution of today's logo: blue S, green cursor, flat and with a cleaner stroke.

**Use:** Closest to the current identity; safest swap.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="16" stroke-linecap="round"/><path transform="translate(58 44) scale(1.5)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-green,#00843D)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```

## 3. Board Tile

A whiteboard with its dot grid and a live cursor on it.

**Use:** Reads as "whiteboard" instantly; good for the store listing.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><circle cx="30" cy="30" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="30" cy="50" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="30" cy="70" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="30" cy="90" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="50" cy="30" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="50" cy="50" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="50" cy="70" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="50" cy="90" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="70" cy="30" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="70" cy="50" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="70" cy="70" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="70" cy="90" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="90" cy="30" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="90" cy="50" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="90" cy="70" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><circle cx="90" cy="90" r="2.6" fill="var(--sb-bg,#FFFFFF)" opacity=".35"/><path transform="translate(56 52) scale(1.4)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-blue,#0072CE)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```

## 4. Two Cursors

Two people, two colours, one board. Cursors crossing paths.

**Use:** Highlights real-time collaboration.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-night,#0B1424)"/><path transform="translate(26 26) scale(1.5)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-blue,#0072CE)" stroke="var(--sb-night,#0B1424)" stroke-width="2.5" stroke-linejoin="round"/><g transform="translate(102 102) rotate(180)"><path transform="translate(0 0) scale(1.5)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-green,#00843D)" stroke="var(--sb-night,#0B1424)" stroke-width="2.5" stroke-linejoin="round"/></g>
</svg>
```

## 5. Code Badge

The share code pill: blue capsule, station ring, three code characters.

**Use:** Ties the icon to the "share a six-character code" idea.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="14" y="44" width="100" height="40" rx="20" fill="var(--sb-blue,#0072CE)"/><circle cx="36" cy="64" r="9" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="5"/><rect x="56" y="54" width="8" height="20" rx="4" fill="var(--sb-bg,#FFFFFF)"/><rect x="72" y="54" width="8" height="20" rx="4" fill="var(--sb-bg,#FFFFFF)"/><rect x="88" y="54" width="8" height="20" rx="4" fill="var(--sb-bg,#FFFFFF)"/>
</svg>
```

## 6. Station Ring

A single metro station: ringed circle on a line. Minimal and very scalable.

**Use:** Best at 16px (favicon, tab).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><path d="M0 64 H128" stroke="var(--sb-blue,#0072CE)" stroke-width="14"/><circle cx="64" cy="64" r="24" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-blue,#0072CE)" stroke-width="8"/><circle cx="64" cy="64" r="8" fill="var(--sb-ink,#0F1B2D)"/>
</svg>
```

## 7. Four Lines

The four Metro lines converging at one station.

**Use:** Most "brand system" of the set; use for splash and docs.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M16 34 H48 L64 64" stroke="var(--sb-blue,#0072CE)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 94 H48 L64 64" stroke="var(--sb-orange,#E06F00)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M112 34 H80 L64 64" stroke="var(--sb-violet,#6E4BD8)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M112 94 H80 L64 64" stroke="var(--sb-green,#00843D)" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="64" cy="64" r="13" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/>
</svg>
```

## 8. Sticky Note

Yellow sticky with folded corner and a cursor picking it up.

**Use:** Friendly, playful; matches the board paper colours.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M26 26 H102 V78 L78 102 H26 Z" fill="var(--sb-sticky,#FFE27A)"/><path d="M78 102 V78 H102 Z" fill="#00000026"/><path d="M40 46 H86 M40 60 H72" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" opacity=".75"/><path transform="translate(70 60) scale(1.3)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-blue,#0072CE)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```

## 9. Pen Stroke

One continuous marker stroke forming an S, with a round pen tip.

**Use:** Hand-drawn feel on a clean tile.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><path d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="12" stroke-linecap="round"/><circle cx="44" cy="89" r="9" fill="var(--sb-green,#00843D)"/>
</svg>
```

## 10. Speech Board

A chat bubble holding a squiggle: talk and draw together.

**Use:** Communicates comments + drawing.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-violet,#6E4BD8)"/><path d="M24 28 H104 a10 10 0 0 1 10 10 V82 a10 10 0 0 1 -10 10 H70 L48 112 V92 H24 a10 10 0 0 1 -10 -10 V38 a10 10 0 0 1 10 -10 Z" fill="var(--sb-bg,#FFFFFF)"/><path d="M32 64 q12 -22 24 0 t24 0 t16 -4" fill="none" stroke="var(--sb-violet,#6E4BD8)" stroke-width="7" stroke-linecap="round"/>
</svg>
```

## 11. Dot-Grid S

An S built from the board's dot grid. Pixel-quiet, very techy.

**Use:** Strong on dark; ties to the landing dot texture.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-night,#0B1424)"/><circle cx="26" cy="20.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="45" cy="20.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="64" cy="20.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="83" cy="20.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="102" cy="20.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="26" cy="34.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="45" cy="34.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="64" cy="34.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="83" cy="34.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="102" cy="34.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="26" cy="49.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="45" cy="49.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="64" cy="49.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="83" cy="49.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="102" cy="49.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="26" cy="63.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="45" cy="63.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="64" cy="63.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="83" cy="63.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="102" cy="63.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="26" cy="78.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="45" cy="78.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="64" cy="78.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="83" cy="78.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="102" cy="78.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="26" cy="92.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="45" cy="92.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="64" cy="92.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="83" cy="92.5" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="102" cy="92.5" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="26" cy="107.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/><circle cx="45" cy="107.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="64" cy="107.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="83" cy="107.0" r="5.2" fill="var(--sb-blue,#0072CE)" /><circle cx="102" cy="107.0" r="1.8" fill="var(--sb-bg,#FFFFFF)" opacity=".3"/>
</svg>
```

## 12. Cut-out S

White S knocked out of a solid blue tile, with a green dot.

**Use:** Classic app-icon silhouette; best for Android adaptive icons.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-blue,#0072CE)"/><path d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="16" stroke-linecap="round"/><circle cx="96" cy="32" r="9" fill="var(--sb-green,#00843D)"/>
</svg>
```

## 13. Overlap

Two translucent circles overlapping: shared space.

**Use:** Abstract and calm; good in headers.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><circle cx="50" cy="64" r="30" fill="var(--sb-blue,#0072CE)" opacity=".85"/><circle cx="78" cy="64" r="30" fill="var(--sb-green,#00843D)" opacity=".85"/><path d="M64 38.6 A30 30 0 0 1 64 89.4 A30 30 0 0 1 64 38.6 Z" fill="var(--sb-ink,#0F1B2D)" opacity=".9"/>
</svg>
```

## 14. Frame Corners

Viewfinder brackets around a cursor: infinite canvas, zoom to fit.

**Use:** Highlights the canvas / camera idea.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><path d="M28 50 V32 a4 4 0 0 1 4 -4 H50 M78 28 H96 a4 4 0 0 1 4 4 V50 M100 78 V96 a4 4 0 0 1 -4 4 H78 M50 100 H32 a4 4 0 0 1 -4 -4 V78" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="8" stroke-linecap="round"/><path transform="translate(52 48) scale(1.6)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-blue,#0072CE)" stroke="var(--sb-grey,#EEF1F5)" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```

## 15. Connector

Circle, arrow and square: the flowchart / connected-shapes tool.

**Use:** Shows the diagramming side.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><circle cx="36" cy="64" r="16" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="8"/><rect x="76" y="48" width="32" height="32" rx="6" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="8"/><path d="M56 64 H70 M64 56 L72 64 L64 72" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

## 16. Folded Board

A board with a folded corner (export / share) and an S crease.

**Use:** Document-like; suits file icons for exported boards.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M28 20 H78 L104 46 V108 H28 Z" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linejoin="round"/><path d="M78 20 V46 H104" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linejoin="round"/><path transform="translate(2 10) scale(.8)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="12" stroke-linecap="round"/>
</svg>
```

## 17. Enamel Plate

White enamel sign with the heavy ink border and the blue S: the signage look.

**Use:** Most faithful to DESIGN.md (ink ring + 5px rule).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><rect x="10" y="10" width="108" height="108" rx="20" fill="var(--sb-bg,#FFFFFF)"/><rect x="10" y="10" width="108" height="10" rx="5" fill="var(--sb-ink,#0F1B2D)"/><path transform="translate(6.4 12) scale(.9)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="14" stroke-linecap="round"/>
</svg>
```

## 18. Loop

An infinity loop in two colours: a flow that never ends, shared both ways.

**Use:** Abstract, ownable shape; good for motion.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 64 C48 38 20 40 20 64 C20 88 48 90 64 64" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="12" stroke-linecap="round"/><path d="M64 64 C80 38 108 40 108 64 C108 88 80 90 64 64" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="12" stroke-linecap="round"/>
</svg>
```

## 19. Stacked Boards

Three offset boards: multiple boards, one account.

**Use:** Suggests the boards list / templates.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="18" y="52" width="64" height="52" rx="10" fill="var(--sb-violet,#6E4BD8)"/><rect x="30" y="38" width="64" height="52" rx="10" fill="var(--sb-green,#00843D)"/><rect x="44" y="24" width="64" height="52" rx="10" fill="var(--sb-blue,#0072CE)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="4"/><path transform="translate(66 40) scale(1.1)" d="M0 0 L0 30 L8 22.5 L14 36 L20 33 L14 20.5 L25 20.5 Z" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-blue,#0072CE)" stroke-width="2" stroke-linejoin="round"/>
</svg>
```

## 20. Lockup

Horizontal logo: Metro S mark + "Shareboard" in Onest ExtraBold.

**Use:** Landing nav, README header, social cards. Width 400x96 scales freely.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 96" width="400" height="96">
<rect width="96" height="96" rx="22" fill="var(--sb-blue,#0072CE)"/><path transform="translate(-8.7 -7.8) scale(.9)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="13" stroke-linecap="round"/><text x="116" y="62" font-family="Onest, system-ui, sans-serif" font-weight="800" font-size="46" letter-spacing="-1.5" fill="var(--sb-ink,#0F1B2D)">Shareboard</text>
</svg>
```

## 21. Classic Whiteboard

The whiteboard everyone has sat in front of: frame, marker tray, a marker and a hand-drawn wave.

**Use:** The most universal "whiteboard" read. Strong at every size.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="16" y="20" width="96" height="62" rx="6" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><circle cx="64" cy="20" r="0" /><path d="M34 56 q10 -20 20 0 t20 0 t14 -6" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><rect x="22" y="82" width="56" height="10" rx="3" fill="var(--sb-ink,#0F1B2D)"/><rect x="30" y="73" width="20" height="9" rx="4.5" fill="var(--sb-blue,#0072CE)"/><rect x="54" y="73" width="20" height="9" rx="4.5" fill="var(--sb-green,#00843D)"/>
</svg>
```

## 22. Easel

A whiteboard on an A-frame easel: the classroom / workshop picture.

**Use:** Friendly and academic; great as a large splash image.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="26" y="18" width="76" height="54" rx="6" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><path d="M44 72 L30 112 M84 72 L98 112 M64 72 V112" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M38 48 q9 -16 18 0 t18 0" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 23. Marker Trail

A dry-erase marker leaving a blue trail. Pure "I am drawing something" energy.

**Use:** Playful and memorable; works well rotated on the tile.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><path d="M16 100 C28 78 40 112 58 90" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" /><g transform="rotate(40 64 64)"><rect x="52" y="14" width="24" height="60" rx="7" fill="var(--sb-ink,#0F1B2D)"/><rect x="52" y="14" width="24" height="20" rx="7" fill="var(--sb-blue,#0072CE)"/><path d="M56 74 H72 L68 90 H60 Z" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4" stroke-linejoin="round"/></g>
</svg>
```

## 24. Eraser Swipe

A board eraser wiping away a scribble.

**Use:** Distinctive; nobody else uses an eraser. Best at 48px and up.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M22 44 q14 -14 28 0 t28 0 t28 0 M22 64 q14 -14 28 0 t28 0" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".25"/><g transform="rotate(-12 64 78)"><rect x="26" y="58" width="76" height="40" rx="10" fill="var(--sb-blue,#0072CE)"/><path d="M26 82 H102 V88 a10 10 0 0 1 -10 10 H36 a10 10 0 0 1 -10 -10 Z" fill="var(--sb-ink,#0F1B2D)"/></g>
</svg>
```

## 25. Sigma Board

A hand-drawn sigma on a dark board: maths, statistics, "we are solving something".

**Use:** Academic without being technical. Strong on dark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><path d="M80 34 H46 L68 64 L46 94 H82" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" /><path d="M30 110 H98" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 26. Graph Board

Axes, a curve and two plotted points on a board.

**Use:** Reads as lesson, data and analysis at once.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M30 24 V98 H102" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M34 82 C50 24 68 24 82 62 S98 86 104 50" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><circle cx="58" cy="38" r="7" fill="var(--sb-green,#00843D)"/><circle cx="82" cy="62" r="7" fill="var(--sb-orange,#E06F00)"/>
</svg>
```

## 27. Idea Bulb

A lightbulb with chalk rays: the brainstorm moment.

**Use:** Emotional hook; good for onboarding and empty states.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><circle cx="64" cy="54" r="24" fill="var(--sb-sticky,#FFE27A)"/><path d="M54 78 H74 V92 a6 6 0 0 1 -6 6 H60 a6 6 0 0 1 -6 -6 Z" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 16 V8 M26 30 L20 24 M102 30 L108 24 M16 58 H8 M112 58 H120" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 28. Mind Map

A central idea with four branches in the four line colours.

**Use:** Shows brainstorming; colours tie directly to the Metro lines.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 64 L30 34 M64 64 L98 34 M64 64 L30 96 M64 64 L98 96" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><circle cx="64" cy="64" r="15" fill="var(--sb-ink,#0F1B2D)"/><circle cx="30" cy="34" r="10" fill="var(--sb-blue,#0072CE)"/><circle cx="98" cy="34" r="10" fill="var(--sb-green,#00843D)"/><circle cx="30" cy="96" r="10" fill="var(--sb-orange,#E06F00)"/><circle cx="98" cy="96" r="10" fill="var(--sb-violet,#6E4BD8)"/>
</svg>
```

## 29. Geometry

Right triangle, right-angle mark and a compass arc: school geometry.

**Use:** The most "academic" of the set; pairs well with serif or Onest.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><path d="M30 98 H100 L30 32 Z" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M30 80 H48 V98" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /><path d="M76 98 A46 46 0 0 0 63 66" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><circle cx="30" cy="32" r="5" fill="var(--sb-orange,#E06F00)"/>
</svg>
```

## 30. Graduation Cap

Mortarboard cap with tassel in the line colours.

**Use:** Education-first brand; use if students are the main audience.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 28 L116 52 L64 76 L12 52 Z" fill="var(--sb-ink,#0F1B2D)"/><path d="M36 66 V86 C48 100 80 100 92 86 V66 L64 80 Z" fill="var(--sb-blue,#0072CE)"/><path d="M110 56 V88" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><circle cx="110" cy="92" r="6" fill="var(--sb-green,#00843D)"/>
</svg>
```

## 31. Sticky Wall

Four sticky notes on a wall, slightly crooked.

**Use:** Warm and workshop-y; pairs with the sticky tool.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><g transform="rotate(-4 40 40)"><rect x="16" y="16" width="44" height="44" rx="4" fill="var(--sb-sticky,#FFE27A)"/></g><g transform="rotate(3 90 40)"><rect x="68" y="18" width="44" height="44" rx="4" fill="var(--sb-green,#00843D)" opacity=".75"/></g><g transform="rotate(3 40 90)"><rect x="16" y="68" width="44" height="44" rx="4" fill="var(--sb-blue,#0072CE)" opacity=".75"/></g><g transform="rotate(-3 90 90)"><rect x="68" y="70" width="44" height="44" rx="4" fill="var(--sb-orange,#E06F00)" opacity=".8"/></g>
</svg>
```

## 32. Notebook

Spiral notebook page with ruled lines and a pencil-mark check.

**Use:** Student / note-taking read; calm.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="26" y="22" width="76" height="88" rx="8" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><path d="M44 14 V30" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M64 14 V30" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M84 14 V30" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M40 54 H88 M40 70 H88 M40 86 H66" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/><path d="M72 88 l6 6 l14 -16" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 33. Pencil

A classic yellow pencil on an angle.

**Use:** Simple, warm, memorable; strong silhouette at small sizes.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><g transform="rotate(45 64 64)"><rect x="54" y="12" width="20" height="14" rx="4" fill="var(--sb-orange,#E06F00)"/><rect x="54" y="26" width="20" height="56" fill="var(--sb-sticky,#FFE27A)"/><path d="M54 82 H74 L64 106 Z" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="4" stroke-linejoin="round"/><path d="M60 94 H68 L64 106 Z" fill="var(--sb-ink,#0F1B2D)"/></g>
</svg>
```

## 34. Circle It

A hand-drawn circle with an arrow pointing in: "look here".

**Use:** Annotation feel: the thing people do on a whiteboard.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M36 70 C24 40 86 20 100 50 C110 78 52 98 36 76" fill="none" stroke="var(--sb-orange,#E06F00)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /><path d="M112 114 L76 78 M76 98 V78 H96" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 35. Line Board

Minimal outline board and tray in white on blue.

**Use:** Cleanest icon; ideal for favicon and monochrome use.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-blue,#0072CE)"/><rect x="20" y="24" width="88" height="56" rx="8" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" /><path d="M24 92 H74" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" /><path d="M32 78 H46" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 36. Kanban Board

A board split into three columns of cards.

**Use:** Works for both teachers (tasks) and teams (sprints).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="16" y="18" width="96" height="70" rx="6" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><rect x="22" y="88" width="56" height="10" rx="3" fill="var(--sb-ink,#0F1B2D)"/><rect x="30" y="79" width="20" height="9" rx="4.5" fill="var(--sb-blue,#0072CE)"/><rect x="26" y="30" width="20" height="12" rx="3" fill="var(--sb-blue,#0072CE)"/><rect x="26" y="48" width="20" height="12" rx="3" fill="var(--sb-blue,#0072CE)" opacity=".6"/><rect x="54" y="30" width="20" height="12" rx="3" fill="var(--sb-green,#00843D)"/><rect x="54" y="48" width="20" height="12" rx="3" fill="var(--sb-green,#00843D)" opacity=".6"/><rect x="82" y="30" width="20" height="12" rx="3" fill="var(--sb-orange,#E06F00)"/><rect x="82" y="48" width="20" height="12" rx="3" fill="var(--sb-orange,#E06F00)" opacity=".6"/><rect x="26" y="68" width="20" height="12" rx="3" fill="var(--sb-blue,#0072CE)" opacity=".35"/>
</svg>
```

## 37. Chalkboard

A classic classroom chalkboard in a wooden frame.

**Use:** Nostalgic, instantly "school". Contrasts with the product look.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="14" y="22" width="100" height="72" rx="10" fill="var(--sb-orange,#E06F00)"/><rect x="22" y="30" width="84" height="56" rx="4" fill="var(--sb-night,#0B1424)"/><path d="M34 62 q10 -20 20 0 t20 0 M34 44 H64" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><rect x="14" y="94" width="100" height="8" rx="4" fill="var(--sb-ink,#0F1B2D)"/><rect x="40" y="86" width="22" height="8" rx="4" fill="var(--sb-bg,#FFFFFF)"/>
</svg>
```

## 38. Marker Set

Three markers lined up in the line colours.

**Use:** Colourful and tactile; good for store graphics.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="20" y="40" width="22" height="70" rx="8" fill="var(--sb-blue,#0072CE)"/><rect x="20" y="40" width="22" height="16" rx="8" fill="var(--sb-ink,#0F1B2D)"/><rect x="53" y="26" width="22" height="84" rx="8" fill="var(--sb-green,#00843D)"/><rect x="53" y="26" width="22" height="16" rx="8" fill="var(--sb-ink,#0F1B2D)"/><rect x="86" y="46" width="22" height="64" rx="8" fill="var(--sb-orange,#E06F00)"/><rect x="86" y="46" width="22" height="16" rx="8" fill="var(--sb-ink,#0F1B2D)"/>
</svg>
```

## 39. Board + Spark

A board with an AI sparkle: draw with AI.

**Use:** Highlights the AI-assisted diagram feature.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="16" y="20" width="96" height="62" rx="6" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><circle cx="64" cy="20" r="0" /><rect x="22" y="82" width="56" height="10" rx="3" fill="var(--sb-ink,#0F1B2D)"/><rect x="30" y="73" width="20" height="9" rx="4.5" fill="var(--sb-blue,#0072CE)"/><rect x="54" y="73" width="20" height="9" rx="4.5" fill="var(--sb-green,#00843D)"/><path d="M64 38 L70 54 L86 60 L70 66 L64 82 L58 66 L42 60 L58 54 Z" fill="var(--sb-violet,#6E4BD8)"/>
</svg>
```

## 40. Board Lockup

Horizontal logo with the whiteboard mark instead of the S.

**Use:** Landing nav, README header, social cards.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 96" width="400" height="96">
<rect width="96" height="96" rx="22" fill="var(--sb-grey,#EEF1F5)"/><g transform="translate(4 6) scale(.74)"><rect x="16" y="20" width="96" height="62" rx="6" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><circle cx="64" cy="20" r="0" /><rect x="22" y="82" width="56" height="10" rx="3" fill="var(--sb-ink,#0F1B2D)"/><rect x="30" y="73" width="20" height="9" rx="4.5" fill="var(--sb-blue,#0072CE)"/><rect x="54" y="73" width="20" height="9" rx="4.5" fill="var(--sb-green,#00843D)"/><path d="M34 56 q10 -20 20 0 t20 0 t14 -6" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="6" stroke-linecap="round"/></g><text x="116" y="62" font-family="Onest, system-ui, sans-serif" font-weight="800" font-size="46" letter-spacing="-1.5" fill="var(--sb-ink,#0F1B2D)">Shareboard</text>
</svg>
```

## 41. Class Bell

The school bell: it rings, class starts, everyone joins the board.

**Use:** Instantly "class"; the swing marks give it motion.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 22 C44 22 38 40 38 58 C38 76 28 82 24 88 H104 C100 82 90 76 90 58 C90 40 84 22 64 22 Z" fill="var(--sb-blue,#0072CE)"/><circle cx="64" cy="19" r="6" fill="var(--sb-ink,#0F1B2D)"/><circle cx="64" cy="98" r="9" fill="var(--sb-ink,#0F1B2D)"/><path d="M18 50 q-6 10 0 20 M110 50 q6 10 0 20" fill="none" stroke="var(--sb-orange,#E06F00)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 42. Apple & Books

The teacher's apple on a stack of books.

**Use:** The most universal school symbol; warm and non-technical.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="18" y="94" width="92" height="16" rx="5" fill="var(--sb-blue,#0072CE)"/><rect x="26" y="78" width="76" height="16" rx="5" fill="var(--sb-green,#00843D)"/><path d="M64 34 C52 28 34 36 36 56 C38 70 50 74 64 68 C78 74 90 70 92 56 C94 36 76 28 64 34 Z" fill="var(--sb-danger,#C8102E)"/><path d="M64 34 C64 22 72 16 82 16 C82 26 74 34 64 34 Z" fill="var(--sb-green,#00843D)"/>
</svg>
```

## 43. Timetable

A weekly schedule grid with coloured blocks.

**Use:** Says "planning" at a glance; the blocks are the four line colours.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="16" y="20" width="96" height="90" rx="8" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><path d="M16 38 H112" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><rect x="26" y="48" width="24" height="20" rx="4" fill="var(--sb-blue,#0072CE)"/><rect x="56" y="56" width="22" height="30" rx="4" fill="var(--sb-green,#00843D)"/><rect x="84" y="48" width="18" height="16" rx="4" fill="var(--sb-orange,#E06F00)"/><rect x="26" y="74" width="24" height="26" rx="4" fill="var(--sb-violet,#6E4BD8)"/><rect x="84" y="70" width="18" height="30" rx="4" fill="var(--sb-blue,#0072CE)" opacity=".6"/>
</svg>
```

## 44. Gantt

Staggered project bars with a milestone diamond.

**Use:** Planning for teams and thesis timelines; reads technical and academic.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M18 18 V110" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><rect x="26" y="26" width="50" height="14" rx="7" fill="var(--sb-blue,#0072CE)"/><rect x="42" y="48" width="62" height="14" rx="7" fill="var(--sb-green,#00843D)"/><rect x="58" y="70" width="48" height="14" rx="7" fill="var(--sb-orange,#E06F00)"/><path d="M96 92 l9 9 l-9 9 l-9 -9 Z" fill="var(--sb-violet,#6E4BD8)"/>
</svg>
```

## 45. Roadmap S

The S as a winding road with a dashed centre line, a start pin and a destination.

**Use:** Keeps the S, adds the planning journey.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><path transform="translate(63 64) scale(1) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-grey,#EEF1F5)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" /><path transform="translate(63 64) scale(1) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9"/><circle cx="82" cy="38" r="9" fill="var(--sb-orange,#E06F00)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="4"/><circle cx="44" cy="89" r="9" fill="var(--sb-green,#00843D)" stroke="var(--sb-bg,#FFFFFF)" stroke-width="4"/>
</svg>
```

## 46. Milestone Flag

A flag planted on a hill: the goal of the class or project.

**Use:** Motivational; good for achievement states.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M12 110 C36 74 92 74 116 110 Z" fill="var(--sb-green,#00843D)"/><path d="M64 84 V26" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M64 26 H102 L90 40 L102 54 H64 Z" fill="var(--sb-blue,#0072CE)"/>
</svg>
```

## 47. Stopwatch

A stopwatch with a blue wedge: the board timer.

**Use:** Ties to the app's timer; strong at small sizes.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><circle cx="64" cy="72" r="36" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="7"/><rect x="54" y="16" width="20" height="9" rx="4" fill="var(--sb-ink,#0F1B2D)"/><path d="M64 25 V34" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><path d="M64 72 V46 A26 26 0 0 1 90 72 Z" fill="var(--sb-blue,#0072CE)"/><circle cx="64" cy="72" r="5" fill="var(--sb-ink,#0F1B2D)"/><path d="M94 42 l7 -7" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 48. Compass

A compass rose: direction for the whole class.

**Use:** Planning and orientation; striking on dark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><circle cx="64" cy="64" r="42" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="6"/><path d="M64 26 L78 64 H50 Z" fill="var(--sb-orange,#E06F00)"/><path d="M50 64 H78 L64 102 Z" fill="var(--sb-bg,#FFFFFF)"/><circle cx="64" cy="64" r="5" fill="var(--sb-ink,#0F1B2D)"/>
</svg>
```

## 49. Open Book

An open book with a bookmark ribbon.

**Use:** Reading and study; gentle and academic.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M64 40 C50 30 32 30 18 36 V94 C32 88 50 88 64 98 Z" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linejoin="round"/><path d="M64 40 C78 30 96 30 110 36 V94 C96 88 78 88 64 98 Z" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linejoin="round"/><path d="M28 52 H54 M28 66 H54 M74 52 H100 M74 66 H100" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /><path d="M88 30 V56 L95 49 L102 56 V33 Z" fill="var(--sb-orange,#E06F00)"/>
</svg>
```

## 50. S Pencil Trace

A pencil drawing the S in one stroke.

**Use:** S included, hand-made feel.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path transform="translate(63 62) scale(1) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" /><g transform="translate(44 89) rotate(-135) scale(.6)"><path d="M0 0 L-8 -18 H8 Z" fill="var(--sb-ink,#0F1B2D)"/><rect x="-8" y="-72" width="16" height="54" fill="var(--sb-sticky,#FFE27A)"/><rect x="-8" y="-84" width="16" height="12" rx="3" fill="var(--sb-orange,#E06F00)"/></g>
</svg>
```

## 51. S Graph Paper

The S on graph paper, with its end points plotted.

**Use:** S included; maths-class energy without technical weight.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M22 14 V114 M14 22 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M38 14 V114 M14 38 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M54 14 V114 M14 54 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M70 14 V114 M14 70 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M86 14 V114 M14 86 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M102 14 V114 M14 102 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path d="M118 14 V114 M14 118 H114" stroke="var(--sb-ink,#0F1B2D)" stroke-width="2" opacity=".12"/><path transform="translate(63 62) scale(1) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" /><circle cx="82" cy="38" r="7" fill="var(--sb-green,#00843D)"/><circle cx="44" cy="89" r="7" fill="var(--sb-orange,#E06F00)"/>
</svg>
```

## 52. S Chat

The S in a speech bubble.

**Use:** S included; communication + whiteboard.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-blue,#0072CE)"/><path d="M24 24 H104 a10 10 0 0 1 10 10 V82 a10 10 0 0 1 -10 10 H72 L48 112 V92 H24 a10 10 0 0 1 -10 -10 V34 a10 10 0 0 1 10 -10 Z" fill="var(--sb-bg,#FFFFFF)"/><path transform="translate(64 58) scale(0.52) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 53. S Sticky

The S written on a sticky note.

**Use:** S included; most approachable.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><path d="M20 20 H108 V84 L84 108 H20 Z" fill="var(--sb-sticky,#FFE27A)"/><path d="M84 108 V84 H108 Z" fill="#00000026"/><path transform="translate(62 60) scale(0.72) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 54. S Chalk

The S in chalk on a classroom chalkboard.

**Use:** S included; most "class".

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="14" y="20" width="100" height="76" rx="10" fill="var(--sb-orange,#E06F00)"/><rect x="22" y="28" width="84" height="60" rx="4" fill="var(--sb-night,#0B1424)"/><path transform="translate(64 58) scale(0.62) translate(-63 -64)" d="M82 38 C78 24 46 24 46 45 C46 65 82 61 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40 2"/><rect x="14" y="96" width="100" height="8" rx="4" fill="var(--sb-ink,#0F1B2D)"/><rect x="86" y="88" width="16" height="8" rx="4" fill="var(--sb-bg,#FFFFFF)"/>
</svg>
```

## 55. S Two Markers

The S drawn by two markers: blue top, green bottom.

**Use:** S included; collaboration told through colour.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><path d="M82 38 C78 24 46 24 46 45 C46 56 56 60 64 63" fill="none" stroke="var(--sb-blue,#0072CE)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" /><path d="M64 63 C74 66 82 70 82 83 C82 104 50 104 44 89" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 56. Presentation

A projector screen with a bar chart and a pointer.

**Use:** Lecture / pitch moment.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><rect x="18" y="20" width="92" height="58" rx="6" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><rect x="34" y="52" width="12" height="16" rx="2" fill="var(--sb-blue,#0072CE)"/><rect x="54" y="40" width="12" height="28" rx="2" fill="var(--sb-green,#00843D)"/><rect x="74" y="46" width="12" height="22" rx="2" fill="var(--sb-orange,#E06F00)"/><path d="M64 78 V104 M64 104 L46 114 M64 104 L82 114" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

## 57. Round Table

Four people around a table: a study group.

**Use:** Pure collaboration; colours match the four lines.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-bg,#FFFFFF)"/><circle cx="64" cy="64" r="22" fill="var(--sb-grey,#EEF1F5)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5"/><circle cx="64" cy="24" r="13" fill="var(--sb-blue,#0072CE)"/><circle cx="104" cy="64" r="13" fill="var(--sb-green,#00843D)"/><circle cx="64" cy="104" r="13" fill="var(--sb-orange,#E06F00)"/><circle cx="24" cy="64" r="13" fill="var(--sb-violet,#6E4BD8)"/>
</svg>
```

## 58. Paper Plane

A paper plane: send a board to someone.

**Use:** The "share" action made into an icon.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-blue,#0072CE)"/><path d="M16 58 L114 20 L82 108 L60 78 Z" fill="var(--sb-bg,#FFFFFF)"/><path d="M60 78 L114 20 L68 64 Z" fill="var(--sb-grey,#EEF1F5)"/><path d="M14 96 q14 -12 28 -4" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 9"/>
</svg>
```

## 59. Hourglass

An hourglass with blue sand: time boxing, sprints, exams.

**Use:** Planning with a deadline; striking on dark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-ink,#0F1B2D)"/><rect x="30" y="16" width="68" height="9" rx="4.5" fill="var(--sb-bg,#FFFFFF)"/><rect x="30" y="103" width="68" height="9" rx="4.5" fill="var(--sb-bg,#FFFFFF)"/><path d="M38 25 H90 C90 50 72 56 72 64 C72 72 90 78 90 103 H38 C38 78 56 72 56 64 C56 56 38 50 38 25 Z" fill="none" stroke="var(--sb-bg,#FFFFFF)" stroke-width="5" stroke-linejoin="round"/><path d="M47 30 H81 C79 42 70 50 64 54 C58 50 49 42 47 30 Z" fill="var(--sb-blue,#0072CE)"/><path d="M45 98 C49 86 57 82 64 82 C71 82 79 86 83 98 Z" fill="var(--sb-blue,#0072CE)"/><path d="M64 56 V82" stroke="var(--sb-blue,#0072CE)" stroke-width="3"/>
</svg>
```

## 60. Checklist

A clipboard with a colour-coded checklist.

**Use:** Planning and tasks; teachers and teams alike.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<rect width="128" height="128" rx="28" fill="var(--sb-grey,#EEF1F5)"/><rect x="28" y="22" width="72" height="92" rx="10" fill="var(--sb-bg,#FFFFFF)" stroke="var(--sb-ink,#0F1B2D)" stroke-width="6"/><rect x="48" y="14" width="32" height="16" rx="6" fill="var(--sb-ink,#0F1B2D)"/><path d="M38 52 l6 6 l10 -12 M38 74 l6 6 l10 -12" fill="none" stroke="var(--sb-green,#00843D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><circle cx="46" cy="96" r="7" fill="none" stroke="var(--sb-orange,#E06F00)" stroke-width="4"/><path d="M62 52 H90 M62 74 H90 M62 96 H90" fill="none" stroke="var(--sb-ink,#0F1B2D)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>
</svg>
```

