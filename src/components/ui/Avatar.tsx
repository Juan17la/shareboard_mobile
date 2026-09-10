import { View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { Txt } from './Text';

/** First letter of a nickname, the way the design labels presence. */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
}

export function Avatar({
  name,
  color,
  size = 36,
  overlap = false,
  label,
}: {
  name: string;
  color: string;
  size?: number;
  /** Pulls the avatar left so a row of them reads as a stack. */
  overlap?: boolean;
  label?: string;
}) {
  return (
    <View
      accessibilityLabel={label ?? name}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        marginLeft: overlap ? -8 : 0,
      }}
    >
      <Txt
        weight="extrabold"
        size={Math.round(size * 0.42)}
        tone="inverse"
        style={{ fontFamily: Fonts.extrabold }}
      >
        {initialsOf(name)}
      </Txt>
    </View>
  );
}

/** The "+3" chip that closes an overflowing avatar stack. */
export function AvatarOverflow({ count, size = 26 }: { count: number; size?: number }) {
  return (
    <View
      accessibilityLabel={`+${count}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 2,
        backgroundColor: 'rgba(27,32,48,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        marginLeft: -8,
      }}
    >
      <Txt weight="extrabold" size={Math.round(size * 0.4)} tone="inverse">
        +{count}
      </Txt>
    </View>
  );
}
