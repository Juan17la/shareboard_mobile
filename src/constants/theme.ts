/**
 * Design tokens. The web app copies them into `web/src/index.css` — keep them
 * in sync. Full rationale in docs/03-styles.
 *
 * The wayfinding system: signage ink on a white ground, and a set of transit
 * "lines" that each own one job — blue is the primary action and selection,
 * green confirms (the step that finishes a flow), orange asks for attention,
 * violet marks the app-wide places. Panels are solid signage, not glass.
 * `Colors` is the light palette; `Palettes.dark` is pure black and white. Components read the one in use through `useColors()`
 * (`features/session/store.ts`), so nothing else has to know which is on.
 */
/** UI surfaces. Board content is the star. */
export const Colors = {
  /** Page and canvas background. */
  background: '#FFFFFF',
  /** Flat card fill. */
  surface: '#EEF1F5',
  surfaceSelected: '#E1E6ED',
  /** Primary text: signage ink. */
  text: '#0F1B2D',
  /** Supporting text, labels, hints. */
  textSecondary: '#4A566B',
  textTertiary: '#6B7689',

  /** The blue line: active tool, primary CTA, selected state. */
  accent: '#0072CE',
  accentDeep: '#005AA3',
  /** The blue as *text* (tab labels, links): deeper on light, lighter on dark, for contrast. */
  accentText: '#0063B4',
  /** Tinted blue background for selected rows and icon chips. */
  accentSoft: 'rgba(0,114,206,0.11)',
  accentSofter: 'rgba(0,114,206,0.06)',
  /** The green line: the button that finishes a flow (sign in, create). */
  go: '#00843D',
  goDeep: '#006B31',
  /** Lines that only mark places (menu sections). */
  lineOrange: '#E06F00',
  lineViolet: '#6E4BD8',

  danger: '#C8102E',
  dangerBright: '#E5283C',
  dangerSoft: 'rgba(229,40,60,0.08)',
  warn: '#B45300',
  warnSoft: 'rgba(224,111,0,0.12)',

  /** Hairlines and control borders. */
  border: 'rgba(15,27,45,0.10)',
  borderStrong: 'rgba(15,27,45,0.16)',
  /** The edge of a text field: 3:1 against white, so a field is seen as one. */
  borderField: '#8A94A4',
  borderDashed: 'rgba(15,27,45,0.28)',

  // Panels. The names stay from the glass era; the panels are now solid,
  // like a sign, so text on them keeps its contrast over any drawing.
  /** Floating panels (tool rail, sheets). */
  glassTint: 'rgba(255,255,255,0.97)',
  /** Rows and chips that hold text. */
  glassTintSolid: '#FFFFFF',
  /** Panels inside a Modal. */
  glassFlat: '#FFFFFF',
  /** No lit edge: signage is flat. */
  glassHighlight: 'rgba(255,255,255,0)',
  /** A rim around chips over the board. */
  glassRim: 'rgba(15,27,45,0.10)',
};

export type Theme = 'light' | 'dark';
export type Palette = { [K in keyof typeof Colors]: string };

/** The dark board: pure black and white, no tint; the lines keep their colours because they carry meaning. */
export const Palettes: Record<Theme, Palette> = {
  light: Colors,
  dark: {
    ...Colors,
    background: '#000000',
    surface: '#141414',
    surfaceSelected: '#262626',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textTertiary: '#8A8A8A',
    accent: '#0072CE',
    accentDeep: '#005AA3',
    accentText: '#5AAEFF',
    accentSoft: 'rgba(43,143,232,0.20)',
    accentSofter: 'rgba(43,143,232,0.10)',
    dangerBright: '#FF5A5F',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.18)',
    borderField: 'rgba(255,255,255,0.42)',
    borderDashed: 'rgba(255,255,255,0.30)',
    glassTint: 'rgba(10,10,10,0.97)',
    glassTintSolid: '#141414',
    glassFlat: '#0A0A0A',
    glassHighlight: 'rgba(255,255,255,0)',
    glassRim: 'rgba(255,255,255,0.18)',
  },
};

/** The lines a section can sit on: each group of a menu owns one, on web and mobile alike. */
export type Line = 'blue' | 'green' | 'orange' | 'violet' | 'ink';
export const lineColor = (c: Palette, line: Line): string =>
  ({ blue: c.accent, green: c.go, orange: c.lineOrange, violet: c.lineViolet, ink: c.text })[line];

/**
 * The default ink (and picked black) is dark and vanishes on the dark
 * board, so the renderer paints it as the dark text colour instead. Only the
 * painting changes: the element keeps its colour, and a collaborator on the
 * light theme sees ink. Any fill alpha suffix is kept.
 */
export function inkFor(color: string, dark: boolean): string {
  return dark && /^#(1B2030|000000)/i.test(color) ? '#FFFFFF' + color.slice(7) : color;
}

/**
 * A fill that reads as light paper on the dark board: bright and mostly
 * opaque (an AI flowchart's white or yellow boxes). Its dark ink stays dark,
 * as on a sticky note, or the white label would vanish into it.
 */
export function isLightPaper(fill: string | null | undefined): boolean {
  if (!fill || (fill.length > 7 && parseInt(fill.slice(7, 9), 16) < 0x99)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** What does not change with the theme: scrims and the blur strength. */
export const Glass = {
  /** Scrim behind a bottom sheet / dialog. */
  scrim: 'rgba(15,27,45,0.28)',
  scrimStrong: 'rgba(15,27,45,0.34)',
  blurIntensity: 40,
} as const;

/** Connection status badge colors (theme-independent). */
export const StatusColors = {
  online: '#00843D',
  connecting: '#E06F00',
  offline: '#8A94A4',
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

/** Sticky note papers: pale enough that the default ink reads on them, light or dark board. */
export const StickyColors = ['#FFE58A', '#FFC2D1', '#B8E2FF', '#C6F0C2', '#E3D3FF', '#FFD3A8'] as const;

/** The ink a sticky note is written in: always dark, since the paper is always light. */
export const STICKY_INK = '#1B2030';

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

export const Radius = { sm: 6, md: 10, lg: 14, xl: 18, xxl: 22, pill: 999 } as const;

/**
 * Font families registered by `useAppFonts` in `hooks/use-app-fonts.ts`.
 * Onest for the interface, JetBrains Mono for codes, PINs and numbers. Onest
 * has no italics, so the rare italic UI text borrows Nunito's (the board face).
 */
export const Fonts = {
  regular: 'Onest_400Regular',
  italic: 'Nunito_400Regular_Italic',
  extraboldItalic: 'Nunito_800ExtraBold_Italic',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
  extrabold: 'Onest_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Soft drop shadows. Elevation is subtle everywhere. */
export const Shadow = {
  panel: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  card: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  // Filled controls, like signage: flat, with a tight, low shadow.
  accent: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  danger: {
    shadowColor: '#0F1B2D',
    shadowOpacity: 0.28,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
} as const;
