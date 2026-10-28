/**
 * The centred glass dialog the design uses for the two destructive actions.
 *
 * Deliberately not `Alert.alert`: clearing or deleting a board is the moment
 * the app most needs to look like itself and to say exactly what will happen to
 * *everyone else* on the board, and the system alert offers neither the copy
 * layout nor the warning glyph the design specifies.
 */
import { Modal, Pressable, View } from 'react-native';

import { Glass } from '@/constants/theme';
import { useColors } from '@/features/session/store';

import { MirrorScene } from '../board/BoardMirror';
import { Button } from './Button';
import { GlassPanel, NoGlassScene } from './Glass';
import { Icon } from './Icon';
import { Txt } from './Text';

export type ConfirmTone = 'warn' | 'danger';

export function ConfirmDialog({
  open,
  tone = 'warn',
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tone?: ConfirmTone;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const c = useColors();
  const isDanger = tone === 'danger';
  const accent = isDanger ? c.danger : c.warn;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <MirrorScene veil={Glass.scrimStrong}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {/* The scrim is a sibling of the card, not its parent: nesting the card
              inside a pressable backdrop makes the card's own buttons children of
              a button. */}
          <Pressable
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            onPress={onCancel}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: Glass.scrimStrong,
            }}
          />
          {/* Left-aligned like the sheets: what happens, why it matters, then the
              two answers, the safe one first and the consequence on the right.
              Mirrors web `ConfirmDialog`. */}
          <View style={{ width: '100%', maxWidth: 380 }}>
            <GlassPanel
              level="panel"
              radius={16}
              border={null}
              style={{
                borderWidth: 1,
                borderColor: c.borderStrong,
                shadowColor: '#0F1B2D',
                shadowOpacity: 0.26,
                shadowRadius: 40,
                shadowOffset: { width: 0, height: 16 },
                elevation: 24,
              }}
            >
              <NoGlassScene>
                <View style={{ gap: 12, padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDanger ? c.dangerSoft : c.warnSoft,
                      }}
                    >
                      <Icon name="warning" size={18} color={accent} />
                    </View>
                    <Txt weight="bold" size={17} leading={1.25} tracking={-0.2} style={{ flex: 1 }}>
                      {title}
                    </Txt>
                  </View>
                  <Txt size={14} leading={1.4} tone="secondary">
                    {body}
                  </Txt>
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <Button label={cancelLabel} variant="secondary" compact disabled={busy} onPress={onCancel} />
                    {/* Both uses (clear, delete) destroy work: the answer is always red. */}
                    <Button label={confirmLabel} variant="danger" compact loading={busy} onPress={onConfirm} />
                  </View>
                </View>
              </NoGlassScene>
            </GlassPanel>
          </View>
        </View>
      </MirrorScene>
    </Modal>
  );
}
