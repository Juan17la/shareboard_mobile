/**
 * The pill that says the board is not live right now.
 *
 * `offline` is the actionable state: the socket has given up (or is between
 * attempts), nothing drawn is being sent, and the button reconnects at once.
 * `connecting` only needs to be seen, not acted on.
 */
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { Shadow } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import { useBoardStore } from '@/features/board/store';
import { useT } from '@/features/i18n/store';

import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';

export function ConnectionBanner({ top, onRetry }: { top: number; onRetry: () => void }) {
  const c = useColors();
  const t = useT();
  const connection = useBoardStore((s) => s.connection);
  if (connection === 'online' || connection === 'idle') return null;
  const offline = connection === 'offline';
  const color = offline ? c.danger : c.textSecondary;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOut.duration(200)}
      accessibilityRole="alert"
      pointerEvents="box-none"
      style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center' }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: offline ? 'rgba(196,53,58,0.25)' : c.border,
          backgroundColor: c.glassFlat,
          ...Shadow.panel,
        }}
      >
        <Icon name={offline ? 'warning' : 'link'} size={15} color={color} />
        <Txt weight="bold" size={12.5} color={color}>
          {offline ? t.offlineHint : t.reconnecting}
        </Txt>
        {offline ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: c.danger,
            }}
          >
            <Txt weight="extrabold" size={12} tone="inverse">
              {t.retry}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
