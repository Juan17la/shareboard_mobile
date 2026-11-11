/**
 * "Editing access": who can open the board, and who can draw on it.
 *
 * Both halves of the access model from docs/01 live here — `access`
 * (public / private + PIN) and `editPolicy` (everyone / selected / creator
 * only) — and neither has a Save button: every change applies immediately and
 * the server broadcasts the result, so a viewer's tools appear or disappear
 * without anyone reloading.
 *
 * The PIN readout only ever shows a value this device chose; a creator opening
 * their board on a second phone sees the masked form, because the PIN genuinely
 * is not recoverable from the server (docs/02-backend-connection).
 */
import { View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColors } from '@/features/session/store';
import { useT } from '@/features/i18n/store';
import type { EditPolicy } from '@/features/board/model';
import { generatePin, useBoardPermissions } from '@/features/board/use-permissions';
import { useBoardStore } from '@/features/board/store';

import { Icon } from '../../atoms/Icon';
import { Segmented } from '../../atoms/Segmented';
import { RowChevron, SectionLabel, Sheet, SheetGroup, SheetRow } from '../../molecules/Sheet';
import { Button } from '../../atoms/Button';
import { Txt } from '../../atoms/Text';

export function PrivacySheet({
  open,
  onClose,
  onOpenPeople,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPeople: () => void;
}) {
  const c = useColors();
  const t = useT();
  const meta = useBoardStore((s) => s.meta);
  const { isCreator, busy, knownPin, apply } = useBoardPermissions();

  if (!meta) return null;

  const isPrivate = meta.access === 'private';

  const modes: { id: EditPolicy; label: string; desc: string }[] = [
    { id: 'everyone', label: t.modeAll, desc: t.modeAllDesc },
    { id: 'selected', label: t.modeSome, desc: t.modeSomeDesc },
    { id: 'creator-only', label: t.modeMe, desc: t.modeMeDesc },
  ];

  const setVisibility = (next: 'public' | 'private') => {
    if (next === meta.access) return;
    // Going private needs a PIN to go with it; there is nothing to ask the user
    // that they would answer better than a random four digits they can read off
    // the panel a moment later.
    void apply(next === 'private' ? { access: 'private', pin: generatePin() } : { access: 'public', pin: null });
  };

  return (
    <Sheet open={open} title={t.sheetPrivacy} onClose={onClose} closeLabel={t.close}>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <SectionLabel>{t.visibility}</SectionLabel>
          <Segmented
            value={meta.access}
            onChange={setVisibility}
            disabled={!isCreator || busy}
            options={[
              { value: 'public', label: t.publicLabel },
              { value: 'private', label: t.privateLabel },
            ]}
          />
          <Txt size={12} leading={1.35} tone="secondary" style={{ paddingHorizontal: 12 }}>
            {t.visibilityHint}
          </Txt>
        </View>

        {isPrivate ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: Radius.lg,
              backgroundColor: c.glassTintSolid,
            }}
          >
            <Icon name="lock" size={20} color={c.accentText} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt size={16} leading={1.25}>
                {t.pinLabel}
              </Txt>
              {!knownPin ? (
                <Txt size={12} leading={1.35} tone="secondary">
                  {t.pinHidden}
                </Txt>
              ) : null}
            </View>
            <Txt weight="bold" size={16} mono tracking={3}>
              {knownPin ?? '••••'}
            </Txt>
            {isCreator ? (
              <Button label={t.newPin} variant="secondary" compact disabled={busy} onPress={() => void apply({ pin: generatePin() })} />
            ) : null}
          </View>
        ) : null}

        {/* One list, one tick: the row that is on carries the checkmark. */}
        <SheetGroup title={t.whoEdits} footer={isCreator ? undefined : t.ownerOnlyHint}>
          {modes.map((mode) => {
            const active = meta.editPolicy === mode.id;
            return (
              <SheetRow
                key={mode.id}
                checked={active}
                accessibilityLabel={`${mode.label}. ${mode.desc}`}
                title={mode.label}
                description={mode.desc}
                disabled={!isCreator || busy}
                onPress={() => void apply({ editPolicy: mode.id })}
                right={active ? <Icon name="check" size={18} color={c.accentText} /> : null}
              />
            );
          })}
          {meta.editPolicy === 'selected' ? (
            <SheetRow title={t.chooseEditors} tone="accent" right={<RowChevron />} onPress={onOpenPeople} />
          ) : null}
        </SheetGroup>
      </View>
    </Sheet>
  );
}
