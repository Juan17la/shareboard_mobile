/**
 * The toolbar: one horizontal strip at the bottom of the board, Excalidraw
 * style, with every tool — hand, pencil, eraser, each shape kind, text, fill —
 * one tap away. The shape kinds are buttons of their own rather than a
 * sub-menu: the old rail needed two taps and a second column to get to an
 * arrow, and that is the tap this layout gives back.
 *
 * What is not a tool (colour, stroke size, fill, font size, bold/italic) lives
 * in an options strip above the bar that only shows the options belonging to
 * the tool in hand. Picking a tool opens it; tapping the tool you already hold
 * toggles it; the colour swatch toggles it too. It closes itself the moment a
 * finger lands on the canvas and comes back when a drag ends on a selection
 * (`railOpen` in the store).
 *
 * Nothing scrolls: in portrait the tools sit in two rows (tools, then shapes)
 * and the options wrap, so everything is visible at once on a narrow phone.
 */
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path as SvgPath, Svg } from 'react-native-svg';
import { useShallow } from 'zustand/shallow';

import { DrawingPalette, StrokeSizes, inkFor } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import {
  dashIntervals,
  headsOf,
  isLineLike,
  markerPaths,
  routePath,
} from '@/features/board/geometry';
import {
  DASHES,
  FONTS,
  LIMITS,
  MARKERS,
  ROUTES,
  SHAPE_TEXT_SIZE,
  isFillable,
  type Axis,
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
import { FillSheet } from './FillSheet';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';

import { FAMILIES } from './BoardFonts';
import { tip } from '../ui/Toast';

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
  const dark = useDark();
  const { width } = useWindowDimensions();

  const open = useBoardStore((s) => s.railOpen);
  const setOpen = useBoardStore((s) => s.setRailOpen);
  const [picking, setPicking] = useState(false);
  const [filling, setFilling] = useState(false);
  /** Which end's marker grid is open, replacing the strip while it is. */
  const [pickingHead, setPickingHead] = useState<'headStart' | 'headEnd' | null>(null);

  const nudge = () => tick(haptics);

  const has = (test: (el: BoardElement) => boolean) => selected.some(test);
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
    setPickingHead(null);
  };

  // A viewer has no tools at all: the design hides them rather than greying
  // them out, so the board is all there is to look at (docs/04).
  if (!canEdit) return null;

  // What the strip shows: the options of the tool in hand, or of what is
  // selected. Every button goes through `setConfig`, which restyles the
  // selection as well as setting the next thing drawn.
  const shapeTool = tool === 'shape';
  const lineTool = shapeTool && (config.shape === 'line' || config.shape === 'arrow');
  const selShape = has((el) => el.kind === 'shape');
  const selLine = has((el) => el.kind === 'shape' && isLineLike(el));
  const selBox = has((el) => el.kind === 'shape' && isFillable(el.shape));
  const selText = has((el) => el.kind === 'text');
  const showSizes =
    tool === 'pen' ||
    tool === 'eraser' ||
    shapeTool ||
    has((el) => el.kind === 'stroke') ||
    selShape;
  const showFill = (shapeTool && isFillable(config.shape)) || selBox;
  const showLine = lineTool || selLine;
  const showSides =
    (shapeTool && config.shape === 'polygon') ||
    has((el) => el.kind === 'shape' && el.shape === 'polygon');
  // A selected shape borrows the text tool's size stepper for its label.
  const showTextOptions = tool === 'text' || selText || selShape;
  const showStyle = tool === 'text' || selText;
  const showColor =
    tool !== 'hand' && tool !== 'eraser' && (tool !== 'select' || selected.length > 0);
  // The cursor with nothing selected, and the hand, have nothing to offer: an
  // empty strip is noise, whatever asked for it.
  const hasOptions =
    showSizes || showFill || showLine || showTextOptions || showColor;
  // A selected shape can change kind within its family: box to box, line to
  // arrow. With the shapes tool in hand, the strip is where the kind is chosen.
  const kinds: ShapeKind[] = selLine
    ? ['line', 'arrow']
    : selShape
      ? ['rectangle', 'ellipse', 'triangle', 'polygon']
      : shapeTool
        ? SHAPES.map((e) => e.shape!)
        : [];
  const pickKind = (kind: ShapeKind) => {
    nudge();
    if (selected.length) setConfig({ shape: kind });
    else pickTool('shape', kind);
  };

  // A selected line's axis: its own (null when it is automatic), or the tool's when no line is selected.
  const axisOf = (key: 'startAxis' | 'endAxis'): Axis | null | undefined => {
    const v = first((el) =>
      el.kind === 'shape' && isLineLike(el) ? (el[key] ?? 'auto') : undefined,
    );
    return v === undefined ? undefined : v === 'auto' ? null : v;
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
    shape: first((el) => (el.kind === 'shape' ? el.shape : undefined)) ?? config.shape,
    dash:
      first((el) => (el.kind === 'shape' && isLineLike(el) ? (el.dash ?? 'solid') : undefined)) ??
      config.dash,
    startAxis: axisOf('startAxis') === undefined ? config.startAxis : axisOf('startAxis')!,
    endAxis: axisOf('endAxis') === undefined ? config.endAxis : axisOf('endAxis')!,
  };
  const fontSize = cur.fontSize;
  // The board ink flips on the dark theme (`inkFor`); the swatches follow it.
  const ink = inkFor(cur.color, dark);
  const fillInk = inkFor(cur.fillColor ?? cur.color, dark);
  const setFontSize = (next: number) => setConfig({ fontSize: next });
  // An elbow's ends: automatic, or which way it leaves and arrives.
  const axisChoices: {
    start: Axis | null;
    end: Axis | null;
    labelKey: 'axisAuto' | 'axisHH' | 'axisVV' | 'axisHV' | 'axisVH';
  }[] = [
    { start: null, end: null, labelKey: 'axisAuto' },
    { start: 'h', end: 'h', labelKey: 'axisHH' },
    { start: 'v', end: 'v', labelKey: 'axisVV' },
    { start: 'h', end: 'v', labelKey: 'axisHV' },
    { start: 'v', end: 'h', labelKey: 'axisVH' },
  ];
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

  // The row is seven tools, a hairline and the swatch: nine children, eight
  // gaps, inside the panel's padding and border and the screen's own gutter.
  // On a narrow phone the buttons shrink so the row fits instead of clipping.
  const gap = landscape ? 3 : 4;
  const chrome = insets.left + insets.right + 16 + 2 * (landscape ? 5 : 6) + 2 + 9 + 8 * gap;
  const buttonSize = Math.min(landscape ? 34 : 44, Math.floor((width - chrome) / 8));
  const buttonRadius = buttonSize < 40 ? 12 : 14;
  const rows = [TOOLS];

  /* The swatch doubles as the options toggle: it is both the current colour
     and a handle for the strip that changes it. Sits on the first row. */
  const swatch = (
    <>
      <View
        style={{
          width: 1,
          height: 24,
          marginHorizontal: 4,
          backgroundColor: c.border,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.color}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          nudge();
          setOpen(!open);
        }}
        onLongPress={() => tip(t.color)}
        style={{
          width: buttonSize,
          height: buttonSize,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: buttonRadius,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.glassTintSolid,
        }}
      >
        <View
          style={{
            width: buttonSize / 2,
            height: buttonSize / 2,
            borderRadius: 7,
            backgroundColor: inkFor(config.color, dark),
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
      </Pressable>
    </>
  );

  return (
    <>
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: insets.left,
          right: insets.right,
          bottom: Math.max(insets.bottom, landscape ? 10 : 16),
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
        }}
      >
        {open && hasOptions ? (
          <GlassPanel level="panel" radius={16} style={[panelShadow, { maxWidth: '100%' }]}>
            <View>
              {pickingHead ? (
                <View style={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
                  {(
                    [
                      ['markersDefault', MARKERS.default],
                      ['markersOther', MARKERS.other],
                      ['markersCardinality', MARKERS.cardinality],
                    ] as const
                  ).map(([labelKey, kinds]) => (
                    <View
                      key={labelKey}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Txt weight="bold" size={10} color={c.textSecondary} style={{ width: 74 }}>
                        {t[labelKey]}
                      </Txt>
                      {kinds.map((kind) => (
                        <MiniButton
                          key={kind}
                          label={kind}
                          active={cur[pickingHead] === kind}
                          onPress={() => {
                            nudge();
                            setConfig({ [pickingHead]: kind });
                            setPickingHead(null);
                          }}
                        >
                          <MarkerIcon
                            kind={kind}
                            end={pickingHead === 'headEnd'}
                            color={cur[pickingHead] === kind ? '#FFFFFF' : c.text}
                          />
                        </MiniButton>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  {showSizes || showFill ? (
                    <Cluster>
                      {/* One button each, not a row of four: a tap steps to the
                          next width / fill level and wraps around. The button
                          shows the current value, so the row stays short. */}
                      {showSizes ? (
                        <MiniButton
                          label={`${t.size} ${cur.width}`}
                          active={false}
                          onPress={() => {
                            nudge();
                            setConfig({ width: cycle(StrokeSizes, cur.width) });
                          }}
                        >
                          <View
                            style={{
                              width: Math.min(20, cur.width + 3),
                              height: Math.min(20, cur.width + 3),
                              borderRadius: 10,
                              backgroundColor: c.text,
                            }}
                          />
                        </MiniButton>
                      ) : null}
                      {showFill ? (
                        <MiniButton
                          label={`${t.fill} ${cur.fillOpacity}%`}
                          active={filling}
                          wide
                          onPress={() => {
                            nudge();
                            setFilling(true);
                          }}
                        >
                          {/* The swatch is the fill itself: its colour at its opacity, outlined, and the number. */}
                          <View
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              borderWidth: 1.5,
                              borderColor: ink,
                              backgroundColor:
                                fillWith(fillInk, cur.fillOpacity) ?? 'transparent',
                            }}
                          />
                          <Txt weight="bold" size={11} style={{ marginLeft: 4 }}>
                            {`${cur.fillOpacity}%`}
                          </Txt>
                        </MiniButton>
                      ) : null}
                    </Cluster>
                  ) : null}

                  {kinds.length ? (
                    <Cluster>
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
                    </Cluster>
                  ) : null}

                  {showLine ? (
                    <>
                      <Cluster>
                        {(['headStart', 'headEnd'] as const).map((end) => (
                          <MiniButton
                            key={end}
                            label={t[end]}
                            active={false}
                            onPress={() => {
                              nudge();
                              setPickingHead(end);
                            }}
                          >
                            <MarkerIcon
                              kind={cur[end]}
                              end={end === 'headEnd'}
                              color={c.text}
                            />
                          </MiniButton>
                        ))}
                      </Cluster>
                      <Cluster>
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
                            <Svg
                              width={20}
                              height={20}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={cur.route === route ? '#FFFFFF' : c.text}
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <SvgPath d={routePath({ from: { x: 4, y: 19 }, to: { x: 20, y: 5 }, route })} />
                            </Svg>
                          </MiniButton>
                        ))}
                      </Cluster>
                      {cur.route === 'elbow' ? (
                        <Cluster>
                          {axisChoices.map(({ start, end, labelKey }) => {
                            const on = cur.startAxis === start && cur.endAxis === end;
                            return (
                              <MiniButton
                                key={labelKey}
                                label={t[labelKey]}
                                active={on}
                                onPress={() => {
                                  nudge();
                                  setConfig({ startAxis: start, endAxis: end });
                                }}
                              >
                                {start ? (
                                  <Svg
                                    width={20}
                                    height={20}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke={on ? '#FFFFFF' : c.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <SvgPath
                                      d={routePath({
                                        from: { x: 4, y: 19 },
                                        to: { x: 20, y: 5 },
                                        route: 'elbow',
                                        startAxis: start,
                                        endAxis: end,
                                      })}
                                    />
                                  </Svg>
                                ) : (
                                  <Txt weight="extrabold" size={11} color={on ? '#FFFFFF' : c.text}>
                                    A
                                  </Txt>
                                )}
                              </MiniButton>
                            );
                          })}
                        </Cluster>
                      ) : null}
                      <Cluster>
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
                            <Svg
                              width={20}
                              height={20}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={cur.dash === dash ? '#FFFFFF' : c.text}
                              strokeWidth={2.2}
                              strokeLinecap="round"
                            >
                              <SvgPath
                                d="M3 12H21"
                                strokeDasharray={dashIntervals(dash, 2.2)?.join(' ')}
                              />
                            </Svg>
                          </MiniButton>
                        ))}
                      </Cluster>
                    </>
                  ) : null}

                  {showSides ? (
                    <Cluster>
                      <StepperButton
                        icon="minus"
                        label={t.fewerSides}
                        onPress={() => {
                          nudge();
                          setConfig({ sides: Math.max(LIMITS.minSides, cur.sides - 1) });
                        }}
                      />
                      <Txt
                        weight="extrabold"
                        size={11}
                        mono
                        style={{ width: 52, textAlign: 'center' }}
                      >
                        {cur.sides} {t.sides}
                      </Txt>
                      <StepperButton
                        icon="plus"
                        label={t.moreSides}
                        onPress={() => {
                          nudge();
                          setConfig({ sides: Math.min(LIMITS.maxSides, cur.sides + 1) });
                        }}
                      />
                    </Cluster>
                  ) : null}

                  {showTextOptions ? (
                    <Cluster>
                      <StepperButton
                        icon="minus"
                        label={t.smaller}
                        onPress={() => {
                          nudge();
                          setFontSize(Math.max(LIMITS.minFontSize, fontSize - 4));
                        }}
                      />
                      <Txt
                        weight="extrabold"
                        size={11}
                        mono
                        style={{ width: 40, textAlign: 'center' }}
                      >
                        {fontSize}px
                      </Txt>
                      <StepperButton
                        icon="plus"
                        label={t.bigger}
                        onPress={() => {
                          nudge();
                          setFontSize(Math.min(LIMITS.maxFontSize, fontSize + 4));
                        }}
                      />
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
                          <Txt
                            size={14}
                            color={cur.font === font ? '#FFFFFF' : undefined}
                            style={{ fontFamily: FAMILIES[font][0] }}
                          >
                            Aa
                          </Txt>
                        </MiniButton>
                      ))}
                      {showStyle ? (
                        <>
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
                        </>
                      ) : null}
                    </Cluster>
                  ) : null}

                  {showColor ? (
                    <Cluster last>
                      {DrawingPalette.map((swatch) => {
                        const active = cur.color.toUpperCase() === swatch.toUpperCase();
                        return (
                          <Pressable
                            key={swatch}
                            accessibilityRole="button"
                            accessibilityLabel={`${t.color} ${swatch}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              nudge();
                              setConfig({ color: swatch });
                            }}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              backgroundColor: inkFor(swatch, dark),
                              borderWidth: 2,
                              borderColor: active ? c.accent : c.background,
                            }}
                          />
                        );
                      })}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t.custom}
                        onPress={() => setPicking(true)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          height: 26,
                          paddingHorizontal: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderStyle: 'dashed',
                          borderColor: c.borderDashed,
                        }}
                      >
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 4,
                            backgroundColor: ink,
                            borderWidth: 1,
                            borderColor: c.border,
                          }}
                        />
                        <Txt weight="bold" size={10} color={c.textSecondary}>
                          {t.custom}
                        </Txt>
                      </Pressable>
                    </Cluster>
                  ) : null}
                </View>
              )}
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
                    icon={entry.icon}
                    label={t[entry.labelKey]}
                    active={isActive(entry)}
                    size={buttonSize}
                    radius={buttonRadius}
                    onPress={() => pick(entry)}
                  />
                ))}
                {i === 0 ? swatch : null}
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

/** The value after `current` in `list`, wrapping; the first when `current` is not in it. */
function cycle<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** One cluster of options, separated from the next by a hairline. */
function Cluster({ children, last }: { children: React.ReactNode; last?: boolean }) {
  const c = useColors();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{children}</View>
      {last ? null : <View style={{ width: 1, height: 24, backgroundColor: c.border }} />}
    </>
  );
}

function ToolButton({
  icon,
  label,
  active,
  size,
  radius,
  onPress,
}: {
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
function MarkerIcon({ kind, end, color }: { kind: Marker; end: boolean; color: string }) {
  const c = useColors();
  const tip = end ? { x: 21, y: 12 } : { x: 3, y: 12 };
  const parts = markerPaths(kind, tip, end ? 0 : Math.PI, 7);
  // "None" is greyed: a bare line reads as nothing on purpose, not as a missing icon.
  const ink = kind !== 'none' ? color : color === '#FFFFFF' ? 'rgba(255,255,255,0.55)' : c.borderStrong;
  return (
    <Svg
      width={22}
      height={22}
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

function MiniButton({
  glyph,
  glyphWeight = 'bold',
  glyphItalic,
  label,
  active,
  onPress,
  wide = false,
  children,
}: {
  glyph?: string;
  glyphWeight?: 'bold' | 'extrabold';
  glyphItalic?: boolean;
  label: string;
  active: boolean;
  onPress: () => void;
  /** Room for a swatch and a number, not one glyph. */
  wide?: boolean;
  /** Drawn instead of the glyph. */
  children?: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={{
        ...(wide ? { minWidth: 36, paddingHorizontal: 8 } : { width: 36 }),
        height: 36,
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
