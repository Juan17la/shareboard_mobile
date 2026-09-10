/**
 * Design tokens for imperative code (the Skia canvas, gesture math, anything
 * that cannot use a `className`). Mirrors `tailwind.config.js` — keep them in
 * sync. Full rationale in docs/03-styles.
 *
 * The palette comes from the Shareboard mobile design: a light, glassy surface
 * system built on frosted white panels over a soft violet/green ambient wash,
 * with one purple accent doing all the "this is active / this is the CTA" work.
 * There is no dark variant on purpose — the design is light-only (docs/03-styles).
 */
import '@/global.css';

/** UI surfaces. Deliberately restrained: board content is the star. */
export const Colors = {
  /** Page and canvas background. */
  background: '#FFFFFF',
  /** Flat (non-glass) card fill. */
  surface: '#F5F6F8',
  surfaceSelected: '#EEF0F6',
  /** Primary text. */
  text: '#1B2030',
  /** Supporting text, labels, hints. */
  textSecondary: '#5A6170',
  textTertiary: '#8B909C',

  /** The single brand accent: active tool, primary CTA, selected state. */
  accent: '#6D3FB5',
  accentDeep: '#3C42AD',
  /** Tinted accent background for selected rows and icon chips. */
  accentSoft: 'rgba(109,63,181,0.11)',
  accentSofter: 'rgba(109,63,181,0.07)',

  danger: '#C4353A',
  dangerBright: '#E5484D',
  dangerSoft: 'rgba(196,53,58,0.08)',
  warn: '#B4530A',
  warnSoft: 'rgba(247,104,8,0.12)',

  /** Hairlines and control borders, always over a light ground. */
  border: 'rgba(27,32,48,0.10)',
  borderStrong: 'rgba(27,32,48,0.14)',
  borderDashed: 'rgba(27,32,48,0.22)',
} as const;

/**
 * Frosted-panel recipe. `BlurView` supplies the blur; these are the tint,
 * hairline and highlight painted over it so panels read as glass rather than
 * as flat translucent boxes.
 */
export const Glass = {
  /** Tint over the blur for floating panels (tool rail, sheets). */
  tint: 'rgba(255,255,255,0.46)',
  /** Slightly more opaque tint for rows and chips that hold text. */
  tintSolid: 'rgba(255,255,255,0.62)',
  /** Top inner highlight that gives the panel its lit edge. */
  highlight: 'rgba(255,255,255,0.92)',
  border: 'rgba(27,32,48,0.10)',
  borderLight: 'rgba(255,255,255,0.60)',
  /** Scrim behind a bottom sheet / dialog. */
  scrim: 'rgba(21,26,45,0.28)',
  scrimStrong: 'rgba(21,26,45,0.34)',
  blurIntensity: 40,
} as const;

/** Connection status badge colors (theme-independent). */
export const StatusColors = {
  online: '#0F9E8E',
  connecting: '#F59E0B',
  offline: '#9AA0A6',
} as const;

/**
 * Drawing color presets shown as swatches in the tool rail. Vivid on purpose —
 * this is board content, not UI chrome. `+ custom` sits next to them.
 */
export const DrawingPalette = [
  '#1B2030', // ink
  '#E5484D', // red
  '#F76808', // orange
  '#FFB224', // amber
  '#30A46C', // green
  '#0091FF', // blue
  '#8E4EC6', // purple
  '#FF8FAB', // pink
] as const;

/** Stroke widths offered by the size picker. */
export const StrokeSizes = [2, 5, 10, 20] as const;

/** Identity colors offered on the nickname screen (also the presence color). */
export const NicknameColors = [
  '#6D3FB5',
  '#E5484D',
  '#F76808',
  '#30A46C',
  '#0091FF',
  '#8E4EC6',
] as const;

/** 4px base spacing scale. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** The design leans on generous, soft corners throughout. */
export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 26, pill: 999 } as const;

/**
 * Font families registered by `useAppFonts` in `hooks/use-app-fonts.ts`.
 * Nunito for everything, JetBrains Mono for codes, PINs and numbers.
 */
export const Fonts = {
  regular: 'Nunito_400Regular',
  italic: 'Nunito_400Regular_Italic',
  extraboldItalic: 'Nunito_800ExtraBold_Italic',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Layout constants shared with the web app (docs/03-styles). */
export const Layout = {
  /** Below this width the board keeps its portrait arrangement. */
  compactBreakpoint: 600,
  tabletBreakpoint: 900,
  minTouchTarget: 44,
} as const;

/** Soft drop shadows. Elevation is subtle everywhere except the CTA. */
export const Shadow = {
  panel: {
    shadowColor: '#151A2D',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  card: {
    shadowColor: '#151A2D',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  accent: {
    shadowColor: '#6D3FB5',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  danger: {
    shadowColor: '#C4353A',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
