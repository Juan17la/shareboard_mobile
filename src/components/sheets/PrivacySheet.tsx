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
import { Pressable, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useT } from '@/features/i18n/store';
import type { EditPolicy } from '@/features/board/model';
import { generatePin, useBoardPermissions } from '@/features/board/use-permissions';
import { useBoardStore } from '@/features/board/store';

import { GlassPanel } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Segmented';
import { SectionLabel, Sheet } from '../ui/Sheet';
import { Txt } from '../ui/Text';

export function PrivacySheet({
  open,
  onClose,
  onOpenPeople,
}: {
  open: boolean;
  onClose: () => void;
  onOpenPeople: () => void;
}) {
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
          <Txt size={11.5} leading={1.4} tone="secondary">
            {t.visibilityHint}
          </Txt>
        </View>

        {isPrivate ? (
          <GlassPanel level="row" radius={Radius.lg} border={Colors.border}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 }}>
              <Icon name="lock" size={18} color={Colors.text} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt weight="bold" size={13} leading={1.2}>
                  {t.pinLabel}
                </Txt>
                {!knownPin ? (
                  <Txt size={11} leading={1.3} tone="secondary">
                    {t.pinHidden}
                  </Txt>
                ) : null}
              </View>
              <Txt weight="bold" size={16} mono tracking={3}>
                {knownPin ?? '••••'}
              </Txt>
              {isCreator ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.newPin}
                  disabled={busy}
                  onPress={() => void apply({ pin: generatePin() })}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 7,
                    borderRadius: 11,
                    borderWidth: 1,
                    borderColor: Colors.borderStrong,
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <Txt weight="extrabold" size={10.5} tone="secondary">
                    {t.newPin}
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          </GlassPanel>
        ) : null}

        <View style={{ gap: 8 }}>
          <SectionLabel>{t.whoEdits}</SectionLabel>
          {modes.map((mode) => {
            const active = meta.editPolicy === mode.id;
            return (
              <Pressable
                key={mode.id}
                accessibilityRole="radio"
                accessibilityLabel={`${mode.label}. ${mode.desc}`}
                accessibilityState={{ selected: active, disabled: !isCreator }}
                disabled={!isCreator || busy}
                onPress={() => void apply({ editPolicy: mode.id })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingHorizontal: 13,
                  paddingVertical: 12,
                  borderRadius: 15,
                  borderWidth: 1,
                  borderColor: active ? Colors.accent : Colors.border,
                  backgroundColor: active ? Colors.accentSofter : 'rgba(255,255,255,0.7)',
                  opacity: isCreator ? 1 : 0.75,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: active ? 5.5 : 2,
                    borderColor: active ? Colors.accent : 'rgba(27,32,48,0.25)',
                  }}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt weight="bold" size={13.5} leading={1.2}>
                    {mode.label}
                  </Txt>
                  <Txt size={11.5} leading={1.35} tone="secondary">
                    {mode.desc}
                  </Txt>
                </View>
              </Pressable>
            );
          })}

          {meta.editPolicy === 'selected' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.chooseEditors}
              onPress={onOpenPeople}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingHorizontal: 13,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: Colors.accent,
                backgroundColor: Colors.accentSofter,
              }}
            >
              <Txt weight="extrabold" size={12.5} tone="accent">
                {t.chooseEditors}
              </Txt>
              <Icon name="chevron" size={15} color={Colors.accent} strokeWidth={2.4} />
            </Pressable>
          ) : null}

          {!isCreator ? (
            <Txt size={11.5} leading={1.4} tone="secondary">
              {t.ownerOnlyHint}
            </Txt>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
