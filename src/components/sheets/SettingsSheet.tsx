/**
 * "Settings": the four local switches, the language toggle, and the two
 * destructive actions.
 *
 * The switches are per-device preferences, not board state — nobody else's
 * canvas changes when you turn the dot grid off — so they are written straight
 * to the persisted session store with no network involved.
 *
 * The board's name is editable here too. It is not in the design's settings
 * list, but the header shows the name prominently and nothing else in the app
 * could change it; the alternative was a board permanently called whatever it
 * was called on the day it was made.
 */
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { useT, useToggleLang } from '@/features/i18n/store';
import { LIMITS } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, type AppSettings } from '@/features/session/store';
import { renameBoard } from '@/services/api/boards';

import { Button } from '../ui/Button';
import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Sheet, SheetRow } from '../ui/Sheet';
import { Toggle } from '../ui/Toggle';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function SettingsSheet({
  open,
  onClose,
  onAskClear,
  onAskDelete,
}: {
  open: boolean;
  onClose: () => void;
  onAskClear: () => void;
  onAskDelete: () => void;
}) {
  const t = useT();
  const toggleLang = useToggleLang();
  const settings = useSessionStore((s) => s.settings);
  const setSetting = useSessionStore((s) => s.setSetting);
  const userId = useSessionStore((s) => s.userId);

  const meta = useBoardStore((s) => s.meta);
  const setMeta = useBoardStore((s) => s.setMeta);
  const boardToken = useBoardStore((s) => s.boardToken);
  const canEdit = useBoardStore((s) => s.canEditNow());

  const remoteName = meta?.name ?? '';
  const [name, setName] = useState(remoteName);
  const [renaming, setRenaming] = useState(false);

  // Re-seed the field whenever the sheet opens, and whenever a rename lands
  // from another device, so it never shows a stale draft. This is the
  // "adjusting state when a prop changes" pattern rather than an effect: it
  // runs during the same render, so the field never paints the old value first.
  const [seed, setSeed] = useState({ open, remoteName });
  if (seed.open !== open || seed.remoteName !== remoteName) {
    setSeed({ open, remoteName });
    setName(remoteName);
  }

  const isCreator = !!meta && meta.creatorId === userId;

  const rows: { key: keyof AppSettings; label: string; desc: string }[] = [
    { key: 'grid', label: t.settingGrid, desc: t.settingGridDesc },
    { key: 'peers', label: t.settingPeers, desc: t.settingPeersDesc },
    { key: 'smooth', label: t.settingSmooth, desc: t.settingSmoothDesc },
    { key: 'haptics', label: t.settingHaptics, desc: t.settingHapticsDesc },
  ];

  async function commitName() {
    const next = name.trim();
    if (!meta || !isCreator || !next || next === meta.name) {
      setName(meta?.name ?? '');
      return;
    }
    setRenaming(true);
    try {
      const updated = await renameBoard(meta.id, next, { userId, token: boardToken ?? '' });
      setMeta(updated);
      toast(t.toastRenamed);
    } catch (error) {
      setName(meta.name);
      toast(error instanceof Error ? error.message : t.errRename);
    } finally {
      setRenaming(false);
    }
  }

  return (
    <Sheet open={open} title={t.sheetSettings} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 9 }}>
        {meta ? (
          <GlassPanel level="row" radius={15} border={Colors.border}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="bold" size={13} leading={1.2}>
                  {t.boardName}
                </Txt>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onBlur={commitName}
                  onSubmitEditing={commitName}
                  editable={isCreator && !renaming}
                  maxLength={LIMITS.maxBoardNameLength}
                  accessibilityLabel={t.rename}
                  style={{
                    padding: 0,
                    fontFamily: Fonts.semibold,
                    fontSize: 13,
                    color: isCreator ? Colors.text : Colors.textSecondary,
                  }}
                />
              </View>
              {isCreator ? <Icon name="edit" size={16} color={Colors.textTertiary} /> : null}
            </View>
          </GlassPanel>
        ) : null}

        {rows.map((row) => (
          <SheetRow
            key={row.key}
            title={row.label}
            description={row.desc}
            right={
              <Toggle
                value={settings[row.key]}
                onChange={(next) => setSetting(row.key, next)}
                label={row.label}
              />
            }
          />
        ))}

        <GlassPanel level="row" radius={15} border={Colors.border}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: 13,
            }}
          >
            <Txt weight="bold" size={13} leading={1.2}>
              {t.language}
            </Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.language}
              onPress={toggleLang}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: Colors.borderStrong,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Txt weight="extrabold" size={11.5}>
                {t.langLabel}
              </Txt>
            </Pressable>
          </View>
        </GlassPanel>

        <View style={{ height: 4 }} />

        {canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.clearBoard}
            onPress={onAskClear}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: 'rgba(229,72,77,0.28)',
              backgroundColor: Colors.dangerSoft,
            }}
          >
            <Icon name="trash" size={17} color={Colors.danger} />
            <Txt weight="extrabold" size={13} tone="danger">
              {t.clearBoard}
            </Txt>
          </Pressable>
        ) : null}

        {isCreator ? (
          <Button label={t.deleteBoard} icon="x-circle" variant="danger" onPress={onAskDelete} fullWidth />
        ) : null}

        <View style={{ height: 8 }} />
      </View>
    </Sheet>
  );
}
