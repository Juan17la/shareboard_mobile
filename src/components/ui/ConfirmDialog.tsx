/**
 * The centred glass dialog the design uses for the two destructive actions.
 *
 * Deliberately not `Alert.alert`: clearing or deleting a board is the moment
 * the app most needs to look like itself and to say exactly what will happen to
 * *everyone else* on the board, and the system alert offers neither the copy
 * layout nor the warning glyph the design specifies.
 */
import { Modal, Pressable, View } from 'react-native';

import { Colors, Glass } from '@/constants/theme';

import { GlassPanel } from './Glass';
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
  const isDanger = tone === 'danger';
  const accent = isDanger ? Colors.danger : Colors.warn;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
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
        <View style={{ width: '100%', maxWidth: 320 }}>
          <GlassPanel
            level="panel"
            radius={24}
            border="rgba(255,255,255,0.75)"
            style={{
              shadowColor: '#151A2D',
              shadowOpacity: 0.28,
              shadowRadius: 60,
              shadowOffset: { width: 0, height: 22 },
              elevation: 24,
            }}
          >
            <View style={{ alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingVertical: 22 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDanger ? Colors.dangerSoft : Colors.warnSoft,
                }}
              >
                <Icon name="warning" size={24} color={accent} />
              </View>

              <Txt weight="extrabold" size={17} leading={1.25} tracking={-0.2} style={{ textAlign: 'center' }}>
                {title}
              </Txt>
              <Txt size={12.5} leading={1.5} tone="secondary" style={{ textAlign: 'center' }}>
                {body}
              </Txt>

              <View style={{ flexDirection: 'row', gap: 9, marginTop: 4, alignSelf: 'stretch' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cancelLabel}
                  onPress={onCancel}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    alignItems: 'center',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: Colors.borderStrong,
                    backgroundColor: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <Txt weight="extrabold" size={13}>
                    {cancelLabel}
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                  onPress={onConfirm}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    alignItems: 'center',
                    borderRadius: 14,
                    backgroundColor: accent,
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <Txt weight="extrabold" size={13} tone="inverse">
                    {confirmLabel}
                  </Txt>
                </Pressable>
              </View>
            </View>
          </GlassPanel>
        </View>
      </View>
    </Modal>
  );
}
