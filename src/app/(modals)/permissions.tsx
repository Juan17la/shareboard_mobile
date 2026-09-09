import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { ModalScreen } from '@/components/ui/ModalScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { BoardAccess, EditPolicy } from '@/features/board/model';
import { useBoardStore } from '@/features/board/store';
import { useSessionStore } from '@/features/session/store';
import { updatePermissions } from '@/services/api/boards';

export default function PermissionsModal() {
  const meta = useBoardStore((s) => s.meta);
  const participants = useBoardStore((s) => s.participants);
  const setMeta = useBoardStore((s) => s.setMeta);
  const you = useBoardStore((s) => s.you);
  const userId = useSessionStore((s) => s.userId);
  const boardToken = useBoardStore((s) => s.boardToken);

  const [access, setAccess] = useState<BoardAccess>(meta?.access ?? 'public');
  const [policy, setPolicy] = useState<EditPolicy>(meta?.editPolicy ?? 'everyone');
  const [editors, setEditors] = useState<string[]>(meta?.editors ?? []);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const isCreator = meta?.creatorId === userId;

  if (!meta) return <ModalScreen title="Permissions">{null}</ModalScreen>;

  if (!isCreator) {
    return (
      <ModalScreen title="Permissions">
        <Text className="text-text-secondary dark:text-text-secondary-dark">
          Only the board creator can change permissions.
        </Text>
        <View className="gap-1">
          <Text className="text-text dark:text-text-dark">Visibility: {meta.access}</Text>
          <Text className="text-text dark:text-text-dark">Who can edit: {meta.editPolicy}</Text>
          <Text className="text-text dark:text-text-dark">Your role: {you?.role}</Text>
        </View>
      </ModalScreen>
    );
  }

  const toggleEditor = (id: string) =>
    setEditors((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  async function save() {
    setBusy(true);
    try {
      const next = await updatePermissions(
        meta!.id,
        {
          access,
          editPolicy: policy,
          editors,
          pin: access === 'private' && pin ? pin : access === 'public' ? null : undefined,
        },
        { userId, token: boardToken ?? '' },
      );
      setMeta(next);
      router.back();
    } catch (e) {
      Alert.alert('Could not update permissions', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalScreen
      title="Permissions"
      footer={<Button label="Save changes" onPress={save} loading={busy} fullWidth />}
    >
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Visibility</Text>
        <SegmentedControl
          value={access}
          onChange={setAccess}
          options={[
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ]}
        />
      </View>

      {access === 'private' ? (
        <Field
          label={meta.hasPin ? 'Change PIN (leave blank to keep)' : 'Set PIN'}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={8}
        />
      ) : null}

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">Who can edit</Text>
        <SegmentedControl
          value={policy}
          onChange={setPolicy}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'selected', label: 'Selected' },
            { value: 'creator-only', label: 'Only me' },
          ]}
        />
      </View>

      {policy === 'selected' ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
            Allowed editors
          </Text>
          {participants.length === 0 ? (
            <Text className="text-text-secondary dark:text-text-secondary-dark">No one else is here yet.</Text>
          ) : (
            participants
              .filter((p) => p.userId !== meta.creatorId)
              .map((p) => (
                <View
                  key={p.userId}
                  className="flex-row items-center justify-between rounded-lg border border-border p-3 dark:border-border-dark"
                >
                  <Text className="text-text dark:text-text-dark">{p.nickname}</Text>
                  <Switch value={editors.includes(p.userId)} onValueChange={() => toggleEditor(p.userId)} />
                </View>
              ))
          )}
        </View>
      ) : null}

      <Pressable onPress={() => router.back()}>
        <Text className="text-center text-text-secondary dark:text-text-secondary-dark">Cancel</Text>
      </Pressable>
    </ModalScreen>
  );
}
