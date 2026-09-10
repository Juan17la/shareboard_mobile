/**
 * The bottom sheet every secondary surface in the design lives in.
 *
 * The old build put these on `(modals)` routes, which pushed a whole screen and
 * hid the board behind it. The design keeps the board visible under a scrim and
 * slides a frosted panel up over it — you can still see the drawing you are
 * granting someone access to. Sheets are therefore components rendered by the
 * screen that owns them, not routes.
 *
 * `Modal` is still what wraps it: it is what puts the panel above everything
 * else (including the Skia canvas) and what makes Android's back gesture close
 * the sheet rather than leave the board.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Glass, Radius } from '@/constants/theme';

import { GlassPanel } from './Glass';
import { IconButton } from './Button';
import { Txt } from './Text';
import { ToastHost } from './Toast';

const ABSOLUTE_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

export function Sheet({
  open,
  title,
  onClose,
  children,
  closeLabel = 'Close',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
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
  }, [open, anim]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
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
            ],
            opacity: anim,
            maxHeight: height * 0.78,
          }}
        >
          <GlassPanel
            level="panel"
            radius={Radius.xxl}
            border={null}
            style={{
              borderTopLeftRadius: Radius.xxl,
              borderTopRightRadius: Radius.xxl,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.9)',
              // A sheet is a light panel over a light board; without a shadow
              // its top edge disappears into the scrim.
              shadowColor: '#151A2D',
              shadowOpacity: 0.18,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: -12 },
              elevation: 24,
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 2 }}>
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 99,
                  backgroundColor: 'rgba(27,32,48,0.16)',
                }}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 6,
                paddingBottom: 14,
              }}
            >
              <Txt weight="extrabold" size={18} leading={1.2} tracking={-0.3} style={{ flex: 1 }}>
                {title}
              </Txt>
              <IconButton
                icon="close"
                label={closeLabel}
                onPress={onClose}
                size={30}
                iconSize={15}
                radius={10}
              />
            </View>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 12) + 18,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </GlassPanel>
        </Animated.View>

        {/* Lives inside the sheet's own window so a toast raised by something
            in the sheet ("Code copied") is actually visible. */}
        <ToastHost top={insets.top + 24} />
      </View>
    </Modal>
  );
}

/** A row of the "label + description + control" shape the sheets are made of. */
export function SheetRow({
  title,
  description,
  right,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt weight="bold" size={13} leading={1.2}>
          {title}
        </Txt>
        {description ? (
          <Txt size={11} leading={1.3} tone="secondary">
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
    gap: 10,
    padding: 13,
  };

  return (
    <GlassPanel level="row" radius={15} border={Colors.border}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          style={({ pressed }) => [style, pressed ? { backgroundColor: 'rgba(255,255,255,0.7)' } : null]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={style}>{body}</View>
      )}
    </GlassPanel>
  );
}

/** Small uppercase section label used above groups inside sheets and screens. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Txt weight="extrabold" size={10.5} tracking={0.9} tone="secondary">
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Txt>
  );
}
