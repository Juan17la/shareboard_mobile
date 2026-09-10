/**
 * The zoom readout and the undo/redo pair, floating at the bottom-left.
 *
 * They are at the opposite corner from the tool rail on purpose: these are the
 * two things a right-handed person reaches for *while* drawing, and putting
 * them under the drawing hand would mean covering the board to undo.
 *
 * The zoom chip doubles as its own reset — the design's "100%" button snaps the
 * camera home, which is the only way back after a long pan on an infinite
 * canvas.
 */
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Txt } from '../ui/Text';

export function BottomControls({ landscape }: { landscape: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const undoDepth = useBoardStore((s) => s.undoStack.length);
  const redoDepth = useBoardStore((s) => s.redoStack.length);
  const haptics = useSessionStore((s) => s.settings.haptics);

  const zoom = `${Math.round(camera.scale * 100)}%`;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: Math.max(insets.left, landscape ? 16 : 12),
        bottom: Math.max(insets.bottom, landscape ? 16 : 28) + (landscape ? 6 : 16),
        flexDirection: landscape ? 'row' : 'column',
        alignItems: landscape ? 'center' : 'flex-start',
        gap: 10,
      }}
    >
      <GlassPanel level="chip" radius={14} border="rgba(255,255,255,0.6)" style={floatShadow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.resetZoom} (${zoom})`}
          onPress={() => {
            tick(haptics);
            setCamera({ x: 0, y: 0, scale: 1 });
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 11,
            paddingVertical: 8,
          }}
        >
          <Icon name="search" size={14} color={Colors.text} />
          <Txt weight="bold" size={11.5} mono>
            {zoom}
          </Txt>
        </Pressable>
      </GlassPanel>

      <GlassPanel level="chip" radius={18} border="rgba(255,255,255,0.6)" style={floatShadow}>
        <View style={{ flexDirection: 'row', gap: 4, padding: 5 }}>
          <HistoryButton
            icon="undo"
            label={t.undo}
            enabled={undoDepth > 0}
            onPress={() => {
              tick(haptics);
              undo();
            }}
          />
          <HistoryButton
            icon="redo"
            label={t.redo}
            enabled={redoDepth > 0}
            onPress={() => {
              tick(haptics);
              redo();
            }}
          />
        </View>
      </GlassPanel>
    </View>
  );
}

const floatShadow = {
  shadowColor: '#151A2D',
  shadowOpacity: 0.12,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
} as const;

function HistoryButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: 'undo' | 'redo';
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}
    >
      <Icon name={icon} size={20} color={enabled ? Colors.text : 'rgba(27,32,48,0.25)'} />
    </Pressable>
  );
}
