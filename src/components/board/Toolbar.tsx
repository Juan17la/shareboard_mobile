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
 * finger lands on the canvas (`railOpen` in the store).
 *
 * Nothing scrolls: in portrait the tools sit in two rows (tools, then shapes)
 * and the options wrap, so everything is visible at once on a narrow phone.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, DrawingPalette, StrokeSizes } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { LIMITS, SHAPE_TEXT_SIZE, type ShapeKind, type ToolType } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { StepperButton } from '../ui/Button';
import { ColorPickerSheet } from '../ui/ColorPickerSheet';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';

type LabelKey =
  | 'hand'
  | 'pencil'
  | 'eraser'
  | 'shapeRectangle'
  | 'shapeEllipse'
  | 'shapeTriangle'
  | 'shapeLine'
  | 'shapeArrow'
  | 'text'
  | 'fill';

const TOOLS: { tool: ToolType; shape?: ShapeKind; icon: IconName; labelKey: LabelKey }[] = [
  { tool: 'hand', icon: 'hand', labelKey: 'hand' },
  { tool: 'pen', icon: 'pencil', labelKey: 'pencil' },
  { tool: 'eraser', icon: 'eraser', labelKey: 'eraser' },
  { tool: 'shape', shape: 'rectangle', icon: 'rectangle', labelKey: 'shapeRectangle' },
  { tool: 'shape', shape: 'ellipse', icon: 'ellipse', labelKey: 'shapeEllipse' },
  { tool: 'shape', shape: 'triangle', icon: 'triangle', labelKey: 'shapeTriangle' },
  { tool: 'shape', shape: 'line', icon: 'line', labelKey: 'shapeLine' },
  { tool: 'shape', shape: 'arrow', icon: 'arrow', labelKey: 'shapeArrow' },
  { tool: 'text', icon: 'text', labelKey: 'text' },
  { tool: 'fill', icon: 'fill', labelKey: 'fill' },
];

/** Height of the bar: one row in landscape, two in portrait. */
export const toolbarHeight = (landscape: boolean) => (landscape ? 46 : 96);

