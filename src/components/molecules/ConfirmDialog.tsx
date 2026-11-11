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

import { MirrorScene } from './BoardMirror';
import { Button } from '../atoms/Button';
import { NoGlassScene } from '../atoms/Glass';
import { Txt } from '../atoms/Text';

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
          {/* An alert: what happens, why it matters, then the two answers side
              by side, the safe one first. Mirrors web `ConfirmDialog`. */}
          <View
            style={{
              width: '100%',
              maxWidth: 300,
              borderRadius: 14,
              backgroundColor: c.sheet,
              borderWidth: 1,
              borderColor: c.border,
              shadowColor: '#000000',
              shadowOpacity: 0.28,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: 16 },
              elevation: 24,
            }}
          >
            <NoGlassScene>
              <View style={{ gap: 6, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
                <Txt
                  weight="semibold"
                  size={17}
                  leading={1.25}
                  tracking={-0.2}
                  accessibilityRole="header"
                  style={{ textAlign: 'center' }}
                >
                  {title}
                </Txt>
                <Txt size={13} leading={1.4} tone="secondary" style={{ textAlign: 'center' }}>
                  {body}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button label={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} style={{ flex: 1 }} />
                  {/* Both uses (clear, delete) destroy work: the answer is always red. */}
                  <Button label={confirmLabel} variant="danger" loading={busy} onPress={onConfirm} style={{ flex: 1 }} />
                </View>
              </View>
            </NoGlassScene>
          </View>
        </View>
      </MirrorScene>
    </Modal>
  );
}
