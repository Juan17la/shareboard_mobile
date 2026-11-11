/**
 * Design tokens. The web app copies them into `web/src/index.css` — keep them
 * in sync. Full rationale in docs/03-styles.
 *
 * Quiet system chrome around the board: near-black ink on white, grouped grey
 * sheets with white cards, one blue tint that acts and selects, and grey fills
 * for everything secondary. Panels are solid.
 * `Colors` is the light palette; `Palettes.dark` is the dark one. Components read the one in use through `useColors()`
 * (`features/session/store.ts`), so nothing else has to know which is on.
 */
/** UI surfaces. Board content is the star. */
export const Colors = {
  /** Page and canvas background. */
  background: '#FFFFFF',
  /** Flat card fill. */
  surface: '#F2F2F7',
  surfaceSelected: '#E5E5EA',
  /** Primary text. */
  text: '#1D1D1F',
  /** Supporting text, labels, hints. */
  textSecondary: '#636366',
  textTertiary: '#76767B',

  /** The tint: active tool, primary CTA, selected state. */
  accent: '#0071E3',
  accentDeep: '#0062C4',
  /** The blue as *text* (links, tinted rows): deeper on light, lighter on dark, for contrast. */
  accentText: '#0066CC',
  /** Tinted blue background for selected rows and icon chips. */
  accentSoft: 'rgba(0,113,227,0.12)',
  accentSofter: 'rgba(0,113,227,0.06)',
  /** Green says "done" or "on": success text and the switch, never a button. */
  go: '#248A3D',
  goDeep: '#1D7332',
  switchOn: '#34C759',
  /** Status hues the board chrome still names. */
  lineOrange: '#FF9500',
  lineViolet: '#AF52DE',

  danger: '#D70015',
  dangerBright: '#FF3B30',
  dangerSoft: 'rgba(255,59,48,0.12)',
  warn: '#B45300',
  warnSoft: 'rgba(255,149,0,0.14)',

  /**
   * The grey a control is made of (secondary buttons, the segmented track,
   * round icon buttons). Translucent, so it sits on the sheet and on a card alike.
   */
  fill: 'rgba(118,118,128,0.12)',
  fillStrong: 'rgba(118,118,128,0.20)',
  /** The selected segment: a white key on the grey track. */
  key: '#FFFFFF',

  /** Hairlines and control borders. */
  border: 'rgba(60,60,67,0.12)',
  borderStrong: 'rgba(60,60,67,0.20)',
  /** Kept for the board's own inputs: the edge of a field drawn over the canvas. */
  borderField: 'rgba(60,60,67,0.32)',
  borderDashed: 'rgba(60,60,67,0.32)',

  // Panels. `sheet` is the grouped ground of sheets and dialogs; rows, cards
  // and fields sit on it in `glassTintSolid`. The glass names stay from the
  // glass era; the panels are solid.
  sheet: '#F2F2F7',
  /** Floating panels (tool rail). */
  glassTint: 'rgba(255,255,255,0.97)',
  /** Rows, cards, fields and chips that hold text. */
  glassTintSolid: '#FFFFFF',
  /** Panels over the board. */
  glassFlat: '#FFFFFF',
  /** No lit edge. */
  glassHighlight: 'rgba(255,255,255,0)',
  /** A rim around chips over the board. */
  glassRim: 'rgba(60,60,67,0.12)',
};

export type Theme = 'light' | 'dark';
export type Palette = { [K in keyof typeof Colors]: string };

/** The dark board is pure black; what floats over it is the elevated grey of a dark sheet, one step lighter for its rows. */
export const Palettes: Record<Theme, Palette> = {
  light: Colors,
  dark: {
    ...Colors,
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSelected: '#2C2C2E',
    text: '#F5F5F7',
    textSecondary: '#A1A1A6',
    textTertiary: '#8E8E93',
    accentText: '#2997FF',
    accentSoft: 'rgba(41,151,255,0.24)',
    accentSofter: 'rgba(41,151,255,0.12)',
    go: '#30D158',
    switchOn: '#30D158',
    danger: '#FF453A',
    dangerBright: '#FF453A',
    dangerSoft: 'rgba(255,69,58,0.18)',
    warn: '#FF9F0A',
    fill: 'rgba(118,118,128,0.24)',
    fillStrong: 'rgba(118,118,128,0.36)',
    key: '#636366',
    border: 'rgba(255,255,255,0.10)',
    borderStrong: 'rgba(255,255,255,0.18)',
    borderField: 'rgba(255,255,255,0.30)',
    borderDashed: 'rgba(255,255,255,0.30)',
    sheet: '#1C1C1E',
    glassTint: 'rgba(28,28,30,0.97)',
    glassTintSolid: '#2C2C2E',
    glassFlat: '#1C1C1E',
    glassHighlight: 'rgba(255,255,255,0)',
    glassRim: 'rgba(255,255,255,0.18)',
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
  scrim: 'rgba(0,0,0,0.30)',
  scrimStrong: 'rgba(0,0,0,0.35)',
  blurIntensity: 40,
} as const;

/** Connection status badge colors (theme-independent). */
export const StatusColors = {
  online: '#34C759',
  connecting: '#FF9500',
  offline: '#8E8E93',
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

export const Radius = { sm: 6, md: 10, lg: 12, xl: 16, xxl: 20, pill: 999 } as const;

/**
 * Font families registered by `useAppFonts` in `hooks/use-app-fonts.ts`.
 * Inter for the interface, JetBrains Mono for codes, PINs and numbers. The
 * heaviest UI weight is bold: `extrabold` stays as a name for older call
 * sites and draws the same file.
 */
export const Fonts = {
  regular: 'Inter_400Regular',
  italic: 'Inter_400Regular_Italic',
  extraboldItalic: 'Inter_700Bold_Italic',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Soft drop shadows. Elevation is subtle everywhere. */
export const Shadow = {
  panel: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;
