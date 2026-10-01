import { Pressable, View } from 'react-native';

import { Shadow } from '@/constants/theme';
import { copyToSystem, pasteFromSystem } from '@/features/board/clipboard';
import type { Point } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useT } from '@/features/i18n/store';
import type { StringKey } from '@/features/i18n/strings';
import { useColors } from '@/features/session/store';

import { toast } from '../ui/Toast';
import { GlassPanel } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Txt } from '../ui/Text';

/** Where a hold opened the menu: on screen, and the board point a paste lands on. */
export interface HoldSpot {
  x: number;
  y: number;
  at: Point;
}

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
const MENU_WIDTH = 190;
const ROW_HEIGHT = 44;

type Row = { icon: IconName; label: StringKey; run: () => void; danger?: boolean };

/**
 * What a hold on the cursor's board offers. Held on an element (which the hold
 * selects) it is the options strip's old second half — copy, cut, paste,
 * duplicate, stacking order, group — and on empty board, paste. It floats just
 * above the finger so the hand does not hide it; a tap anywhere else closes it.
 */
export function HoldMenu({
  spot,
  width,
  height,
  onClose,
}: {
  spot: HoldSpot;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const c = useColors();
  const t = useT();
  const s = useBoardStore.getState();
  const selected = s.selectedElements();
  const groupable = new Set(selected.map((el) => el.group ?? el.id)).size > 1;
  const grouped = selected.some((el) => !!el.group);

  const paste: Row = { icon: 'paste', label: 'paste', run: () => void pasteFromSystem(spot.at) };
  const rows: Row[] = selected.length
    ? [
        {
          icon: 'copy',
          label: 'copy',
          run: () => {
            s.copySelection();
            copyToSystem();
            toast(t.toastCopiedSelection);
          },
        },
        {
          icon: 'cut',
          label: 'cut',
          run: () => {
            s.cutSelection();
            copyToSystem();
          },
        },
        paste,
        { icon: 'plus', label: 'duplicate', run: () => s.duplicateSelection() },
        { icon: 'to-front', label: 'toFront', run: () => s.reorder('front') },
        { icon: 'to-back', label: 'toBack', run: () => s.reorder('back') },
        ...(groupable ? [{ icon: 'group', label: 'group', run: () => s.group() } as Row] : []),
        ...(grouped ? [{ icon: 'ungroup', label: 'ungroup', run: () => s.ungroup() } as Row] : []),
        { icon: 'trash', label: 'remove', run: () => s.deleteSelection(), danger: true },
      ]
    : [paste];

  const menuHeight = rows.length * ROW_HEIGHT;
  const left = Math.max(8, Math.min(spot.x - MENU_WIDTH / 2, width - MENU_WIDTH - 8));
  const above = spot.y - menuHeight - 28;
  const top = Math.max(8, Math.min(above >= 8 ? above : spot.y + 28, height - menuHeight - 8));

  return (
    <View style={FILL}>
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
        style={FILL}
      />
      <GlassPanel
        level="panel"
        radius={14}
        style={{ position: 'absolute', left, top, width: MENU_WIDTH, ...Shadow.panel }}
      >
        {rows.map((row) => (
          <Pressable
            key={row.label}
            accessibilityRole="menuitem"
            accessibilityLabel={t[row.label]}
            onPress={() => {
              row.run();
              onClose();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              height: ROW_HEIGHT,
              paddingHorizontal: 14,
              backgroundColor: pressed ? c.surfaceSelected : 'transparent',
            })}
          >
            <Icon name={row.icon} size={18} color={row.danger ? c.danger : c.text} />
            <Txt weight="bold" size={14} color={row.danger ? c.danger : undefined}>
              {t[row.label]}
            </Txt>
          </Pressable>
        ))}
      </GlassPanel>
    </View>
  );
}
