import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ModalScreen } from '@/components/ui/ModalScreen';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { renameBoard } from '@/services/api/boards';

export default function SettingsModal() {
  const meta = useBoardStore((s) => s.meta);
  const setMeta = useBoardStore((s) => s.setMeta);
  const clearBoard = useBoardStore((s) => s.clearBoard);
  const canEdit = useBoardStore((s) => s.canEditNow());
  const userId = useSessionStore((s) => s.userId);
  const boardToken = useBoardStore((s) => s.boardToken);
  const [name, setName] = useState(meta?.name ?? '');
  const [busy, setBusy] = useState(false);

  if (!meta) return <ModalScreen title="Settings">{null}</ModalScreen>;

  const isCreator = meta.creatorId === userId;

  async function save() {
    setBusy(true);
    try {
      const next = await renameBoard(meta!.id, name, { userId, token: boardToken ?? '' });
      setMeta(next);
      router.back();
    } catch (e) {
      Alert.alert('Could not rename', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalScreen title="Board settings">
      <Field label="Board name" value={name} onChangeText={setName} editable={isCreator} />
      {isCreator ? <Button label="Save name" onPress={save} loading={busy} /> : null}

      <View className="gap-1 pt-2">
        <Text className="text-sm text-text-secondary dark:text-text-secondary-dark">Short code</Text>
        <Text className="text-text dark:text-text-dark">{meta.shortCode}</Text>
      </View>

      {canEdit ? (
        <Button
          label="Clear the whole board"
          variant="danger"
          onPress={() =>
            Alert.alert('Clear board?', 'This removes every element for everyone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => { clearBoard(); router.back(); } },
            ])
          }
        />
      ) : null}
    </ModalScreen>
  );
}
