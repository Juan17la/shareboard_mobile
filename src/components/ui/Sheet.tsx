/**
 * The bottom sheet every secondary surface in the design lives in.
 *
 * The old build put these on `(modals)` routes, which pushed a whole screen and
 * hid the board behind it. The design keeps the board visible under a scrim and
 * slides a solid panel up over it — you can still see the drawing you are
 * granting someone access to. Sheets are therefore components rendered by the
 * screen that owns them, not routes.
 *
 * `Modal` is still what wraps it: it is what puts the panel above everything
 * else (including the Skia canvas) and what makes Android's back gesture close
 * the sheet rather than leave the board.
 */
import { Children, createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, Radius, lineColor, type Line } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { useT } from '@/features/i18n/store';

import { MirrorScene } from '../board/BoardMirror';
import { GlassPanel, NoGlassScene } from './Glass';
import { IconButton } from './Button';
import { Txt } from './Text';
import { ToastHost } from './Toast';
import { SheetBack } from './sheet-back';

const ABSOLUTE_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

export function Sheet({
  open,
  title,
  onClose,
  children,
  closeLabel = 'Close',
  tall = false,
  full = false,
  large = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
  /** Up to 92% of the screen instead of 82%, for sheets with a preview (AI). */
  tall?: boolean;
  /**
   * The whole height of the screen, and no scroll view: the children fill the
   * body and scroll themselves (a chat, with its input pinned at the bottom).
   */
  full?: boolean;
  /** The title set big, for a sheet that is one task (sign in). */
  large?: boolean;
}) {
  const onBack = useContext(SheetBack);
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const c = useColors();
  const [anim] = useState(() => new Animated.Value(0));
  // Dragging the handle or the title row down dismisses the sheet, as the handle promises.
  const [drag] = useState(() => new Animated.Value(0));
  const pan = useMemo(() => {
    const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || (g.dy > 24 && g.vy > 0.6)) onClose();
        else settle();
      },
      onPanResponderTerminate: settle,
    });
  }, [drag, onClose]);
  // The keyboard covers the bottom of the window (nothing resizes it: the app
  // draws edge to edge), so a sheet with an input lifts itself above it. The
  // window's own height says whether it was resized after all, so the two
  // never add up.
  const [keyboard, setKeyboard] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  useEffect(() => {
    if (!open) return;
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKeyboard(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboard(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [open]);
  const covered = windowHeight ? Math.max(0, Dimensions.get('screen').height - windowHeight) : 0;
  const lift = Math.max(0, keyboard - covered);
  const room = (windowHeight || height) - lift - insets.top - 16;
  const fit = full ? room : Math.min(height * (tall ? 0.92 : 0.82), room);

  useEffect(() => {
    drag.setValue(0);
    if (!open) {
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.bezier(0.22, 0.9, 0.26, 1),
      useNativeDriver: true,
    }).start();
  }, [open, anim, drag]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      // Android's back goes back a sheet when there is one to go back to.
      onRequestClose={onBack ?? onClose}
      statusBarTranslucent
    >
      <MirrorScene veil={Glass.scrim}>
        <View
          style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: lift }}
          onLayout={(e) => setWindowHeight(e.nativeEvent.layout.height)}
        >
          <Animated.View style={{ ...ABSOLUTE_FILL, opacity: anim }}>
            {/* Tap-outside-to-close, hidden from assistive tech: it does exactly
                what the close button beside the title does, and announcing both
                gives a screen-reader user two identical "Close" targets. */}
            <Pressable
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              onPress={onClose}
              style={{ flex: 1, backgroundColor: Glass.scrim }}
            />
          </Animated.View>

          <Animated.View
            style={{
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                { translateY: drag },
              ],
              opacity: anim,
              maxHeight: fit,
              ...(full ? { height: fit } : null),
            }}
          >
            <GlassPanel
              level="panel"
              radius={Radius.xl}
              border={null}
              style={{
                // The panel gives way to the wrapper's maximum height, and its
                // scroll view with it; unshrunk, the bottom of a tall sheet
                // (Settings' delete button) ran past the edge, out of reach.
                flexShrink: 1,
                ...(full ? { flex: 1 } : null),
                borderTopLeftRadius: Radius.lg + 2,
                borderTopRightRadius: Radius.lg + 2,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                // A hairline edge: on the black board the shadow has nothing to fall on.
                borderTopWidth: 1,
                borderTopColor: c.borderStrong,
                shadowColor: '#0F1B2D',
                shadowOpacity: 0.18,
                shadowRadius: 40,
                shadowOffset: { width: 0, height: -12 },
                elevation: 24,
              }}
            >
              <NoGlassScene>
              <View {...pan.panHandlers}>
              <View style={{ alignItems: 'center', paddingTop: 6 }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 99,
                    backgroundColor: c.borderStrong,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingHorizontal: 16,
                  paddingTop: 4,
                  paddingBottom: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                {onBack ? <IconButton icon="back" label={t.back} onPress={onBack} size={32} iconSize={15} /> : null}
                <Txt
                  weight="bold"
                  size={large ? 28 : 18}
                  leading={1.2}
                  tracking={large ? -0.6 : -0.3}
                  style={{ flex: 1 }}
                >
                  {title}
                </Txt>
                <IconButton icon="close" label={closeLabel} onPress={onClose} size={32} iconSize={15} />
              </View>
              </View>

              {full ? (
                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: (lift ? 12 : Math.max(insets.bottom, 12)) + 10,
                  }}
                >
                  {children}
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 14,
                    paddingBottom: (lift ? 12 : Math.max(insets.bottom, 12)) + 16,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              )}
              </NoGlassScene>
            </GlassPanel>
          </Animated.View>

          {/* Lives inside the sheet's own window so a toast raised by something
              in the sheet ("Code copied") is actually visible. */}
          <ToastHost top={insets.top + 24} />
        </View>
      </MirrorScene>
    </Modal>
  );
}

