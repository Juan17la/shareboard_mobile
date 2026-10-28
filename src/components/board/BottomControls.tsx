/**
 * The camera and history controls, in one glass chip at the top-right of the
 * board, just under the header. Zoom is a pinch, so the chip is only undo and
 * redo — plus the zoom readout while the camera is away from home. The readout
 * doubles as the reset: the "100%" button snaps the camera home, which is the
 * only way back after a long pan on an infinite canvas. The assistant is in
 * the menu.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/features/i18n/store';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, useColors } from '@/features/session/store';
import type { Reaction } from '@/services/realtime/protocol';
import { tick } from '@/utils/haptics';

import { ClassPanel } from './ClassControls';

import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';
import { tip } from '../ui/Toast';

export function BottomControls({
  top,
  onReact,
  onTimer,
}: {
  top: number;
  onReact: (emoji: Reaction) => void;
  onTimer: (ms: number | null) => void;
}) {
  const [classOpen, setClassOpen] = useState(false);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useT();
  // What the chip shows of the camera, not the camera: a pan changes none of
  // it, so panning does not re-render the chip.
  const percent = useBoardStore((s) => Math.round(s.camera.scale * 100));
  const home = useBoardStore((s) => {
    const at = s.homeCamera();
    return s.camera.x === at.x && s.camera.y === at.y && s.camera.scale === 1;
  });
  const setCamera = useBoardStore((s) => s.setCamera);
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
      style={{ position: 'absolute', right: Math.max(insets.right, 12), top, alignItems: 'flex-end' }}
    >
      <GlassPanel level="chip" radius={14} border={c.glassRim} style={floatShadow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 }}>
          {home ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.resetZoom} (${zoom})`}
              onPress={run(() => setCamera(homeCamera()))}
              onLongPress={() => tip(t.resetZoom)}
              style={{
                height: 40,
                minWidth: 52,
                paddingHorizontal: 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
              }}
            >
              <Txt weight="bold" size={11.5} mono>
                {zoom}
              </Txt>
            </Pressable>
          )}

          {canEdit ? (
            <>
              {home ? null : <View style={{ width: 1, height: 20, marginHorizontal: 4, backgroundColor: c.border }} />}
              <ControlButton icon="undo" label={t.undo} enabled={undoDepth > 0} onPress={run(undo)} />
              <ControlButton icon="redo" label={t.redo} enabled={redoDepth > 0} onPress={run(redo)} />
            </>
          ) : null}
          {/* Reactions for everyone; the countdowns inside are for those who can edit. */}
          <View style={{ width: 1, height: 20, marginHorizontal: 4, backgroundColor: c.border }} />
          <ControlButton icon="smiley" label={t.reactions} enabled onPress={run(() => setClassOpen((v) => !v))} />
        </View>
      </GlassPanel>
      {classOpen ? <ClassPanel onReact={onReact} onTimer={onTimer} onClose={() => setClassOpen(false)} /> : null}
    </View>
  );
}

const floatShadow = {
  shadowColor: '#0F1B2D',
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: pressed ? c.surfaceSelected : 'transparent',
      })}
    >
      <Icon name={icon} size={17} color={enabled ? c.text : c.borderDashed} />
    </Pressable>
  );
}
