/**
 * The dark pill that confirms an action ("Code copied", "Board cleared").
 *
 * Toasts are held in a tiny store rather than in the board screen's state,
 * because the things that raise them — a sheet, a dialog, a long-press on the
 * header — are scattered across the tree and several of them unmount at the
 * same moment they fire (a sheet closing on "Download"). A store outlives that.
 */
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { create } from 'zustand';

import { Fonts, Radius } from '@/constants/theme';

interface ToastState {
  message: string | null;
  /** Bumped on every `show` so repeating the same message re-animates. */
  nonce: number;
  show(message: string): void;
  hide(): void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  nonce: 0,
  show(message) {
    set((s) => ({ message, nonce: s.nonce + 1 }));
  },
  hide() {
    set({ message: null });
  },
}));

/** Fire a toast from anywhere, including outside React. */
export function toast(message: string): void {
  useToastStore.getState().show(message);
}

/**
 * `enabled` exists because a `Modal` renders in its own window on iOS: a toast
 * in the screen behind an open sheet is simply not on screen. The sheet renders
 * its own host, and the screen switches its off while one is open, so exactly
 * one is ever live.
 */
export function ToastHost({
  bottom = 110,
  top,
  enabled = true,
}: {
  bottom?: number;
  top?: number;
  enabled?: boolean;
}) {
  const message = useToastStore((s) => s.message);
  const nonce = useToastStore((s) => s.nonce);
  const hide = useToastStore((s) => s.hide);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) hide();
        },
      );
    }, 1700);
    return () => clearTimeout(timer);
  }, [message, nonce, opacity, hide]);

  if (!message || !enabled) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity,
        ...(top !== undefined ? { top } : { bottom }),
      }}
    >
      <View
        style={{
          paddingHorizontal: 15,
          paddingVertical: 9,
          borderRadius: Radius.pill,
          backgroundColor: 'rgba(27,32,48,0.9)',
          shadowColor: '#151A2D',
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        <Animated.Text style={{ fontFamily: Fonts.bold, fontSize: 12, color: '#FFFFFF' }}>
          {message}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}
