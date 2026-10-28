/**
 * "Settings", in four groups, each one card of rows: who you are, this board
 * (its destructive actions last), how the board looks, and help. Mirrors web
 * `SettingsSheet`, which has keyboard shortcuts where this has haptics.
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
import { TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useT, useToggleLang } from '@/features/i18n/store';
import type { Lang } from '@/features/i18n/strings';
import { LIMITS } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore, type AppSettings, useColors } from '@/features/session/store';
import { renameBoard } from '@/services/api/boards';
import { isLocalId, updateLocal } from '@/features/board/local';

import { AvatarPicker } from '../screens/NicknameScreen';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { Sheet, SheetGroup, SheetRow } from '../ui/Sheet';
import { Toggle } from '../ui/Toggle';
import { Txt } from '../ui/Text';
import { toast } from '../ui/Toast';

export function SettingsSheet({
  open,
  onClose,
  onAskClear,
  onAskDelete,
  onOpenAccount,
}: {
  open: boolean;
  onClose: () => void;
  onAskClear: () => void;
  onAskDelete: () => void;
  onOpenAccount: () => void;
}) {
  const c = useColors();
  const t = useT();
  const toggleLang = useToggleLang();
  const lang = useSessionStore((s) => s.lang);
  const settings = useSessionStore((s) => s.settings);
  const setSetting = useSessionStore((s) => s.setSetting);
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);
  const userId = useSessionStore((s) => s.userId);
  const nickname = useSessionStore((s) => s.nickname);
  const nickColor = useSessionStore((s) => s.nickColor);
  const avatar = useSessionStore((s) => s.avatar);
  const setNickname = useSessionStore((s) => s.setNickname);
  const account = useSessionStore((s) => s.account);
  const [nick, setNick] = useState(nickname);
  // Saved when the field is left, not per keystroke: a new nickname rejoins the
  // board, which reloaded it on every character typed.
  const commitNick = () => {
    const next = nick.trim();
    // Never empty: a blank name would send you back to the identity screen.
    if (next && next !== nickname) setNickname(next);
  };

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
      if (isLocalId(meta.id)) {
        // The offline board is renamed where it lives.
        await updateLocal(meta.id, { name: next });
        setMeta({ ...meta, name: next });
        toast(t.toastRenamed);
        return;
      }
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

  const chevron = <Icon name="chevron" size={14} color={c.textTertiary} />;
  const inputRow = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 12,
  };
  const inputText = { flex: 1, minWidth: 0, padding: 0, fontFamily: Fonts.medium, fontSize: 15, color: c.text };

  return (
    <Sheet
      open={open}
      title={t.sheetSettings}
      onClose={() => {
        commitNick();
        onClose();
      }}
      closeLabel={t.close}
      tall
    >
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <SheetGroup title={t.setYou} line="blue">
          <SheetRow
            title={account ? `@${account.username}` : t.accountGuest}
            description={account ? t.sheetAccount : t.accountGuestDesc}
            accessibilityLabel={t.sheetAccount}
            onPress={() => {
              commitNick();
              onOpenAccount();
            }}
            right={
              account ? (
                chevron
              ) : (
                <Txt weight="bold" size={13} color={c.accentText}>
                  {t.signIn}
                </Txt>
              )
            }
          />
          {/* Who you are on a board: the name beside your cursor and its icon. */}
          <View style={inputRow}>
            <Avatar name={nick || '?'} color={nickColor} avatar={avatar} size={32} />
            <TextInput
              value={nick}
              onChangeText={setNick}
              onBlur={commitNick}
              onSubmitEditing={commitNick}
              placeholder={t.nickPlaceholder}
              placeholderTextColor={c.textSecondary}
              maxLength={LIMITS.maxNicknameLength}
              autoComplete="nickname"
              accessibilityLabel={t.nickPlaceholder}
              style={inputText}
            />
            <Icon name="edit" size={15} color={c.textTertiary} />
          </View>
          <View style={{ gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Txt weight="semibold" size={12} tone="secondary">
              {t.yourIcon}
            </Txt>
            <AvatarPicker name={nick} />
          </View>
        </SheetGroup>

        {meta ? (
          <SheetGroup title={t.menuThisBoard} line="green">
            <View style={inputRow}>
              <Txt weight="semibold" size={13} tone="secondary" style={{ width: 64 }}>
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
                style={[inputText, { color: isCreator ? c.text : c.textSecondary }]}
              />
              {isCreator ? <Icon name="edit" size={15} color={c.textTertiary} /> : null}
            </View>
            {canEdit ? (
              <SheetRow
                title={t.clearBoard}
                tone="danger"
                onPress={onAskClear}
                right={<Icon name="trash" size={16} color={c.danger} />}
              />
            ) : null}
            {/* The offline board is never deleted, only cleared: the app always opens on it. */}
            {isCreator && !isLocalId(meta.id) ? (
              <SheetRow
                title={t.deleteBoard}
                tone="danger"
                onPress={onAskDelete}
                right={<Icon name="x-circle" size={16} color={c.danger} />}
              />
            ) : null}
          </SheetGroup>
        ) : null}

        <SheetGroup title={t.setDisplay} line="violet">
          {rows.map((row) => (
            <SheetRow
              key={row.key}
              title={row.label}
              description={row.desc}
              right={<Toggle value={settings[row.key]} onChange={(next) => setSetting(row.key, next)} label={row.label} />}
            />
          ))}
          <SheetRow
            title={t.settingTheme}
            description={t.settingThemeDesc}
            right={
              <Toggle value={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} label={t.settingTheme} />
            }
          />
          <View style={[inputRow, { justifyContent: 'space-between' }]}>
            <Txt weight="semibold" size={14}>
              {t.language}
            </Txt>
            <View style={{ width: 176 }}>
              <Segmented<Lang>
                value={lang}
                onChange={(next) => {
                  if (next !== lang) toggleLang();
                }}
                options={[
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </View>
          </View>
        </SheetGroup>

        <SheetGroup title={t.setHelp} line="orange">
          <SheetRow
            title={t.tourReplay}
            description={t.tourReplayDesc}
            onPress={() => {
              useSessionStore.getState().setTutorialDone(false);
              onClose();
            }}
            right={chevron}
          />
          {/* One gesture per line, not one run-on sentence. */}
          <View style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Txt weight="semibold" size={14}>
              {t.gestures}
            </Txt>
            {t.gesturesDesc.split(' · ').map((gesture) => (
              <View key={gesture} style={{ flexDirection: 'row', gap: 8 }}>
                <Txt size={13} tone="tertiary">
                  •
                </Txt>
                <Txt size={13} leading={1.35} tone="secondary" style={{ flex: 1 }}>
                  {gesture.charAt(0).toUpperCase() + gesture.slice(1)}
                </Txt>
              </View>
            ))}
          </View>
        </SheetGroup>
      </View>
    </Sheet>
  );
}
