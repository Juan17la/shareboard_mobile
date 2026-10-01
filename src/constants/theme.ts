/**
 * Design tokens. The web app copies them into `web/src/index.css` — keep them
 * in sync. Full rationale in docs/03-styles.
 *
 * The palette comes from the Shareboard mobile design: a light, glassy surface
 * system built on frosted white panels over a soft ambient wash, with one
 * blood-red accent doing all the "this is active / this is the CTA" work.
 * Neutrals, labels, separators and red/orange are Apple's iOS/macOS system
 * colours. `Colors` is the light palette; `Palettes.dark` is the same set over a deep
 * ink ground. Components read the one in use through `useColors()`
 * (`features/session/store.ts`), so nothing else has to know which is on.
 */
/** UI surfaces. Deliberately restrained: board content is the star. */
export const Colors = {
  /** Page and canvas background. */
  background: '#FFFFFF',
  /** Flat (non-glass) card fill. */
  surface: '#F2F2F7',
  surfaceSelected: '#E5E5EA',
  /** Primary text. */
  text: '#000000',
  /** Supporting text, labels, hints. */
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',

  /** The single brand accent: active tool, primary CTA, selected state. */
  accent: '#0071E3',
  accentDeep: '#0058B0',
  /** The accent as *text* (tab labels, links): deeper on light, lighter on dark, for contrast. */
  accentText: '#0062CC',
  /** Tinted accent background for selected rows and icon chips. */
  accentSoft: 'rgba(0,113,227,0.11)',
  accentSofter: 'rgba(0,113,227,0.07)',

  danger: '#D70015',
  dangerBright: '#FF3B30',
  dangerSoft: 'rgba(255,59,48,0.08)',
  warn: '#C93400',
  warnSoft: 'rgba(255,149,0,0.12)',

  /** Hairlines and control borders. */
  border: 'rgba(60,60,67,0.10)',
  borderStrong: 'rgba(60,60,67,0.14)',
  /** The edge of a text field: clearly there on a white or a frosted ground. */
  borderField: 'rgba(60,60,67,0.34)',
  borderDashed: 'rgba(60,60,67,0.22)',

  // Frosted-panel recipe. `BlurView` supplies the blur; these are the tint and
  // the highlight painted over it so panels read as glass rather than as flat
  // translucent boxes.
  /** Tint over the blur for floating panels (tool rail, sheets). */
  glassTint: 'rgba(255,255,255,0.46)',
  /** Slightly more opaque tint for rows and chips that hold text. */
  glassTintSolid: 'rgba(255,255,255,0.62)',
  /** Near-opaque tint for panels that cannot blur (inside a Modal). */
  glassFlat: 'rgba(255,255,255,0.92)',
  /** Top inner highlight that gives the panel its lit edge. */
  glassHighlight: 'rgba(255,255,255,0.92)',
  /** A light rim around chips over the board. */
  glassRim: 'rgba(255,255,255,0.60)',
};

export type Theme = 'light' | 'dark';
export type Palette = { [K in keyof typeof Colors]: string };

/** The dark board: Apple's dark system colours (iOS elevated / macOS), same recipe. */
export const Palettes: Record<Theme, Palette> = {
  light: Colors,
  dark: {
    ...Colors,
    background: '#1C1C1E',
    surface: '#2C2C2E',
    surfaceSelected: '#3A3A3C',
    text: '#FFFFFF',
    textSecondary: '#AEAEB2',
    textTertiary: '#8E8E93',
    accent: '#0071E3',
    accentDeep: '#0058B0',
    accentText: '#4DA2FF',
    accentSoft: 'rgba(10,132,255,0.20)',
    accentSofter: 'rgba(10,132,255,0.11)',
    dangerBright: '#FF453A',
    border: 'rgba(235,235,245,0.10)',
    borderStrong: 'rgba(235,235,245,0.16)',
    borderField: 'rgba(235,235,245,0.36)',
    borderDashed: 'rgba(235,235,245,0.26)',
    glassTint: 'rgba(28,28,30,0.55)',
    glassTintSolid: 'rgba(44,44,46,0.72)',
    glassFlat: 'rgba(44,44,46,0.94)',
    glassHighlight: 'rgba(255,255,255,0.08)',
    glassRim: 'rgba(255,255,255,0.10)',
  },
};

/**
 * The default ink (and picked black) is dark and vanishes on the dark
 * board, so the renderer paints it as the dark text colour instead. Only the
 * painting changes: the element keeps its colour, and a collaborator on the
 * light theme sees ink. Any fill alpha suffix is kept.
 */
export function inkFor(color: string, dark: boolean): string {
  return dark && /^#(1B2030|000000)/i.test(color) ? '#FFFFFF' + color.slice(7) : color;
}

/** What does not change with the theme: scrims and the blur strength. */
export const Glass = {
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
  '#0071E3',
  '#E5484D',
  '#F76808',
  '#30A46C',
  '#0091FF',
  '#8E4EC6',
] as const;

/** The design leans on generous, soft corners throughout. */
/** Presence icons to pick from on the identity screen; each carries its own colour. */
export const Avatars = [
  { icon: '🦊', color: '#F76808' },
  { icon: '🐼', color: '#1B2030' },
  { icon: '🐸', color: '#30A46C' },
  { icon: '🐙', color: '#8E4EC6' },
  { icon: '🦄', color: '#E93D82' },
  { icon: '🐝', color: '#F5B301' },
  { icon: '🦋', color: '#208AEF' },
  { icon: '🐢', color: '#3E9B4F' },
  { icon: '🐬', color: '#0EA5E9' },
  { icon: '🦉', color: '#8B5E3C' },
  { icon: '🐨', color: '#6B7280' },
  { icon: '🐯', color: '#E5484D' },
  { icon: '🦁', color: '#D97706' },
  { icon: '🐧', color: '#1E3A8A' },
  { icon: '🦕', color: '#0F766E' },
  { icon: '🚀', color: '#7C3AED' },
] as const;

/** The colour an icon carries; the first icon's when unknown. */
export const avatarColor = (icon: string): string =>
  (Avatars.find((a) => a.icon === icon) ?? Avatars[0]).color;

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

/** Soft drop shadows. Elevation is subtle everywhere. */
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
  // Filled controls, the iOS way: a tight, low shadow in a deeper shade of
  // their own colour — no glow. The lit edge and hairline are in `ui/Button`.
  accent: {
    shadowColor: '#002864',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  danger: {
    shadowColor: '#780000',
    shadowOpacity: 0.28,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
} as const;
