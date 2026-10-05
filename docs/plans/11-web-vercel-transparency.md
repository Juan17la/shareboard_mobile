# 11 · Web: fix transparency on the Vercel deployment (W3)

**Goal:** the deployed site looks/exports the same as local with respect to transparency.
**Platform:** web.

## Current state
- `web/vercel.json`: vite build, SPA rewrite, immutable asset cache, `nosniff`, referrer policy. No transparency-related config.
- Candidates: (a) glass UI (`web/src/index.css ~L37, L155, L166`, `backdrop-filter` blur) rendering without blur/solid in the prod build (Tailwind v4 minifier dropping `-webkit-backdrop-filter`, or `@supports`); (b) transparent PNG export (`web/src/features/export.ts`, only when `transparent && format === 'png'`); (c) theme-color/background of `index.html`.
- **The symptom isn't specified in the to-do**, so step 1 is to identify which.

## Steps
1. Open the Vercel URL vs `npm run build && npm run preview` locally; compare the glass panels and an exported transparent PNG.
2. If (a): ensure `backdrop-filter` and `-webkit-backdrop-filter` both survive the build (check `dist/assets/*.css`); declare both explicitly in `index.css` outside Tailwind layers if stripped.
3. If (b): inspect the exported PNG alpha; confirm the canvas is created with `alpha` and the background fill is skipped.
4. If neither: ask the user for a screenshot.
5. Note plan 14 (header with no glass) may remove part of the problem.

## Verification
- Preview build and Vercel look identical; exported transparent PNG has alpha on both.
