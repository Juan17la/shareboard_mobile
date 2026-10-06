/**
 * The toolbar: one horizontal strip at the bottom of the board, Excalidraw
 * style, with every tool — hand, pencil, eraser, each shape kind, text, fill —
 * one tap away. The shape kinds are buttons of their own rather than a
 * sub-menu: the old rail needed two taps and a second column to get to an
 * arrow, and that is the tap this layout gives back.
 *
 * What is not a tool (colour, stroke size, fill, font size, bold/italic) lives
 * in an options strip above the bar that only shows the options belonging to
 * the tool in hand. The strip keeps only the colours and a settings button; the
 * rest of the tool's options (the `OPTIONS` table, the to-do's list) open
 * in a dropdown above it, Excalidraw-mobile style. Picking a tool opens it; tapping the tool you already hold
 * toggles it. It closes itself the moment a
 * finger lands on the canvas and comes back when a drag ends on a selection
 * (`railOpen` in the store).
 *
 * Nothing scrolls: in portrait the tools sit in two rows (tools, then shapes)
 * and the options wrap, so everything is visible at once on a narrow phone.
 */
import { createContext, useContext, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Path as SvgPath, Rect, Svg } from 'react-native-svg';
import { useShallow } from 'zustand/shallow';

import { StrokeSizes, inkFor } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import {
  dashIntervals,
  headsOf,
  isLineLike,
  markerPaths,
  routePath,
  canRound,
} from '@/features/board/geometry';
import {
  DASHES,
  FONTS,
  LIMITS,
  MARKERS,
  ROUTES,
  SHAPE_TEXT_SIZE,
  TEXT_SIZES,
  nearestTextSize,
  isFillable,
  type BoardElement,
  type Dash,
  type Marker,
  type Route,
  type ShapeKind,
  type ToolType,
} from '@/features/board/model';
import {
  fillColorOf,
  fillOpacityOf,
  fillWith,
  useBoardStore,
} from '@/features/board/store';
import { useSessionStore, useColors, useDark } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { StepperButton } from '../ui/Button';
import { ColorPickerSheet } from '../ui/ColorPickerSheet';
import { ColorSwatch } from '../ui/ColorSwatch';
import { FillSheet } from './FillSheet';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';

import { FAMILIES } from './BoardFonts';
import { tip } from '../ui/Toast';
import { tourRef } from './Tutorial';

type LabelKey =
  | 'hand'
  | 'select'
  | 'pencil'
  | 'eraser'
  | 'shapeRectangle'
  | 'shapeEllipse'
  | 'shapeTriangle'
  | 'shapePolygon'
  | 'shapeLine'
  | 'shapeArrow'
  | 'shapes'
  | 'text'
  | 'fill';

interface ToolEntry {
  tool: ToolType;
  shape?: ShapeKind;
  icon: IconName;
  labelKey: LabelKey;
}

/** The popovers the strip's boxes open. */
type Box = 'settings' | 'kind';

const FONT_LABELS = {
  sans: 'fontSans',
  serif: 'fontSerif',
  mono: 'fontMono',
  hand: 'fontHand',
} as const;

/** The shape kinds, offered in the options strip while the shapes tool is in hand. */
const SHAPES: ToolEntry[] = [
  { tool: 'shape', shape: 'rectangle', icon: 'rectangle', labelKey: 'shapeRectangle' },
  { tool: 'shape', shape: 'ellipse', icon: 'ellipse', labelKey: 'shapeEllipse' },
  { tool: 'shape', shape: 'triangle', icon: 'triangle', labelKey: 'shapeTriangle' },
  { tool: 'shape', shape: 'polygon', icon: 'polygon', labelKey: 'shapePolygon' },
  { tool: 'shape', shape: 'line', icon: 'line', labelKey: 'shapeLine' },
  { tool: 'shape', shape: 'arrow', icon: 'arrow', labelKey: 'shapeArrow' },
];

/**
 * One row of seven, in the order a hand reaches for them: the cursor first
 * (it is the tool in hand by default — it looks, picks up, moves the board),
 * the hand, then the marks. The six shape kinds fold into one button so the
 * row fits a phone; the strip above offers the kind.
 */
const TOOLS: ToolEntry[] = [
  { tool: 'select', icon: 'cursor', labelKey: 'select' },
  { tool: 'hand', icon: 'hand', labelKey: 'hand' },
  { tool: 'pen', icon: 'pencil', labelKey: 'pencil' },
  { tool: 'eraser', icon: 'eraser', labelKey: 'eraser' },
  { tool: 'shape', icon: 'shapes', labelKey: 'shapes' },
  { tool: 'text', icon: 'text', labelKey: 'text' },
  { tool: 'fill', icon: 'fill', labelKey: 'fill' },
];