/** True inside a `SheetGroup`: its rows share the group's card instead of each wearing one. */
const InGroup = createContext(false);

/**
 * A titled list of rows in one card, divided by hairlines — the settings
 * shape. Each group sits on its own line, like the menu's sections.
 * Mirrors web `SheetGroup`.
 */
export function SheetGroup({ title, line, children }: { title?: string; line?: Line; children: ReactNode }) {
  const c = useColors();
  const rows = Children.toArray(children);
  return (
    <View accessibilityLabel={title} style={{ gap: 6 }}>
      {title ? <SectionLabel line={line}>{title}</SectionLabel> : null}
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.borderStrong,
          backgroundColor: c.background,
          overflow: 'hidden',
        }}
      >
        <InGroup.Provider value>
          {rows.map((row, i) => (
            <Fragment key={i}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: c.border }} /> : null}
              {row}
            </Fragment>
          ))}
        </InGroup.Provider>
      </View>
    </View>
  );
}

/** A row of the "label + description + control" shape the sheets are made of. */
export function SheetRow({
  title,
  description,
  right,
  onPress,
  accessibilityLabel,
  tone = 'default',
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** `danger` for the destructive rows at the end of a group. */
  tone?: 'default' | 'danger';
}) {
  const c = useColors();
  const grouped = useContext(InGroup);
  const body = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt weight="semibold" size={14} leading={1.2} tone={tone === 'danger' ? 'danger' : 'default'}>
          {title}
        </Txt>
        {description ? (
          <Txt size={12} leading={1.3} tone="secondary">
            {description}
          </Txt>
        ) : null}
      </View>
      {right}
    </>
  );

  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 9,
  };

  const content = onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [style, pressed ? { backgroundColor: c.surfaceSelected } : null]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );

  return grouped ? (
    content
  ) : (
    <GlassPanel level="row" radius={12} border={c.borderStrong}>
      {content}
    </GlassPanel>
  );
}

/**
 * A section heading inside sheets and screens, set like a station on a line
 * map: a ringed stop in the section's line colour, then the name.
 */
export function SectionLabel({ children, line = 'ink' }: { children: ReactNode; line?: Line }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 3,
          borderColor: lineColor(c, line),
          backgroundColor: c.background,
        }}
      />
      <Txt weight="bold" size={13}>
        {children}
      </Txt>
    </View>
  );
}
