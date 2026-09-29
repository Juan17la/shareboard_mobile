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

export function BottomControls({ top, onOpenAi }: { top: number; onOpenAi: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  // What the chip shows of the camera, not the camera: a pan changes none of
  // it, so panning does not re-render the chip.
  const percent = useBoardStore((s) => Math.round(s.camera.scale * 100));
  const canZoomOut = useBoardStore((s) => s.camera.scale > MIN_ZOOM);
  const canZoomIn = useBoardStore((s) => s.camera.scale < MAX_ZOOM);
  const home = useBoardStore((s) => {
    const at = s.homeCamera();
    return s.camera.x === at.x && s.camera.y === at.y && s.camera.scale === 1;
  });
  const setCamera = useBoardStore((s) => s.setCamera);
  const zoomBy = useBoardStore((s) => s.zoomBy);
  const homeCamera = useBoardStore((s) => s.homeCamera);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const undoDepth = useBoardStore((s) => s.undoStack.length);
  const redoDepth = useBoardStore((s) => s.redoStack.length);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const haptics = useSessionStore((s) => s.settings.haptics);

  const zoom = `${percent}%`;
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
            enabled={canZoomOut}
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
            enabled={canZoomIn}
            onPress={run(() => zoomBy(ZOOM_STEP))}
          />

          {canEdit ? (
            <>
              <View style={{ width: 1, height: 20, marginHorizontal: 4, backgroundColor: c.border }} />
              <ControlButton icon="undo" label={t.undo} enabled={undoDepth > 0} onPress={run(undo)} />
              <ControlButton icon="redo" label={t.redo} enabled={redoDepth > 0} onPress={run(redo)} />
              <View style={{ width: 1, height: 20, marginHorizontal: 4, backgroundColor: c.border }} />
              <ControlButton icon="sparkle" label={t.sheetAi} enabled accent onPress={run(onOpenAi)} />
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
  accent = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  enabled: boolean;
  /** Lit in the brand colour so the one entry point to AI is easy to spot. */
  accent?: boolean;
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
        backgroundColor: accent
          ? pressed
            ? c.accentDeep
            : c.accent
          : pressed
            ? c.surfaceSelected
            : 'transparent',
      })}
    >
      <Icon name={icon} size={15} color={accent ? '#FFFFFF' : enabled ? c.text : c.borderDashed} />
    </Pressable>
  );
}