export function Toolbar({ landscape }: { landscape: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const pickTool = useBoardStore((s) => s.pickTool);
  const setConfig = useBoardStore((s) => s.setConfig);
  // The selection, when a tool that has one is in hand. Only the selected
  // elements are read, not the board: a stroke drawn elsewhere, or anything a
  // peer does, leaves the toolbar alone.
  const selected = useBoardStore(
    useShallow((s) =>
      s.tool === 'select' || s.tool === 'shape'
        ? s.selectedIds
            .map((id) => s.elements[id])
            .filter((el): el is BoardElement => !!el && !el.deleted)
        : NONE,
    ),
  );
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);
  const drawToShape = useSessionStore((s) => s.settings.drawToShape);
  const setSetting = useSessionStore((s) => s.setSetting);
  const dark = useDark();
  const { width, height } = useWindowDimensions();

  const open = useBoardStore((s) => s.railOpen);
  const [picking, setPicking] = useState(false);
  const [filling, setFilling] = useState(false);
  /** The box whose options are open in the popover above the strip. */
  const [box, setBox] = useState<Box | null>(null);
  /** The marker grid for one end of a line, open beside the dropdown. */
  const [endsPage, setEndsPage] = useState<'headStart' | 'headEnd' | null>(null);
  /** The dropdown's width, so the marker grid can sit just right of it. */
  const [popWidth, setPopWidth] = useState(221);
  /** How tall the strip and tool bar are, so the dropdown can sit right above them. */
  const [lowerHeight, setLowerHeight] = useState(120);
  // The strip closing (a finger on the canvas) takes its popover with it.
  if (!open && box) setBox(null);

  const nudge = () => tick(haptics);

  /** The first selected element's value for an option, so the strip shows what it will change. */
  const first = <T,>(pick: (el: BoardElement) => T | undefined): T | undefined => {
    for (const el of selected) {
      const v = pick(el);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  const isActive = (entry: ToolEntry) =>
    tool === entry.tool && (!entry.shape || config.shape === entry.shape);

  const pick = (entry: ToolEntry) => {
    nudge();
    pickTool(entry.tool, entry.shape);
    setBox(null);
  };

  // A viewer has no tools at all: the design hides them rather than greying
  // them out, so the board is all there is to look at (docs/04).
  if (!canEdit) return null;

  // What the strip shows: the options of what is selected, else of the tool in
  // hand — the to-do's list, nothing else. Every button goes through
  // `setConfig`, which restyles the selection as well as setting the next thing drawn.
  const shapeTool = tool === 'shape';
  const opts = new Set<Opt>(
    selected.length
      ? selected.flatMap((el) => OPTIONS[optionsKey(el)] ?? [])
      : (OPTIONS[shapeTool ? config.shape : tool] ?? []),
  );
  const show = (opt: Opt) => opts.has(opt);
  // A box shape's label aligns both ways; text only across.
  const alignBoth = selected.length ? selected.some((el) => el.kind === 'shape') : shapeTool;
  const showFill = show('fill');
  // A circle's border colour is its main colour too: the colours stay on the strip, the rest goes in the dropdown.
  const showColor = show('color') || show('border');
  // With the shapes tool in hand, the strip is where the kind is chosen.
  const kinds: ShapeKind[] = shapeTool && !selected.length ? SHAPES.map((e) => e.shape!) : [];
  const hasSettings = [...opts].some((o) => o !== 'color');
  // The cursor with nothing selected, and the hand, have nothing to offer: an
  // empty strip is noise, whatever asked for it.
  const hasOptions = opts.size > 0 || kinds.length > 0;
  const pickKind = (kind: ShapeKind) => {
    nudge();
    pickTool('shape', kind);
  };
  const cur = {
    width:
      first((el) =>
        el.kind === 'stroke' ? el.width : el.kind === 'shape' ? el.strokeWidth : undefined,
      ) ?? config.width,
    color:
      first((el) =>
        el.kind === 'shape' ? el.stroke : el.kind === 'image' ? undefined : el.color,
      ) ?? config.color,
    // What the fill chip shows: the first selected shape's own fill, else the next shape's.
    fillOpacity:
      first((el) =>
        el.kind === 'shape' && isFillable(el.shape) ? fillOpacityOf(el.fill) : undefined,
      ) ?? config.fillOpacity,
    fillColor:
      first((el) =>
        el.kind === 'shape' && isFillable(el.shape) ? (fillColorOf(el.fill) ?? undefined) : undefined,
      ) ?? config.fillColor,
    fontSize:
      first((el) =>
        el.kind === 'text'
          ? el.fontSize
          : el.kind === 'shape'
            ? (el.fontSize ?? SHAPE_TEXT_SIZE)
            : undefined,
      ) ?? config.fontSize,
    sides:
      first((el) => (el.kind === 'shape' && el.shape === 'polygon' ? el.sides : undefined)) ??
      config.sides,
    font:
      first((el) =>
        el.kind === 'text' || el.kind === 'shape' ? (el.font ?? 'sans') : undefined,
      ) ?? config.font,
    bold: first((el) => (el.kind === 'text' ? !!el.bold : undefined)) ?? config.bold,
    italic: first((el) => (el.kind === 'text' ? !!el.italic : undefined)) ?? config.italic,
    underline: first((el) => (el.kind === 'text' ? !!el.underline : undefined)) ?? config.underline,
    headStart:
      first((el) => (el.kind === 'shape' && isLineLike(el) ? headsOf(el)[0] : undefined)) ??
      config.headStart,
    headEnd:
      first((el) => (el.kind === 'shape' && isLineLike(el) ? headsOf(el)[1] : undefined)) ??
      config.headEnd,
    route:
      first((el) =>
        el.kind === 'shape' && isLineLike(el) ? (el.route ?? 'straight') : undefined,
      ) ?? config.route,
    shape: config.shape,
    dash: first((el) => (el.kind === 'shape' ? (el.dash ?? 'solid') : undefined)) ?? config.dash,
    align:
      first((el) => (el.kind === 'text' ? (el.align ?? 'left') : el.kind === 'shape' ? (el.align ?? 'center') : undefined)) ??
      config.align,
    valign: first((el) => (el.kind === 'shape' ? (el.valign ?? 'middle') : undefined)) ?? config.valign,
    rounded: first((el) => (el.kind === 'shape' && canRound(el.shape) ? !!el.rounded : undefined)) ?? config.rounded,
  };
  const fontSize = cur.fontSize;
  // The board ink flips on the dark theme (`inkFor`); the swatches follow it.
  const ink = inkFor(cur.color, dark);
  const fillInk = inkFor(cur.fillColor ?? cur.color, dark);
  const setFontSize = (next: number) => setConfig({ fontSize: next });
  const routeLabel: Record<Route, 'routeStraight' | 'routeCurved' | 'routeElbow'> = {
    straight: 'routeStraight',
    curved: 'routeCurved',
    elbow: 'routeElbow',
  };
  const dashLabel: Record<Dash, 'dashSolid' | 'dashDashed' | 'dashDotted'> = {
    solid: 'dashSolid',
    dashed: 'dashDashed',
    dotted: 'dashDotted',
  };

  // The row is seven tools: seven children, six gaps, inside the panel's padding and border and the screen's own gutter.
  // On a narrow phone the buttons shrink so the row fits instead of clipping.
  const gap = landscape ? 3 : 4;
  const chrome = insets.left + insets.right + 16 + 2 * (landscape ? 5 : 6) + 2 + 6 * gap;
  const buttonSize = Math.min(landscape ? 34 : 44, Math.floor((width - chrome) / 7));
  const buttonRadius = buttonSize < 40 ? 12 : 14;
  const rows = [TOOLS];

  const toggle = (next: Box) => {
    nudge();
    setEndsPage(null);
    setBox(box === next ? null : next);
  };
  /** Size, typeface, bold/italic/underline and alignment — whichever the tool offers — each under its own subtitle. */
  const textSections = (
    <View style={{ gap: 10 }}>
      {show('textSize') || show('label') ? (
      <Section title={t.secTextSize}>
      {TEXT_SIZES.map((size) => (
        <MiniButton
          key={size.key}
          glyph={size.glyph}
          glyphWeight="extrabold"
          label={t[SIZE_LABELS[size.key]]}
          active={nearestTextSize(fontSize).key === size.key}
          wide
          onPress={() => {
            nudge();
            setFontSize(size.px);
          }}
        />
      ))}
      </Section>
      ) : null}
      {show('font') || show('label') ? (
      <Section title={t.secFont}>
        {FONTS.map((font) => (
          <MiniButton
            key={font}
            label={t[FONT_LABELS[font]]}
            active={cur.font === font}
            onPress={() => {
              nudge();
              setConfig({ font });
            }}
          >
            <Txt size={15} color={cur.font === font ? '#FFFFFF' : c.text} style={{ fontFamily: FAMILIES[font][0] }}>
              Aa
            </Txt>
          </MiniButton>
        ))}
      </Section>
      ) : null}
      {show('style') ? (
        <Section title={t.secStyle}>
          <MiniButton
            glyph="B"
            glyphWeight="extrabold"
            label={t.bold}
            active={cur.bold}
            onPress={() => {
              nudge();
              setConfig({ bold: !cur.bold });
            }}
          />
          <MiniButton
            glyph="I"
            glyphItalic
            label={t.italic}
            active={cur.italic}
            onPress={() => {
              nudge();
              setConfig({ italic: !cur.italic });
            }}
          />
          <MiniButton
            label={t.underline}
            active={cur.underline}
            onPress={() => {
              nudge();
              setConfig({ underline: !cur.underline });
            }}
          >
            <Txt weight="bold" size={13} color={cur.underline ? '#FFFFFF' : c.text} style={{ textDecorationLine: 'underline' }}>
              U
            </Txt>
          </MiniButton>
        </Section>
      ) : null}
      {show('align') ? (
        <Section title={t.secAlign}>
          {/* Three to a row; each row is its own View so the section is exactly three buttons wide. */}
          <View style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
          {H_ALIGNS.map((align) => (
            <MiniButton
              key={align}
              label={t[H_ALIGN_LABEL[align]]}
              active={cur.align === align}
              onPress={() => {
                nudge();
                setConfig({ align });
              }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cur.align === align ? '#FFFFFF' : c.text} strokeWidth={2} strokeLinecap="round">
                <SvgPath d={H_ALIGN_PATH[align]} />
              </Svg>
            </MiniButton>
          ))}
          </View>
          {alignBoth ? (
            <>
              <View style={{ flexDirection: 'row', gap: 5 }}>
              {V_ALIGNS.map((valign) => (
                <MiniButton
                  key={valign}
                  label={t[V_ALIGN_LABEL[valign]]}
                  active={cur.valign === valign}
                  onPress={() => {
                    nudge();
                    setConfig({ valign });
                  }}
                >
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cur.valign === valign ? '#FFFFFF' : c.text} strokeWidth={2} strokeLinecap="round">
                    <Rect x="4" y="4" width="16" height="16" rx="2" />
                    <SvgPath d={V_ALIGN_PATH[valign]} />
                  </Svg>
                </MiniButton>
              ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 5 }}>
              <MiniButton
                label={t.alignCentered}
                active={cur.align === 'center' && cur.valign === 'middle'}
                onPress={() => {
                  nudge();
                  setConfig({ align: 'center', valign: 'middle' });
                }}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cur.align === 'center' && cur.valign === 'middle' ? '#FFFFFF' : c.text} strokeWidth={2}>
                  <Rect x="4" y="4" width="16" height="16" rx="2" />
                  <Circle cx="12" cy="12" r="2.2" fill={cur.align === 'center' && cur.valign === 'middle' ? '#FFFFFF' : c.text} />
                </Svg>
              </MiniButton>
              </View>
            </>
          ) : null}
          </View>
        </Section>
      ) : null}
    </View>
  );

  /** Every section the tool in hand offers. */
  const sections = (
    <>
                {show('width') || show('border') ? (
                  <Section title={t.size}>
                    <WidthSlider
                      value={cur.width}
                      label={t.size}
                      onChange={(width) => {
                        nudge();
                        setConfig({ width });
                      }}
                    />
                  </Section>
                ) : null}
  
                {show('drawToShape') ? (
                  <Section title={t.pencil}>
                    {([false, true] as const).map((on) => (
                      <MiniButton
                        key={String(on)}
                        label={on ? t.penShape : t.penFree}
                        active={drawToShape === on}
                        onPress={() => {
                          nudge();
                          setSetting('drawToShape', on);
                        }}
                      >
                        <Icon name={on ? 'pencil-shape' : 'pencil'} size={18} color={drawToShape === on ? '#FFFFFF' : c.text} />
                      </MiniButton>
                    ))}
                  </Section>
                ) : null}

                {show('dash') ? (
                  <Section title={t.secStroke}>
                    {DASHES.map((dash) => (
                      <MiniButton
                        key={dash}
                        label={t[dashLabel[dash]]}
                        active={cur.dash === dash}
                        onPress={() => {
                          nudge();
                          setConfig({ dash });
                        }}
                      >
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cur.dash === dash ? '#FFFFFF' : c.text} strokeWidth={2.2} strokeLinecap="round">
                          <SvgPath d="M3 12H21" strokeDasharray={dashIntervals(dash, 2.2)?.join(' ')} />
                        </Svg>
                      </MiniButton>
                    ))}
                  </Section>
                ) : null}

                {showFill ? (
                  <Section title={t.fillColor}>
                    <MiniButton
                      label={t.noFill}
                      active={cur.fillOpacity === 0}
                      onPress={() => {
                        nudge();
                        setConfig({ fillOpacity: 0 });
                      }}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cur.fillOpacity === 0 ? '#FFFFFF' : c.text} strokeWidth={2} strokeLinecap="round">
                        <Rect x={4} y={4} width={16} height={16} rx={3} />
                        <SvgPath d="M4 20L20 4" />
                      </Svg>
                    </MiniButton>
                    {[25, 50, 75, 100].map((pct) => (
                      <MiniButton
                        key={pct}
                        wide
                        glyph={`${pct}%`}
                        label={`${t.opacity} ${pct}%`}
                        active={cur.fillOpacity === pct}
                        onPress={() => {
                          nudge();
                          setConfig({ fillOpacity: pct });
                        }}
                      />
                    ))}
                  </Section>
                ) : null}
  
                {show('corners') ? (
                  <Section title={t.secCorners}>
                    {([false, true] as const).map((rounded) => (
                      <MiniButton
                        key={String(rounded)}
                        label={rounded ? t.cornerRounded : t.cornerSharp}
                        active={cur.rounded === rounded}
                        onPress={() => {
                          nudge();
                          setConfig({ rounded });
                        }}
                      >
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={cur.rounded === rounded ? '#FFFFFF' : c.text} strokeWidth={2.2}>
                          <Rect x="4" y="4" width="16" height="16" rx={rounded ? 6 : 0} />
                        </Svg>
                      </MiniButton>
                    ))}
                  </Section>
                ) : null}

                {show('sides') ? (
                  <Section title={t.sides}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <StepperButton
                        icon="minus"
                        label={t.fewerSides}
                        onPress={() => {
                          nudge();
                          setConfig({ sides: Math.max(LIMITS.minSides, cur.sides - 1) });
                        }}
                      />
                      <Txt weight="extrabold" size={11} mono style={{ width: 28, textAlign: 'center' }}>
                        {cur.sides}
                      </Txt>
                      <StepperButton
                        icon="plus"
                        label={t.moreSides}
                        onPress={() => {
                          nudge();
                          setConfig({ sides: Math.min(LIMITS.maxSides, cur.sides + 1) });
                        }}
                      />
                    </View>
                  </Section>
                ) : null}

                {show('route') ? (
                  <Section title={t.route}>
                    {ROUTES.map((route) => (
                      <MiniButton
                        key={route}
                        label={t[routeLabel[route]]}
                        active={cur.route === route}
                        onPress={() => {
                          nudge();
                          setConfig({ route });
                        }}
                      >
                        <LineGlyph d={routePath({ from: { x: 4, y: 19 }, to: { x: 20, y: 5 }, route })} on={cur.route === route} />
                      </MiniButton>
                    ))}
                  </Section>
                ) : null}
  
                {show('tail') || show('head') ? (
                  <Section title={t.secEnds}>
                    {(['headStart', 'headEnd'] as const).filter((end) => show(end === 'headStart' ? 'tail' : 'head')).map((end) => (
                      <MiniButton
                        key={end}
                        wide
                        label={t[end]}
                        active={endsPage === end}
                        onPress={() => {
                          nudge();
                          setEndsPage(endsPage === end ? null : end);
                        }}
                      >
                        <MarkerIcon kind={cur[end]} end={end === 'headEnd'} color={endsPage === end ? '#FFFFFF' : c.text} small />
                        <Txt weight="bold" size={10} color={endsPage === end ? '#FFFFFF' : c.textSecondary} style={{ marginLeft: 4 }}>
                          {t[end]}
                        </Txt>
                        <Icon name="chevron" size={11} color={endsPage === end ? '#FFFFFF' : c.textSecondary} />
                      </MiniButton>
                    ))}
                  </Section>
                ) : null}
  
                {textSections}
    </>
  );

  const bottomGap = Math.max(insets.bottom, landscape ? 10 : 16);
  // Room for the dropdown: what is left between the header and the strip above the tool bar.
  const popMax = Math.max(120, height - bottomGap - lowerHeight - 8 - (insets.top + (landscape ? 50 : 92)) - 8);

  return (
    <>
      {open && hasOptions && box === 'kind' && kinds.length ? (
        // The figure's own, smaller dropdown: just the kinds.
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: insets.left,
            right: insets.right,
            bottom: bottomGap + lowerHeight + 8,
            alignItems: 'flex-start',
            paddingHorizontal: 8,
          }}
        >
          <GlassPanel level="panel" radius={14} style={panelShadow}>
            <Dense.Provider value>
              <View style={{ gap: 6, padding: 6, alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {kinds.map((kind) => (
                    <MiniButton
                      key={kind}
                      label={t[SHAPES.find((e) => e.shape === kind)!.labelKey]}
                      active={cur.shape === kind}
                      onPress={() => pickKind(kind)}
                    >
                      <Icon name={kind} size={18} color={cur.shape === kind ? '#FFFFFF' : c.text} />
                    </MiniButton>
                  ))}
                </View>
              </View>
            </Dense.Provider>
          </GlassPanel>
        </View>
      ) : null}

      {open && hasOptions && box === 'settings' ? (
        // Its own layer, sitting on top of the strip and tool bar: it can grow
        // and scroll but never moves them.
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: insets.left,
            right: insets.right,
            bottom: bottomGap + lowerHeight + 8,
            alignItems: 'flex-start',
            paddingHorizontal: 8,
          }}
        >
          <View onLayout={(e) => setPopWidth(e.nativeEvent.layout.width)}>
            <GlassPanel level="panel" radius={16} style={panelShadow}>
              <ScrollView
                style={{ maxHeight: popMax, maxWidth: 221 }}
                contentContainerStyle={{ gap: 10, padding: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {sections}
              </ScrollView>
            </GlassPanel>
          </View>
          {endsPage && (show('tail') || show('head')) ? (
            // The marker grid opens beside the dropdown, on a layer of its own,
            // so the dropdown underneath neither moves nor changes page.
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', left: 8 + popWidth + 6, right: 8, bottom: 0, alignItems: 'flex-start' }}
            >
              <GlassPanel level="panel" radius={16} style={panelShadow}>
                <ScrollView
                  style={{ maxHeight: popMax, maxWidth: 221 }}
                  contentContainerStyle={{ gap: 10, padding: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Txt weight="extrabold" size={11} tone="secondary">
                    {`${t.secEnds} · ${t[endsPage]}`}
                  </Txt>
                  {(
                    [
                      ['markersDefault', MARKERS.default],
                      ['markersOther', MARKERS.other],
                      ['markersCardinality', MARKERS.cardinality],
                    ] as const
                  ).map(([labelKey, markers]) => (
                    <Section key={labelKey} title={t[labelKey]}>
                      {markers.map((kind) => (
                        <MiniButton
                          key={kind}
                          label={kind}
                          active={cur[endsPage] === kind}
                          onPress={() => {
                            nudge();
                            setConfig({ [endsPage]: kind });
                            setEndsPage(null);
                          }}
                        >
                          <MarkerIcon
                            kind={kind}
                            end={endsPage === 'headEnd'}
                            color={cur[endsPage] === kind ? '#FFFFFF' : c.text}
                          />
                        </MiniButton>
                      ))}
                    </Section>
                  ))}
                </ScrollView>
              </GlassPanel>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        onLayout={(e) => setLowerHeight(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          left: insets.left,
          right: insets.right,
          bottom: bottomGap,
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
        }}
      >
        {open && hasOptions ? (
          <GlassPanel level="panel" radius={16} style={[panelShadow, { alignSelf: 'flex-start', maxWidth: '100%' }]}>
            <View ref={tourRef('options')} style={{ ...stripStyle, justifyContent: 'flex-start' }}>
              {kinds.length ? (
                <MiniButton
                  label={t[SHAPES.find((e) => e.shape === cur.shape)?.labelKey ?? 'shapes']}
                  active={box === 'kind'}
                  onPress={() => toggle('kind')}
                >
                  <Icon name={cur.shape} size={18} color={box === 'kind' ? '#FFFFFF' : c.text} />
                </MiniButton>
              ) : null}

              {showColor || showFill ? (
                <MiniButton
                  label={showFill ? `${t.fillColor} ${cur.fillOpacity}%` : t.color}
                  active={showFill ? filling : picking}
                  onPress={() => {
                    nudge();
                    if (showFill) setFilling(true);
                    else setPicking(true);
                  }}
                >
                  <ColorSwatch color={showFill ? (fillWith(fillInk, cur.fillOpacity) ?? 'transparent') : ink} />
                </MiniButton>
              ) : null}

              {showFill ? (
                <MiniButton
                  label={t.strokeColor}
                  active={picking}
                  onPress={() => {
                    nudge();
                    setPicking(true);
                  }}
                >
                  {/* A shape's border: drawn as a ring, so it reads differently from the fill's solid swatch. */}
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: ink }} />
                </MiniButton>
              ) : null}

              {hasSettings ? (
                <MiniButton ref={tourRef('settings')} label={t.sheetSettings} active={box === 'settings'} onPress={() => toggle('settings')}>
                  <Icon name="options" size={18} color={box === 'settings' ? '#FFFFFF' : c.text} />
                </MiniButton>
              ) : null}
            </View>
          </GlassPanel>
        ) : null}

        <GlassPanel
          level="panel"
          radius={landscape ? 17 : 20}
          style={[panelShadow, { maxWidth: '100%' }]}
        >
          <View
            style={{ gap, padding: landscape ? 5 : 6 }}
            accessibilityRole="toolbar"
            accessibilityLabel={t.tools}
          >
            {rows.map((row, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap,
                }}
              >
                {row.map((entry) => (
                  <ToolButton
                    key={entry.labelKey}
                    ref={entry.labelKey === 'pencil' || entry.labelKey === 'select' || entry.labelKey === 'shapes' ? tourRef(entry.labelKey) : undefined}
                    // The pencil shows which pencil it is: freehand, or draw to shape.
                    icon={entry.tool === 'pen' && drawToShape ? 'pencil-shape' : entry.icon}
                    label={t[entry.labelKey]}
                    active={isActive(entry)}
                    size={buttonSize}
                    radius={buttonRadius}
                    onPress={() => pick(entry)}
                  />
                ))}
              </View>
            ))}
          </View>
        </GlassPanel>
      </View>

      <FillSheet
        open={filling}
        color={cur.fillColor ?? cur.color}
        custom={cur.fillColor !== null && cur.fillColor.toUpperCase() !== cur.color.slice(0, 7).toUpperCase()}
        opacity={cur.fillOpacity}
        onColor={(fillColor) => setConfig({ fillColor, fillOpacity: cur.fillOpacity || 100 })}
        onOpacity={(fillOpacity) => setConfig({ fillOpacity })}
        onClose={() => setFilling(false)}
      />
      <ColorPickerSheet
        open={picking}
        value={cur.color}
        onClose={() => setPicking(false)}
        onPick={(color) => {
          nudge();
          setConfig({ color });
          setPicking(false);
          setBox(null);
        }}
      />
    </>
  );
}

const NONE: BoardElement[] = [];

const panelShadow = {
  shadowColor: '#151A2D',
  shadowOpacity: 0.16,
  shadowRadius: 34,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

/** The strip: boxes in a row that wraps, so a line's options take two rows rather than scroll. */
const stripStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingHorizontal: 8,
  paddingVertical: 6,
} as const;

/** A cluster of popover options under a small subtitle saying what it is. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Dense.Provider value>
    <View style={{ gap: 4 }}>
      <Txt weight="extrabold" size={10} tracking={0.8} tone="secondary">
        {title.toUpperCase()}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>{children}</View>
    </View>
    </Dense.Provider>
  );
}

/** Inside the dropdown the buttons are 30px, so six fit a row of the narrow panel. */
const Dense = createContext(false);

/** One option; `style` is bold, italic and underline together. Same table as the web toolbar. */
type Opt =
  | 'fill'
  | 'color'
  | 'border'
  | 'width'
  | 'drawToShape'
  | 'corners'
  | 'dash'
  | 'sides'
  | 'tail'
  | 'head'
  | 'route'
  | 'label'
  | 'textSize'
  | 'font'
  | 'style'
  | 'align';

/**
 * What each tool, or a selected element of that kind, offers: the to-do's list
 * (docs/00-to-do, web 4 — mobile 5 puts all but the colours in the dropdown).
 * Keys are tools, shape kinds and `stroke` (a selected pencil line).
 */
const OPTIONS: Partial<Record<string, Opt[]>> = {
  pen: ['color', 'width', 'drawToShape'],
  stroke: ['color', 'width'],
  eraser: ['width'],
  fill: ['color'],
  rectangle: ['fill', 'color', 'width', 'corners', 'dash', 'align'],
  ellipse: ['fill', 'border', 'dash'],
  triangle: ['fill', 'color', 'width', 'corners', 'dash'],
  polygon: ['fill', 'color', 'width', 'corners', 'dash', 'sides'],
  line: ['color', 'width', 'dash'],
  arrow: ['color', 'dash', 'tail', 'head', 'route', 'label'],
  text: ['color', 'textSize', 'font', 'style', 'align'],
};
const optionsKey = (el: BoardElement) => (el.kind === 'shape' ? el.shape : el.kind);

/**
 * Stroke width as a slider with one stop per size: a track with four dots drawn
 * at their widths; a tap or a drag along it snaps to the nearest stop.
 */
/** Drawn on a 24px grid: text lines against the left, middle or right; a bar at the top, middle or bottom of a frame. */
const H_ALIGN_PATH = { left: 'M4 6h16M4 12h10M4 18h14', center: 'M4 6h16M7 12h10M5 18h14', right: 'M4 6h16M10 12h10M6 18h14' } as const;
const V_ALIGN_PATH = { top: 'M8 8h8', middle: 'M8 12h8', bottom: 'M8 16h8' } as const;
const H_ALIGNS = ['left', 'center', 'right'] as const;
const V_ALIGNS = ['top', 'middle', 'bottom'] as const;
const H_ALIGN_LABEL = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' } as const;
const V_ALIGN_LABEL = { top: 'alignTop', middle: 'alignMiddle', bottom: 'alignBottom' } as const;

function WidthSlider({ value, label, onChange }: { value: number; label: string; onChange: (width: number) => void }) {
  const c = useColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const last = StrokeSizes.length - 1;
  const index = StrokeSizes.reduce((best, size, i) => (Math.abs(size - value) < Math.abs(StrokeSizes[best] - value) ? i : best), 0);
  const at = (x: number) => {
    if (!trackWidth) return;
    const next = Math.max(0, Math.min(last, Math.round((x / trackWidth) * last)));
    if (next !== index) onChange(StrokeSizes[next]);
  };
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} ${StrokeSizes[index]}`}
      accessibilityValue={{ min: 0, max: last, now: index }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = Math.max(0, Math.min(last, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
        if (next !== index) onChange(StrokeSizes[next]);
      }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => at(e.nativeEvent.locationX)}
      onResponderMove={(e) => at(e.nativeEvent.locationX)}
      style={{ width: 128, height: 28, justifyContent: 'center' }}
    >
      <View style={{ position: 'absolute', left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: c.borderStrong }} />
      <View
        pointerEvents="none"
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}
      >
        {StrokeSizes.map((size, i) => {
          const d = Math.min(16, size + 7);
          return (
            <View
              key={size}
              style={{
                width: d,
                height: d,
                borderRadius: d / 2,
                backgroundColor: i <= index ? c.accent : c.surface,
                borderWidth: 1.5,
                borderColor: i <= index ? c.accent : c.borderStrong,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A route or an elbow's axes drawn as a short stroke, 20px. */
function LineGlyph({ d, on }: { d: string; on: boolean }) {
  const c = useColors();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={on ? '#FFFFFF' : c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <SvgPath d={d} />
    </Svg>
  );
}

function ToolButton({
  ref,
  icon,
  label,
  active,
  size,
  radius,
  onPress,
}: {
  ref?: React.Ref<View>;
  icon: IconName;
  label: string;
  active: boolean;
  size: number;
  radius: number;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        backgroundColor: active ? c.accent : 'transparent',
        ...(active
          ? {
              shadowColor: c.accent,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }
          : null),
      }}
    >
      <Icon name={icon} size={21} color={active ? '#FFFFFF' : c.text} />
    </Pressable>
  );
}

/** A marker as the strip shows it: on the end of a short line, pointing out of it. */
function MarkerIcon({ kind, end, color, small }: { kind: Marker; end: boolean; color: string; small?: boolean }) {
  const c = useColors();
  const tip = end ? { x: 21, y: 12 } : { x: 3, y: 12 };
  const parts = markerPaths(kind, tip, end ? 0 : Math.PI, 7);
  // "None" is greyed: a bare line reads as nothing on purpose, not as a missing icon.
  const ink = kind !== 'none' ? color : color === '#FFFFFF' ? 'rgba(255,255,255,0.55)' : c.borderStrong;
  return (
    <Svg
      width={small ? 17 : 22}
      height={small ? 17 : 22}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <SvgPath d="M3 12H21" />
      {parts.map((part, i) => (
        <SvgPath
          key={i}
          d={part.d}
          fill={part.fill === 'solid' ? ink : part.fill === 'hollow' ? c.background : 'none'}
        />
      ))}
    </Svg>
  );
}

const SIZE_LABELS = {
  small: 'textSmall',
  medium: 'textMedium',
  large: 'textLarge',
  xlarge: 'textXLarge',
} as const;

function MiniButton({
  ref,
  glyph,
  glyphWeight = 'bold',
  glyphItalic,
  label,
  active,
  onPress,
  wide = false,
  compact = false,
  children,
}: {
  ref?: React.Ref<View>;
  glyph?: string;
  glyphWeight?: 'bold' | 'extrabold';
  glyphItalic?: boolean;
  label: string;
  active: boolean;
  onPress: () => void;
  /** Room for two glyphs, not one. */
  wide?: boolean;
  /** Narrower, for a row of four. */
  compact?: boolean;
  /** Drawn instead of the glyph. */
  children?: React.ReactNode;
}) {
  const c = useColors();
  const dense = useContext(Dense);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={{
        ...(wide ? { minWidth: dense ? 30 : 34, paddingHorizontal: dense ? 5 : 6 } : { width: compact || dense ? 30 : 34 }),
        height: dense ? 30 : 34,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? 'transparent' : c.borderStrong,
        backgroundColor: active ? c.accent : c.surface,
      }}
    >
      {children ?? (
        <Txt
          weight={glyphWeight}
          italic={glyphItalic}
          size={13}
          color={active ? '#FFFFFF' : c.text}
        >
          {glyph}
        </Txt>
      )}
    </Pressable>
  );
}