export function Toolbar({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const setTool = useBoardStore((s) => s.setTool);
  const setConfig = useBoardStore((s) => s.setConfig);
  const updateShape = useBoardStore((s) => s.updateShape);
  const selected = useBoardStore((s) => s.selectedShape());
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);

  const open = useBoardStore((s) => s.railOpen);
  const setOpen = useBoardStore((s) => s.setRailOpen);
  const [picking, setPicking] = useState(false);

  const nudge = () => tick(haptics);

  const isActive = (entry: (typeof TOOLS)[number]) =>
    tool === entry.tool && (!entry.shape || config.shape === entry.shape);

  const pick = (entry: (typeof TOOLS)[number]) => {
    nudge();
    if (isActive(entry)) {
      setOpen(!open);
      return;
    }
    setTool(entry.tool);
    if (entry.shape) setConfig({ shape: entry.shape });
    // The hand has nothing to configure; an empty strip would just be noise.
    setOpen(entry.tool !== 'hand');
  };

  // A viewer has no tools at all: the design hides them rather than greying
  // them out, so the board is all there is to look at (docs/04).
  if (!canEdit) return null;

  const showSizes = tool === 'pen' || tool === 'eraser' || tool === 'shape';
  const showFill = tool === 'shape' && config.shape !== 'line' && config.shape !== 'arrow';
  // A selected shape borrows the text tool's size stepper for its label.
  const showTextOptions = tool === 'text' || selected !== null;
  const showColor = tool !== 'hand' && tool !== 'eraser';
  const fontSize = selected ? (selected.fontSize ?? SHAPE_TEXT_SIZE) : config.fontSize;
  const setFontSize = (next: number) =>
    selected ? updateShape(selected.id, { fontSize: next }) : setConfig({ fontSize: next });

  const buttonSize = landscape ? 34 : 40;
  const buttonRadius = landscape ? 12 : 14;
  // Portrait: plain tools on one row, the shape kinds on the next.
  const rows = landscape ? [TOOLS] : [TOOLS.filter((e) => !e.shape), TOOLS.filter((e) => e.shape)];

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
        {open ? (
          <GlassPanel level="panel" radius={16} style={[panelShadow, { maxWidth: '100%' }]}>
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
              {showSizes ? (
                <Cluster>
                  {StrokeSizes.map((value) => {
                    const active = config.width === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`${t.size} ${value}`}
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          nudge();
                          setConfig({ width: value });
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: active ? 'transparent' : Colors.border,
                          backgroundColor: active ? Colors.accentSoft : '#FFFFFF',
                        }}
                      >
                        <View
                          style={{
                            width: Math.min(20, value + 3),
                            height: Math.min(20, value + 3),
                            borderRadius: 10,
                            backgroundColor: active ? Colors.accent : '#4A515F',
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </Cluster>
              ) : null}

              {showFill ? (
                <Cluster>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.filled}
                    accessibilityState={{ selected: config.filled }}
                    onPress={() => {
                      nudge();
                      setConfig({ filled: !config.filled });
                    }}
                    style={{
                      height: 32,
                      justifyContent: 'center',
                      paddingHorizontal: 10,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor: config.filled ? 'transparent' : Colors.borderStrong,
                      backgroundColor: config.filled ? Colors.accent : '#FFFFFF',
                    }}
                  >
                    <Txt weight="bold" size={11} color={config.filled ? '#FFFFFF' : '#4A515F'}>
                      {t.filled}
                    </Txt>
                  </Pressable>
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
                  <Txt weight="extrabold" size={11} mono style={{ width: 40, textAlign: 'center' }}>
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
                  {selected ? null : (
                    <>
                      <MiniButton
                        glyph="B"
                        glyphWeight="extrabold"
                        label={t.bold}
                        active={config.bold}
                        onPress={() => {
                          nudge();
                          setConfig({ bold: !config.bold });
                        }}
                      />
                      <MiniButton
                        glyph="I"
                        glyphItalic
                        label={t.italic}
                        active={config.italic}
                        onPress={() => {
                          nudge();
                          setConfig({ italic: !config.italic });
                        }}
                      />
                    </>
                  )}
                </Cluster>
              ) : null}

              {showColor ? (
                <Cluster last>
                  {DrawingPalette.map((swatch) => {
                    const active = config.color.toUpperCase() === swatch.toUpperCase();
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
                          backgroundColor: swatch,
                          borderWidth: 2,
                          borderColor: active ? Colors.accent : 'rgba(255,255,255,0.9)',
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
                      borderColor: Colors.borderDashed,
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        backgroundColor: config.color,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    />
                    <Txt weight="bold" size={10} color="rgba(27,32,48,0.6)">
                      {t.custom}
                    </Txt>
                  </Pressable>
                </Cluster>
              ) : null}
            </View>
          </GlassPanel>
        ) : null}

        <GlassPanel level="panel" radius={landscape ? 17 : 20} style={[panelShadow, { maxWidth: '100%' }]}>
          <View
            style={{ gap: landscape ? 3 : 4, padding: landscape ? 5 : 6 }}
            accessibilityRole="toolbar"
            accessibilityLabel={t.sheetMenu}
          >
            {rows.map((row, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: landscape ? 3 : 4,
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
                {i === 0 ? <Swatch /> : null}
              </View>
            ))}
          </View>
        </GlassPanel>
      </View>

      <ColorPickerSheet
        open={picking}
        value={config.color}
        onClose={() => setPicking(false)}
        onPick={(color) => {
          nudge();
          setConfig({ color });
          setPicking(false);
        }}
      />
    </>
  );

  /* The swatch doubles as the options toggle: it is both the current colour
     and a handle for the strip that changes it. Sits on the first row. */
  function Swatch() {
    return (
      <>
        <View style={{ width: 1, height: 24, marginHorizontal: 4, backgroundColor: Colors.border }} />
        <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.color}
              accessibilityState={{ expanded: open }}
              onPress={() => {
                nudge();
                setOpen(!open);
              }}
              style={{
                width: buttonSize,
                height: buttonSize,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: buttonRadius,
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: 'rgba(255,255,255,0.6)',
              }}
            >
              <View
                style={{
                  width: landscape ? 19 : 22,
                  height: landscape ? 19 : 22,
                  borderRadius: 7,
                  backgroundColor: config.color,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              />
            </Pressable>
      </>
    );
  }
}

const panelShadow = {
  shadowColor: '#151A2D',
  shadowOpacity: 0.16,
  shadowRadius: 34,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

/** One cluster of options, separated from the next by a hairline. */
function Cluster({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{children}</View>
      {last ? null : <View style={{ width: 1, height: 24, backgroundColor: Colors.border }} />}
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        backgroundColor: active ? Colors.accent : 'transparent',
        ...(active
          ? {
              shadowColor: Colors.accent,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }
          : null),
      }}
    >
      <Icon name={icon} size={21} color={active ? '#FFFFFF' : Colors.text} />
    </Pressable>
  );
}

function MiniButton({
  glyph,
  glyphWeight = 'bold',
  glyphItalic,
  label,
  active,
  onPress,
}: {
  glyph: string;
  glyphWeight?: 'bold' | 'extrabold';
  glyphItalic?: boolean;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? 'transparent' : Colors.borderStrong,
        backgroundColor: active ? Colors.accent : '#FFFFFF',
      }}
    >
      <Txt weight={glyphWeight} italic={glyphItalic} size={13} color={active ? '#FFFFFF' : Colors.text}>
        {glyph}
      </Txt>
    </Pressable>
  );
}
