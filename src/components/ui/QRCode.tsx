/**
 * Renders a board link as a scannable QR code, drawn as one SVG path.
 *
 * Every dark module becomes a subpath of a single `<Path>` rather than its own
 * `<Rect>`: a version-4 code is over a thousand modules, and a thousand views
 * is enough to be felt when the share sheet opens.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { Colors, Radius } from '@/constants/theme';
import { encodeQr } from '@/features/qr/encode';

import { Txt } from './Text';

export function QRCode({
  value,
  size = 96,
  color = Colors.text,
  /** Quiet zone in modules. The spec asks for 4; the card border stands in for
   *  most of it, so 2 keeps the code dense without hurting scans. */
  quietZone = 2,
}: {
  value: string;
  size?: number;
  color?: string;
  quietZone?: number;
}) {
  const code = useMemo(() => {
    try {
      return encodeQr(value);
    } catch {
      return null;
    }
  }, [value]);

  const shell = {
    width: size,
    height: size,
    flexShrink: 0,
    padding: 6,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (!code) {
    return (
      <View style={shell}>
        <Txt size={9} tone="tertiary" style={{ textAlign: 'center' }}>
          —
        </Txt>
      </View>
    );
  }

  const span = code.size + quietZone * 2;
  let d = '';
  for (let r = 0; r < code.size; r++) {
    for (let c = 0; c < code.size; c++) {
      if (code.modules[r][c]) d += `M${c + quietZone} ${r + quietZone}h1v1h-1z`;
    }
  }

  return (
    <View style={shell} accessibilityLabel={value}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${span} ${span}`}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}
