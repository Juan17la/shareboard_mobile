import { Redirect, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';

import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardControls } from '@/components/board/BoardControls';
import { Toolbar } from '@/components/board/Toolbar';
import { BoardHeader } from '@/components/header/BoardHeader';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useBoardSync } from '@/hooks/use-board-sync';
import { useSessionStore } from '@/features/session/store';
import { useState } from 'react';

export default function BoardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sync = useBoardSync(id);
  const nickname = useSessionStore((s) => s.nickname);
  const setNickname = useSessionStore((s) => s.setNickname);
  const [pin, setPin] = useState('');
  const [draftNick, setDraftNick] = useState('');

  if (sync.phase === 'need-nickname') {
    return (
      <View className="flex-1 justify-center gap-4 bg-background p-6 dark:bg-background-dark">
        <Text className="text-xl font-semibold text-text dark:text-text-dark">Pick a nickname</Text>
        <Field label="Nickname" value={draftNick} onChangeText={setDraftNick} placeholder="e.g. Sam" autoFocus />
        <Button label="Continue" onPress={() => setNickname(draftNick)} disabled={!draftNick.trim()} />
      </View>
    );
  }

  if (sync.phase === 'need-pin') {
    return (
      <View className="flex-1 justify-center gap-4 bg-background p-6 dark:bg-background-dark">
        <Text className="text-xl font-semibold text-text dark:text-text-dark">This board is private</Text>
        <Field
          label="PIN"
          value={pin}
          onChangeText={setPin}
          error={sync.error}
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
        />
        <Button label="Enter" onPress={() => sync.submitPin(pin)} disabled={!pin.trim()} />
      </View>
    );
  }

  if (sync.phase === 'error') {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6 dark:bg-background-dark">
        <Text className="text-lg font-semibold text-text dark:text-text-dark">Couldn’t open this board</Text>
        <Text className="text-center text-text-secondary dark:text-text-secondary-dark">{sync.error}</Text>
        <Redirect href="/" />
      </View>
    );
  }

  if (sync.phase === 'loading' || !nickname) {
    return (
      <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <BoardHeader />
      <View className="flex-1">
        <BoardCanvas onCursorMove={sync.sendCursor} />
        <BoardControls />
      </View>
      <Toolbar />
    </View>
  );
}
