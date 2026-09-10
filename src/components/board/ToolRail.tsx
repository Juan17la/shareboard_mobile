/**
 * The floating tool rail and its options panel.
 *
 * The design puts five tools in a vertical rail on the right — thumb-reachable
 * without covering the drawing — and hides everything else in a second column
 * that opens beside it and only ever shows the options belonging to the tool in
 * hand. That is the "las herramientas más usadas siempre visibles; las menos
 * frecuentes, ocultas hasta que se necesitan" rule from docs/01 made literal:
 * the pencil never shows you a bold button.
 *
 * The rail is a single component rather than five, because which options are
 * on screen is a function of the active tool and nothing else.
 */
import { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { Colors, DrawingPalette, Radius, StrokeSizes } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { LIMITS, type ShapeKind, type ToolType } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { Hairline, StepperButton } from '../ui/Button';
import { ColorPickerSheet } from '../ui/ColorPickerSheet';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';

const TOOLS: { tool: ToolType; icon: IconName; labelKey: 'pencil' | 'eraser' | 'shapes' | 'text' | 'fill' }[] = [
  { tool: 'pen', icon: 'pencil', labelKey: 'pencil' },
  { tool: 'eraser', icon: 'eraser', labelKey: 'eraser' },
  { tool: 'shape', icon: 'shapes', labelKey: 'shapes' },
  { tool: 'text', icon: 'text', labelKey: 'text' },
  { tool: 'fill', icon: 'fill', labelKey: 'fill' },
];

const SHAPE_KINDS: { kind: ShapeKind; icon: IconName; labelKey: 'shapeRectangle' | 'shapeEllipse' | 'shapeTriangle' | 'shapeLine' | 'shapeArrow' }[] = [
  { kind: 'rectangle', icon: 'rectangle', labelKey: 'shapeRectangle' },
  { kind: 'ellipse', icon: 'ellipse', labelKey: 'shapeEllipse' },
  { kind: 'triangle', icon: 'triangle', labelKey: 'shapeTriangle' },
  { kind: 'line', icon: 'line', labelKey: 'shapeLine' },
  { kind: 'arrow', icon: 'arrow', labelKey: 'shapeArrow' },
];

export function ToolRail({ landscape }: { landscape: boolean }) {
  const { height } = useWindowDimensions();
  const t = useT();
  const tool = useBoardStore((s) => s.tool);
  const config = useBoardStore((s) => s.config);
  const setTool = useBoardStore((s) => s.setTool);
  const setConfig = useBoardStore((s) => s.setConfig);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);

  const [open, setOpen] = useState(true);
  const [picking, setPicking] = useState(false);

  // Leave the bottom controls and the safe area clear rather than picking a
  // fixed height that overflows on a small phone and wastes space on a tablet.
  const railTop = landscape ? 96 : 154;
  const optionsMaxHeight = Math.max(200, height - railTop - (landscape ? 60 : 140));

  const buttonSize = landscape ? 34 : 40;
  const buttonRadius = landscape ? 12 : 14;
  const swatchSize = landscape ? 19 : 22;

  const nudge = () => tick(haptics);

  const pickTool = (next: ToolType) => {
    nudge();
    setTool(next);
    setOpen(true);
  };

  const toolLabel =
    tool === 'pen' ? t.pencil : tool === 'eraser' ? t.eraser : tool === 'shape' ? t.shapes : tool === 'text' ? t.text : t.fill;

  const showSizes = tool === 'pen' || tool === 'eraser' || tool === 'shape';
  const showShapeKinds = tool === 'shape';
  const showTextOptions = tool === 'text';

  return (
    <>
      <View
        style={{
          position: 'absolute',
          right: landscape ? 16 : 10,
          top: railTop,
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          gap: 8,
        }}
        pointerEvents="box-none"
      >
        <GlassPanel level="panel" radius={landscape ? 17 : Radius.xl} style={panelShadow}>
          <View style={{ gap: landscape ? 3 : 4, padding: landscape ? 5 : 6 }}>
            {TOOLS.map((entry) => (
              <RailButton
                key={entry.tool}
                icon={entry.icon}
                label={t[entry.labelKey]}
                active={tool === entry.tool}
                disabled={!canEdit}
                size={buttonSize}
                radius={buttonRadius}
                onPress={() => pickTool(entry.tool)}
              />
            ))}

            <Hairline style={{ marginHorizontal: 6, marginVertical: 1 }} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.color}
              accessibilityState={{ expanded: open }}
              onPress={() => {
                nudge();
                setOpen((v) => !v);
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
                  width: swatchSize,
                  height: swatchSize,
                  borderRadius: 7,
                  backgroundColor: config.color,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              />
            </Pressable>
          </View>
        </GlassPanel>

        {open ? (
          <GlassPanel level="panel" radius={Radius.xl} style={panelShadow}>
            <ScrollView
              style={{ width: landscape ? 112 : 80, maxHeight: optionsMaxHeight }}
              contentContainerStyle={{
                gap: landscape ? 6 : 9,
                paddingHorizontal: landscape ? 7 : 8,
                paddingVertical: landscape ? 8 : 10,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Txt weight="extrabold" size={landscape ? 9.5 : 10.5} tracking={0.8} tone="secondary">
                {toolLabel.toUpperCase()}
              </Txt>

              {showSizes ? (
                <>
                  <View
                    style={
                      landscape
                        ? { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }
                        : { gap: 6, alignItems: 'center' }
                    }
                  >
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
                            width: landscape ? 44 : 52,
                            height: landscape ? 22 : 26,
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
                  </View>
                  <Hairline />
                </>
              ) : null}

              {showShapeKinds ? (
                <>
                  <View
                    style={
                      landscape
                        ? { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }
                        : { gap: 6, alignItems: 'center' }
                    }
                  >
                    {SHAPE_KINDS.map((entry) => (
                      <MiniButton
                        key={entry.kind}
                        icon={entry.icon}
                        label={t[entry.labelKey]}
                        active={config.shape === entry.kind}
                        landscape={landscape}
                        onPress={() => {
                          nudge();
                          setConfig({ shape: entry.kind });
                        }}
                      />
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.filled}
                    accessibilityState={{ selected: config.filled }}
                    onPress={() => {
                      nudge();
                      setConfig({ filled: !config.filled });
                    }}
                    style={{
                      alignItems: 'center',
                      paddingVertical: 7,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: config.filled ? 'transparent' : Colors.borderStrong,
                      backgroundColor: config.filled ? Colors.accent : '#FFFFFF',
                    }}
                  >
                    <Txt weight="bold" size={10} color={config.filled ? '#FFFFFF' : '#4A515F'}>
                      {t.filled}
                    </Txt>
                  </Pressable>
                  <Hairline />
                </>
              ) : null}

              {showTextOptions ? (
                <>
                  {/* The size sits above its own +/- pair rather than
                      between them: side by side, the three do not fit the
                      column's width without the "+" sliding off the edge. */}
                  <View style={{ alignItems: 'center', gap: 5 }}>
                    <Txt weight="extrabold" size={11} mono>
                      {config.fontSize}px
                    </Txt>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <StepperButton
                        icon="minus"
                        label={t.smaller}
                        onPress={() => {
                          nudge();
                          setConfig({
                            fontSize: Math.max(LIMITS.minFontSize, config.fontSize - 4),
                          });
                        }}
                      />
                      <StepperButton
                        icon="plus"
                        label={t.bigger}
                        onPress={() => {
                          nudge();
                          setConfig({
                            fontSize: Math.min(LIMITS.maxFontSize, config.fontSize + 4),
                          });
                        }}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 5, justifyContent: 'center' }}>
                    <MiniButton
                      glyph="B"
                      glyphWeight="extrabold"
                      label={t.bold}
                      active={config.bold}
                      landscape={landscape}
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
                      landscape={landscape}
                      onPress={() => {
                        nudge();
                        setConfig({ italic: !config.italic });
                      }}
                    />
                  </View>
                  <Hairline />
                </>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  justifyContent: 'center',
                }}
              >
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
                        width: landscape ? 22 : 26,
                        height: landscape ? 22 : 26,
                        borderRadius: 8,
                        backgroundColor: swatch,
                        borderWidth: 2,
                        borderColor: active ? Colors.accent : 'rgba(255,255,255,0.9)',
                      }}
                    />
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.custom}
                onPress={() => setPicking(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: 6,
                  paddingHorizontal: 4,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: Colors.borderDashed,
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: config.color,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                />
                <Txt weight="bold" size={9.5} color="rgba(27,32,48,0.6)">
                  {t.custom}
                </Txt>
              </Pressable>
            </ScrollView>
          </GlassPanel>
        ) : null}
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
}

const panelShadow = {
  shadowColor: '#151A2D',
  shadowOpacity: 0.16,
  shadowRadius: 34,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

function RailButton({
  icon,
  label,
  active,
  disabled,
  size,
  radius,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  disabled: boolean;
  size: number;
  radius: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        borderWidth: 1,
        borderColor: active ? 'transparent' : Colors.border,
        backgroundColor: active ? Colors.accent : 'rgba(255,255,255,0.55)',
        opacity: disabled ? 0.4 : 1,
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
      <Icon name={icon} size={22} color={active ? '#FFFFFF' : Colors.text} />
    </Pressable>
  );
}

function MiniButton({
  icon,
  glyph,
  glyphWeight = 'bold',
  glyphItalic,
  label,
  active,
  landscape,
  onPress,
}: {
  icon?: IconName;
  glyph?: string;
  glyphWeight?: 'bold' | 'extrabold';
  glyphItalic?: boolean;
  label: string;
  active: boolean;
  landscape: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        width: landscape ? 30 : 34,
        height: landscape ? 26 : 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 9,
        borderWidth: 1,
        borderColor: active ? 'transparent' : Colors.borderStrong,
        backgroundColor: active ? Colors.accent : '#FFFFFF',
      }}
    >
      {icon ? (
        <Icon name={icon} size={20} color={active ? '#FFFFFF' : Colors.text} />
      ) : (
        <Txt
          weight={glyphWeight}
          italic={glyphItalic}
          size={13}
          color={active ? '#FFFFFF' : Colors.text}
        >
          {glyph}
        </Txt>
      )}
    </Pressable>
  );
}
