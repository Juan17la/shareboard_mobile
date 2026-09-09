import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useSessionStore } from '@/features/session/store';
import type { BoardAccess, EditPolicy } from '@/features/board/model';
import { createBoard, resolveShortCode } from '@/services/api/boards';
import { parseBoardRef } from '@/utils/deep-link';

export default function Home() {
  const insets = useSafeAreaInsets();
  const nickname = useSessionStore((s) => s.nickname);
  const setNickname = useSessionStore((s) => s.setNickname);
  const recent = useSessionStore((s) => s.recent);
  const userId = useSessionStore((s) => s.userId);

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [access, setAccess] = useState<BoardAccess>('public');
  const [policy, setPolicy] = useState<EditPolicy>('everyone');
  const [pin, setPin] = useState('');
  const [joinValue, setJoinValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function goToBoard(boardId: string) {
    router.push({ pathname: '/board/[id]', params: { id: boardId } });
  }

  async function handleCreate() {
    if (!nickname.trim()) return Alert.alert('Choose a nickname first');
    setBusy(true);
    try {
      const meta = await createBoard({
        name: name.trim() || 'Untitled board',
        access,
        editPolicy: policy,
        pin: access === 'private' ? pin : undefined,
        creatorId: userId,
      });
      await goToBoard(meta.id);
      setMode('menu');
    } catch (e) {
      Alert.alert('Could not create board', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!nickname.trim()) return Alert.alert('Choose a nickname first');
    const ref = parseBoardRef(joinValue);
    if (!ref) return Alert.alert('Enter a board link or code');
    setBusy(true);
    try {
      const boardId = ref.kind === 'id' ? ref.boardId : await resolveShortCode(ref.shortCode);
      await goToBoard(boardId);
      setMode('menu');
    } catch (e) {
      Alert.alert('Could not find that board', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background dark:bg-background-dark"
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, gap: 20 }}
    >
      <View className="gap-1">
        <Text className="text-3xl font-bold text-text dark:text-text-dark">Live Whiteboard</Text>
        <Text className="text-base text-text-secondary dark:text-text-secondary-dark">
          Draw together in real time. No account needed.
        </Text>
      </View>

      <Field
        label="Your nickname"
        value={nickname}
        onChangeText={setNickname}
        placeholder="e.g. Sam"
        maxLength={24}
        autoCapitalize="words"
      />

      {mode === 'menu' ? (
        <View className="gap-3">
          <Button label="New board" onPress={() => setMode('create')} fullWidth />
          <Button label="Join a board" variant="secondary" onPress={() => setMode('join')} fullWidth />
        </View>
      ) : null}

      {mode === 'create' ? (
        <View className="gap-4 rounded-lg border border-border p-4 dark:border-border-dark">
          <Field label="Board name" value={name} onChangeText={setName} placeholder="Untitled board" />
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Visibility
            </Text>
            <SegmentedControl
              value={access}
              onChange={setAccess}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private (PIN)' },
              ]}
            />
          </View>
          {access === 'private' ? (
            <Field
              label="PIN"
              value={pin}
              onChangeText={setPin}
              placeholder="4–8 digits"
              keyboardType="number-pad"
              maxLength={8}
            />
          ) : null}
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
              Who can edit
            </Text>
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
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={() => setMode('menu')} fullWidth />
            </View>
            <View className="flex-1">
              <Button label="Create" onPress={handleCreate} loading={busy} fullWidth />
            </View>
          </View>
        </View>
      ) : null}

      {mode === 'join' ? (
        <View className="gap-4 rounded-lg border border-border p-4 dark:border-border-dark">
          <Field
            label="Board link or code"
            value={joinValue}
            onChangeText={setJoinValue}
            placeholder="ABC234 or https://…/b/ABC234"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={() => setMode('menu')} fullWidth />
            </View>
            <View className="flex-1">
              <Button label="Join" onPress={handleJoin} loading={busy} fullWidth />
            </View>
          </View>
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark">
            Recent boards
          </Text>
          {recent.map((b) => (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              onPress={() => goToBoard(b.id)}
              className="flex-row items-center justify-between rounded-lg border border-border p-3 active:bg-surface dark:border-border-dark dark:active:bg-surface-dark"
            >
              <View>
                <Text className="text-base font-medium text-text dark:text-text-dark">{b.name}</Text>
                <Text className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  {b.shortCode} · {b.role === 'creator' ? 'Created by you' : 'Joined'}
                </Text>
              </View>
              <Text className="text-text-secondary dark:text-text-secondary-dark">›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
