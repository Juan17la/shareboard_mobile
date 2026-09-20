/**
 * The camera and history controls: zoom out / readout / zoom in, then undo and
 * redo, in one glass chip at the top-right of the board, just under the
 * header. Up there they are out of the way of the hand that draws and of the
 * toolbar at the bottom, and they read the same as on the web.
 *
 * The readout doubles as the reset — the design's "100%" button snaps the
 * camera home, which is the only way back after a long pan on an infinite
 * canvas.
 */
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/features/i18n/store';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, useBoardStore } from '@/features/board/store';
import { useSessionStore, useColors } from '@/features/session/store';
import { tick } from '@/utils/haptics';

import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { tip } from '../ui/Toast';

export function BottomControls({ top }: { top: number }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const zoomBy = useBoardStore((s) => s.zoomBy);
  const homeCamera = useBoardStore((s) => s.homeCamera);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const undoDepth = useBoardStore((s) => s.undoStack.length);
  const redoDepth = useBoardStore((s) => s.redoStack.length);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);

  const zoom = `${Math.round(camera.scale * 100)}%`;
  const at = homeCamera();
  const home = camera.x === at.x && camera.y === at.y && camera.scale === 1;
  const run = (action: () => void) => () => {
    tick(haptics);
    action();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: Math.max(insets.right, 12), top }}
    >
      <GlassPanel level="chip" radius={14} border={c.glassRim} style={floatShadow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 }}>
          <ControlButton
            icon="minus"
            label={t.zoomOut}
            enabled={camera.scale > MIN_ZOOM}
            onPress={run(() => zoomBy(1 / ZOOM_STEP))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.resetZoom} (${zoom})`}
            accessibilityState={{ disabled: home }}
            disabled={home}
            onPress={run(() => setCamera(homeCamera()))}
            onLongPress={() => tip(t.resetZoom)}
            style={{
              height: 30,
              minWidth: 46,
              paddingHorizontal: 4,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
            }}
          >
            <Txt weight="bold" size={11.5} mono>
              {zoom}
            </Txt>
          </Pressable>
          <ControlButton
            icon="plus"
            label={t.zoomIn}
            enabled={camera.scale < MAX_ZOOM}
            onPress={run(() => zoomBy(ZOOM_STEP))}
          />

          {canEdit ? (
            <>
              <View style={{ width: 1, height: 20, marginHorizontal: 4, backgroundColor: c.border }} />
              <ControlButton icon="undo" label={t.undo} enabled={undoDepth > 0} onPress={run(undo)} />
              <ControlButton icon="redo" label={t.redo} enabled={redoDepth > 0} onPress={run(redo)} />
            </>
          ) : null}
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

function ControlButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      onLongPress={() => tip(label)}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: pressed ? c.surfaceSelected : 'transparent',
      })}
    >
      <Icon name={icon} size={15} color={enabled ? c.text : c.borderDashed} />
    </Pressable>
  );
}
